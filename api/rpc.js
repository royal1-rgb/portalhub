// Satu fungsi API untuk seluruh aplikasi (cocok untuk Vercel serverless). Realtime memakai polling.
const crypto = require('crypto');
const { q, ready, getDb, mutate, tx, bumpVer } = require('../lib/db');
const L = require('../lib/logic');

// Check in/out hanya dari perangkat yang disetujui admin (cegah login + absen lewat ponsel orang lain).
// Matikan dengan variabel lingkungan DEVICE_BINDING=0.
const BIND = process.env.DEVICE_BINDING !== '0';


const now = () => Date.now();
const json = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
const msgOut = r => ({ id: Number(r.id), conv: r.conv, from: r.frm, text: r.body, time: Number(r.ts) });
const parts = conv => (conv.startsWith('d:') ? conv.split(':').slice(1) : []);
const memberOf = (db, conv, uid) => conv === 'all' || (parts(conv).includes(uid) && parts(conv).length === 2 && parts(conv).every(id => db.users[id]));
const ME = "(conv = 'all' OR (conv LIKE 'd:%' AND strpos(conv, $1) > 0))";
const touch = (uid, t) => q('INSERT INTO presence (uid, ts) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET ts = EXCLUDED.ts', [uid, t]);

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) return Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const c = []; let n = 0; for await (const x of req) { n += x.length; if (n > 4.4e6) throw new Error('besar'); c.push(x); } return Buffer.concat(c);
}
async function authed(session) {
  if (!session) return null;
  const h = L.sha(String(session)), r = await q('SELECT uid FROM sessions WHERE hash = $1', [h]);
  return r.rows[0] ? { uid: r.rows[0].uid, hash: h } : null;
}

// Perangkat didaftarkan otomatis (disetujui) HANYA jika berasal dari sesi yang sudah ada dan akun belum punya perangkat disetujui.
// Login dengan PIN dari perangkat baru selalu menunggu persetujuan admin.
async function ensureDevice(uid, ctx, viaPin) {
  const t = now(), r = await q('SELECT status FROM devices WHERE uid = $1 AND dh = $2', [uid, ctx.dh]);
  if (r.rows[0]) { await q('UPDATE devices SET seen = $3 WHERE uid = $1 AND dh = $2', [uid, ctx.dh, t]); return r.rows[0].status; }
  const has = (await q("SELECT 1 FROM devices WHERE uid = $1 AND status = 'approved' LIMIT 1", [uid])).rows.length > 0;
  const status = !has && !viaPin ? 'approved' : 'pending';
  const ins = await q('INSERT INTO devices (uid, dh, label, status, created, seen) VALUES ($1, $2, $3, $4, $5, $5) ON CONFLICT DO NOTHING RETURNING 1', [uid, ctx.dh, L.deviceLabel(ctx.ua), status, t]);
  if (ins.rows[0]) await bumpVer(); // admin melihat permintaan baru; pengguna melihat statusnya
  return status;
}

async function snapshot(uid, session, ctx, viaPin) {
  const db = await getDb(true), u = db.users[uid], t = now();
  if (!u) return { type: 'auth_error', resume: true };
  await touch(uid, t);
  const devStatus = BIND && ctx ? await ensureDevice(uid, ctx, !!viaPin) : 'approved';
  const dev = { status: devStatus, label: ctx ? L.deviceLabel(ctx.ua) : '', on: BIND };
  const devPending = u.admin && BIND ? Number((await q("SELECT count(*) AS n FROM devices WHERE status = 'pending'")).rows[0].n) : 0;
  const [m, rd, pe, pr, v, am, ar, ck] = await Promise.all([

    q(`SELECT id, conv, frm, body, ts FROM (SELECT *, row_number() OVER (PARTITION BY conv ORDER BY id DESC) rn FROM messages WHERE ${ME}) x WHERE rn <= 200 ORDER BY id`, [uid]),
    q('SELECT conv, last_id FROM reads WHERE uid = $1', [uid]),
    q('SELECT uid, conv, last_id FROM reads WHERE uid <> $1 AND (conv = \'all\' OR (conv LIKE \'d:%\' AND strpos(conv, $1) > 0))', [uid]),
    q('SELECT uid, ts FROM presence'),
    q("SELECT COALESCE((SELECT (v #>> '{}')::int FROM kv WHERE k = 'ver'), 0) AS n"),
    q("SELECT v FROM kv WHERE k = 'att_meta'"),
    q('SELECT d, aktual, status, kind, mins FROM attendance WHERE uid = $1 ORDER BY d DESC', [uid]),
    q('SELECT d, ts, out_ts FROM checkins WHERE uid = $1 ORDER BY d DESC', [uid]),
  ]);
  const seen = Object.fromEntries(pr.rows.map(r => [r.uid, Number(r.ts)])), msgs = { all: [] }, peer = {}, reads = {};
  for (const r of m.rows) (msgs[r.conv] = msgs[r.conv] || []).push(msgOut(r));
  for (const r of rd.rows) reads[r.conv] = Number(r.last_id);
  for (const r of pe.rows) (peer[r.conv] = peer[r.conv] || {})[r.uid] = Number(r.last_id);
  const users = Object.values(db.users).map(x => ({ id: x.id, name: x.name, title: x.title, online: (seen[x.id] || 0) > t - 15000, lastSeen: seen[x.id] || 0 }));
  const maxId = m.rows.reduce((a, r) => Math.max(a, Number(r.id)), 0);
  const att = am.rows[0] ? { has: true, ...am.rows[0].v, rows: ar.rows.map(r => ({ d: r.d, a: r.aktual, s: r.status, k: L.applyGrace(r.kind, r.mins, r.status, r.aktual), m: r.mins })) } : { has: false };
  const crow = ck.rows.map(r => L.checkinRow(Number(r.ts), r.out_ts && Number(r.out_ts))), cd = crow.map(r => r.d).sort(); // check-in GPS dipisah dari data unggahan admin
  const chk = crow.length ? { has: true, file: 'Check-in GPS', total: crow.length, people: 1, from: cd[0], to: cd[cd.length - 1], updatedAt: Math.max(...ck.rows.map(r => Number(r.ts))), by: 'Check-in GPS', rows: crow } : { has: false };
  const today = L.wib(t).d, tc = ck.rows.find(r => r.d === today);
  return { type: 'init', dev, devPending, me: uid, session, pinChanged: !!u.pinChanged, admin: !!u.admin, cuti: L.cutiFor(db, u), quotas: u.admin ? L.quotaMap(db) : undefined, users, msgs, reads, peer, att, chk, office: L.OFFICE, ci: tc ? { d: today, ts: Number(tc.ts), out: tc.out_ts ? Number(tc.out_ts) : null, row: L.checkinRow(Number(tc.ts), tc.out_ts && Number(tc.out_ts)) } : null, ver: v.rows[0].n, maxId, rnow: t - 3000 };
}

async function poll(uid, d) {
  const t = now(), since = Number(d.since) || 0, rsince = Number(d.rsince) || 0;
  await touch(uid, t);
  const [m, r, p, v] = await Promise.all([
    q(`SELECT id, conv, frm, body, ts FROM messages WHERE id > $2 AND ${ME} ORDER BY id LIMIT 300`, [uid, since]),
    q('SELECT uid, conv, last_id FROM reads WHERE upd > $2 AND uid <> $1 AND (conv = \'all\' OR (conv LIKE \'d:%\' AND strpos(conv, $1) > 0))', [uid, rsince]),
    q('SELECT uid FROM presence WHERE ts > $1', [t - 15000]),
    q("SELECT COALESCE((SELECT (v #>> '{}')::int FROM kv WHERE k = 'ver'), 0) AS n"),
  ]);
  return { type: 'poll', msgs: m.rows.map(msgOut), reads: r.rows.map(x => ({ uid: x.uid, conv: x.conv, last_id: Number(x.last_id) })), rnow: t - 3000, online: p.rows.map(x => x.uid), ver: v.rows[0].n };
}

async function login(d, ip, ctx) {
  const db = await getDb(true), u = db.users[d.id];
  if (!u) return { type: 'auth_error', msg: 'Nama tidak ditemukan.' };
  const t = now(), ku = 'u:' + u.id, ki = 'i:' + ip;
  const f = (await q('SELECT k, until FROM fails WHERE k = ANY($1)', [[ku, ki]])).rows;
  if (f.some(r => Number(r.until) > t)) return { type: 'auth_error', msg: 'Terlalu banyak percobaan salah. Coba lagi beberapa menit lagi.' };
  const pin = String(d.pin || '');
  if (pin.length < 4 || pin.length > 12 || !(await L.okPin(u, pin))) {
    for (const [k, lim, lock] of [[ku, 5, 60000], [ki, 20, 600000]])
      await q(`INSERT INTO fails (k, n, until, ts) VALUES ($1, 1, 0, $2) ON CONFLICT (k) DO UPDATE SET
        n = CASE WHEN fails.ts < $2 - 600000 THEN 1 ELSE fails.n + 1 END, ts = $2,
        until = CASE WHEN (CASE WHEN fails.ts < $2 - 600000 THEN 1 ELSE fails.n + 1 END) >= $3 THEN $2 + $4 ELSE 0 END`, [k, t, lim, lock]);
    return { type: 'auth_error', msg: 'PIN salah.' };
  }
  await q('DELETE FROM fails WHERE k = $1', [ku]);
  const s = crypto.randomBytes(24).toString('hex');
  await q('INSERT INTO sessions (hash, uid, ts) VALUES ($1, $2, $3)', [L.sha(s), u.id, t]);
  await q('DELETE FROM sessions WHERE uid = $1 AND hash NOT IN (SELECT hash FROM sessions WHERE uid = $1 ORDER BY ts DESC LIMIT 5)', [u.id]);
  return snapshot(u.id, s, ctx, true);
}

async function route(d, ip, ctx) {
  if (d.a === 'roster') return { type: 'roster', list: L.roster(await getDb()) };
  if (d.a === 'login') return login(d, ip, ctx);
  const au = await authed(d.session);
  if (!au) return { type: 'auth_error', resume: true };
  const { uid, hash } = au, t = now();
  switch (d.a) {
    case 'resume': case 'snapshot': return snapshot(uid, d.session, ctx, false);
    case 'poll': return poll(uid, d);
    case 'logout': // riwayat obrolan tidak disimpan: hapus pesan yang dikirim user ini dan semua obrolan pribadinya
      await q('DELETE FROM sessions WHERE hash = $1', [hash]);
      await q("DELETE FROM messages WHERE frm = $1 OR (conv LIKE 'd:%' AND strpos(conv, $1) > 0)", [uid]);
      await q("DELETE FROM reads WHERE uid = $1 OR (conv LIKE 'd:%' AND strpos(conv, $1) > 0)", [uid]);
      await bumpVer(); return { type: 'bye' };
    case 'devlist': case 'devapprove': case 'devrevoke': case 'devapproveall': {
      const db = await getDb(true);
      if (!(db.users[uid] || {}).admin) return { type: 'noop' };
      let msg = null;
      if (d.a === 'devapprove') { // satu akun = satu perangkat: yang disetujui menggantikan yang lama
        await tx(async c => {
          await c.query("DELETE FROM devices WHERE uid = $1 AND status = 'approved' AND dh <> $2", [d.uid, d.dh]);
          await c.query("UPDATE devices SET status = 'approved' WHERE uid = $1 AND dh = $2", [d.uid, d.dh]);
        });
      } else if (d.a === 'devrevoke') await q('DELETE FROM devices WHERE uid = $1 AND dh = $2', [d.uid, d.dh]);
      else if (d.a === 'devapproveall') {
        const r = await q("UPDATE devices x SET status = 'approved' FROM (SELECT DISTINCT ON (uid) uid, dh FROM devices WHERE status = 'pending' AND uid NOT IN (SELECT uid FROM devices WHERE status = 'approved') ORDER BY uid, created) p WHERE x.uid = p.uid AND x.dh = p.dh RETURNING 1");
        msg = `${r.rowCount} perangkat disetujui.`;
      }
      if (d.a !== 'devlist') await bumpVer();
      const rows = (await q("SELECT uid, dh, label, status, created, seen FROM devices ORDER BY (status = 'pending') DESC, created DESC")).rows;
      const shared = {}; rows.filter(r => r.status === 'approved').forEach(r => (shared[r.dh] = (shared[r.dh] || 0) + 1));
      return { type: 'devlist', msg, list: rows.map(r => ({ uid: r.uid, dh: r.dh, name: (db.users[r.uid] || {}).name || '?', title: (db.users[r.uid] || {}).title || '', label: r.label, status: r.status, created: Number(r.created), seen: Number(r.seen), shared: r.status === 'approved' && shared[r.dh] > 1 })) };
    }
    case 'checkin': case 'checkout': {
      const out = d.a === 'checkout', E = msg => ({ type: out ? 'checkout_err' : 'checkin_err', msg }), lat = Number(d.lat), lng = Number(d.lng), acc = Number(d.acc), O = L.OFFICE;
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return E('Lokasi tidak valid.');
      if (isFinite(acc) && acc > 150) return E(`Akurasi GPS rendah (±${Math.round(acc)} m). Pindah ke area terbuka lalu coba lagi.`);
      if (BIND && (await ensureDevice(uid, ctx, false)) !== 'approved') return E('Perangkat ini belum terdaftar untuk akunmu, jadi check in/out tidak bisa dilakukan dari sini. Permintaan persetujuan sudah dikirim ke admin. Gunakan ponselmu sendiri yang sudah terdaftar.');
      const dist = L.distM(lat, lng, O.lat, O.lng);
      if (dist > O.r) return E(`Kamu berada ${Math.round(dist)} m dari lokasi kantor (maksimal ${O.r} m).`);
      if (out) {
        const w = L.wib(t), cur = (await q('SELECT ts, out_ts FROM checkins WHERE uid = $1 AND d = $2', [uid, w.d])).rows[0];
        if (!cur) return E('Kamu belum check in hari ini.');
        const ts = Number(cur.ts);
        if (cur.out_ts) return { type: 'checkout_ok', ci: { d: w.d, ts, out: Number(cur.out_ts), row: L.checkinRow(ts, Number(cur.out_ts)) }, already: true };
        if (w.hm < '16:00' && !d.confirm) return { type: 'checkout_confirm', hm: w.hm }; // belum jam pulang kerja: minta persetujuan user
        await q('UPDATE checkins SET out_ts = $3, out_lat = $4, out_lng = $5, out_dev = $6 WHERE uid = $1 AND d = $2 AND out_ts IS NULL', [uid, w.d, t, lat, lng, ctx.dh.slice(0, 12)]);
        return { type: 'checkout_ok', ci: { d: w.d, ts, out: t, row: L.checkinRow(ts, t) } };
      }
      const day = L.wib(t).d, ins = await q('INSERT INTO checkins (uid, d, ts, lat, lng, acc, dev) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING ts', [uid, day, t, lat, lng, isFinite(acc) ? acc : null, ctx.dh.slice(0, 12)]);
      const ts = ins.rows[0] ? t : Number((await q('SELECT ts FROM checkins WHERE uid = $1 AND d = $2', [uid, day])).rows[0].ts);
      return { type: 'checkin_ok', ci: { d: day, ts, out: null, row: L.checkinRow(ts) }, already: !ins.rows[0] };
    }
    case 'send': {
      const text = L.clean(d.text, 2000), conv = String(d.conv || '');
      if (!text || !memberOf(await getDb(), conv, uid)) return { type: 'noop' };
      const r = await q('INSERT INTO messages (conv, frm, body, ts) VALUES ($1, $2, $3, $4) RETURNING id', [conv, uid, text, t]);
      const id = Number(r.rows[0].id);
      await q('INSERT INTO reads (uid, conv, last_id, upd) VALUES ($1, $2, $3, $4) ON CONFLICT (uid, conv) DO UPDATE SET last_id = GREATEST(reads.last_id, EXCLUDED.last_id), upd = EXCLUDED.upd', [uid, conv, id, t]);
      return { type: 'msg', msg: { id, conv, from: uid, text, time: t } };
    }
    case 'read': {
      const conv = String(d.conv || ''); if (!memberOf(await getDb(), conv, uid)) return { type: 'noop' };
      const mx = Number((await q('SELECT COALESCE(MAX(id), 0) AS m FROM messages WHERE conv = $1', [conv])).rows[0].m);
      await q('INSERT INTO reads (uid, conv, last_id, upd) VALUES ($1, $2, $3, $4) ON CONFLICT (uid, conv) DO UPDATE SET last_id = EXCLUDED.last_id, upd = EXCLUDED.upd WHERE reads.last_id < EXCLUDED.last_id', [uid, conv, mx, t]);
      return { type: 'noop' };
    }
    case 'changepin': {
      const pin = String(d.pin || '');
      const err = await mutate(async db => {
        const u = db.users[uid];
        if (!(await L.okPin(u, String(d.old || '')))) return 'PIN lama salah.';
        if (!/^\d{6}$/.test(pin)) return 'PIN baru harus 6 angka.';
        if (pin === '123456' || /^(\d)\1{5}$/.test(pin)) return 'PIN terlalu mudah ditebak. Pilih angka lain.';
        await L.setPin(u, pin); u.pinChanged = true; return null;
      });
      if (err) return { type: 'pin_err', msg: err };
      await q('DELETE FROM sessions WHERE uid = $1 AND hash <> $2', [uid, hash]); // perangkat lain diminta login ulang
      return { type: 'pin_ok' };
    }
    case 'addemp': case 'setquota': case 'delemp': {
      const res = await mutate(async db => {
        if (!(db.users[uid] || {}).admin) return { type: 'emp_err', msg: 'Hanya admin yang dapat melakukan ini.' };
        if (d.a === 'delemp') {
          const tg = db.users[d.id]; if (!tg) return { type: 'noop' };
          if (tg.id === uid) return { type: 'emp_err', msg: 'Kamu tidak dapat menghapus akunmu sendiri.' };
          if (tg.admin) return { type: 'emp_err', msg: 'Akun admin tidak dapat dihapus.' };
          delete db.users[tg.id]; (db.deleted = db.deleted || {})[tg.id] = 1; // penanda agar tidak dibuat ulang dari employees.json
          if (db.cuti) { if (db.cuti.rows) delete db.cuti.rows[tg.id]; if (db.cuti.quotas) delete db.cuti.quotas[tg.id]; }
          await q('DELETE FROM sessions WHERE uid = $1', [tg.id]); await q('DELETE FROM presence WHERE uid = $1', [tg.id]);
          await q('DELETE FROM reads WHERE uid = $1', [tg.id]); await q('DELETE FROM attendance WHERE uid = $1', [tg.id]); await q('DELETE FROM checkins WHERE uid = $1', [tg.id]);
          await q("DELETE FROM messages WHERE frm = $1 OR (conv LIKE 'd:%' AND strpos(conv, $1) > 0)", [tg.id]);
          return { type: 'emp_del', id: tg.id, name: tg.name, changed: 1 };
        }
        if (d.a === 'setquota') {
          const tg = db.users[d.id], v = L.validQ(d.quota); if (!tg) return { type: 'noop' };
          if (v == null) return { type: 'quota_err', msg: 'Jatah harus berupa angka 0–366.' };
          tg.quota = v; if (db.cuti && db.cuti.quotas && db.cuti.quotas[tg.id] != null) db.cuti.quotas[tg.id] = v;
          return { type: 'noop', changed: 1 };
        }
        const name = L.clean(d.name, 40).replace(/\s+/g, ' '), title = L.clean(d.title, 40).replace(/\s+/g, ' '), pin = String(d.pin || '').trim() || '123456';
        const js = String(d.jatah ?? '').trim(), jatah = js === '' ? null : L.validQ(js);
        if (name.length < 2) return { type: 'emp_err', msg: 'Nama minimal 2 huruf.' };
        if (!title) return { type: 'emp_err', msg: 'Jabatan wajib diisi.' };
        if (!/^\d{6}$/.test(pin)) return { type: 'emp_err', msg: 'PIN awal harus 6 angka.' };
        if (js !== '' && jatah == null) return { type: 'emp_err', msg: 'Jatah cuti harus berupa angka 0–366.' };
        const id = L.userId(name); if (db.users[id]) return { type: 'emp_err', msg: `${db.users[id].name} sudah terdaftar.` };
        if (db.deleted) delete db.deleted[id]; const nu = (db.users[id] = { id, name: L.nice(name), title, pinChanged: false }); if (jatah != null) nu.quota = jatah;
        await L.setPin(nu, pin); return { type: 'emp_ok', name: nu.name, pin, changed: 1 };
      });
      if (res.changed) await bumpVer();
      return res;
    }
  }
  return { type: 'noop' };
}

async function upload(req, res, raw) {
  const au = await authed(req.headers['x-session']);
  const db = au && await getDb(true);
  if (!au || !(db.users[au.uid] || {}).admin) return json(res, 403, { error: 'Hanya admin yang dapat mengunggah data.' });
  if (req.headers['x-kind'] === 'absensi') return uploadAbsensi(req, res, raw, db, au);
  try {
    const r = await L.parseCuti(raw, db.users);
    let file = 'cuti.xlsx'; try { file = L.clean(decodeURIComponent(req.headers['x-filename'] || ''), 80) || file; } catch {}
    await mutate(async d => { d.cuti = { rows: r.rows, quotas: r.quotas, year: r.year, total: r.total, people: r.people, updatedAt: now(), by: d.users[au.uid].name, file }; }); // data lama diganti
    await bumpVer();
    json(res, 200, { ok: true, total: r.total, people: r.people, year: r.year, skipped: r.skipped, conflicts: r.conflicts, quotaCount: Object.keys(r.quotas).length, unmatched: r.unmatched });
  } catch (e) { json(res, 400, { error: e.message || 'File tidak dapat dibaca.' }); }
}

async function uploadAbsensi(req, res, raw, db, au) {
  try {
    const r = await L.parseAbsensi(raw, db.users);
    let file = 'absensi.xlsx'; try { file = L.clean(decodeURIComponent(req.headers['x-filename'] || ''), 80) || file; } catch {}
    const meta = { updatedAt: now(), by: db.users[au.uid].name, file, total: r.rows.length, people: r.people, from: r.from, to: r.to };
    await tx(async c => { // data absensi lama dihapus, diganti data unggahan terakhir (atomik)
      await c.query('DELETE FROM attendance');
      for (let i = 0; i < r.rows.length; i += 2000) {
        const p = r.rows.slice(i, i + 2000);
        await c.query('INSERT INTO attendance (uid, d, aktual, status, kind, mins) SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[])', [p.map(x => x.uid), p.map(x => x.d), p.map(x => x.a), p.map(x => x.s), p.map(x => x.k), p.map(x => x.m)]);
      }
      await c.query("INSERT INTO kv (k, v) VALUES ('att_meta', $1::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [JSON.stringify(meta)]);
    });
    await bumpVer();
    json(res, 200, { ok: true, total: r.rows.length, people: r.people, from: r.from, to: r.to, skipped: r.skipped, unmatched: r.unmatched, unknown: r.unknown });
  } catch (e) { json(res, 400, { error: e.message || 'File tidak dapat dibaca.' }); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Gunakan POST.' });
  try {
    await ready();
    const raw = await readBody(req);
    if (String(req.headers['content-type'] || '').includes('octet-stream')) return await upload(req, res, raw);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x').split(',')[0].trim();
    // Cookie perangkat (HttpOnly, diatur server): penanda ponsel yang tidak bisa dipindahkan ke ponsel lain lewat akun
    const m = String(req.headers.cookie || '').match(/(?:^|;\s*)hd=([a-f0-9]{32})/); let tok = m && m[1];
    if (!tok) { tok = crypto.randomBytes(16).toString('hex'); res.setHeader('Set-Cookie', `hd=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=63072000${String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : ''}`); }
    json(res, 200, await route(JSON.parse(raw.toString() || '{}'), ip, { dh: L.sha('dev:' + tok), ua: String(req.headers['user-agent'] || '') }));
  } catch (e) { console.error(e); json(res, 500, { type: 'error', msg: 'Terjadi kesalahan di server.' }); }
};
