// Satu fungsi API untuk seluruh aplikasi (cocok untuk Vercel serverless). Realtime memakai polling.
const crypto = require('crypto');
const { q, ready, getDb, mutate, bumpVer } = require('../lib/db');
const L = require('../lib/logic');

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

async function snapshot(uid, session) {
  const db = await getDb(true), u = db.users[uid], t = now();
  if (!u) return { type: 'auth_error', resume: true };
  await touch(uid, t);
  const [m, rd, pe, pr, v] = await Promise.all([
    q(`SELECT id, conv, frm, body, ts FROM (SELECT *, row_number() OVER (PARTITION BY conv ORDER BY id DESC) rn FROM messages WHERE ${ME}) x WHERE rn <= 200 ORDER BY id`, [uid]),
    q('SELECT conv, last_id FROM reads WHERE uid = $1', [uid]),
    q('SELECT uid, conv, last_id FROM reads WHERE uid <> $1 AND (conv = \'all\' OR (conv LIKE \'d:%\' AND strpos(conv, $1) > 0))', [uid]),
    q('SELECT uid, ts FROM presence'),
    q("SELECT COALESCE((SELECT (v #>> '{}')::int FROM kv WHERE k = 'ver'), 0) AS n"),
  ]);
  const seen = Object.fromEntries(pr.rows.map(r => [r.uid, Number(r.ts)])), msgs = { all: [] }, peer = {}, reads = {};
  for (const r of m.rows) (msgs[r.conv] = msgs[r.conv] || []).push(msgOut(r));
  for (const r of rd.rows) reads[r.conv] = Number(r.last_id);
  for (const r of pe.rows) (peer[r.conv] = peer[r.conv] || {})[r.uid] = Number(r.last_id);
  const users = Object.values(db.users).map(x => ({ id: x.id, name: x.name, title: x.title, online: (seen[x.id] || 0) > t - 15000, lastSeen: seen[x.id] || 0 }));
  const maxId = m.rows.reduce((a, r) => Math.max(a, Number(r.id)), 0);
  return { type: 'init', me: uid, session, pinChanged: !!u.pinChanged, admin: !!u.admin, cuti: L.cutiFor(db, u), quotas: u.admin ? L.quotaMap(db) : undefined, users, msgs, reads, peer, ver: v.rows[0].n, maxId, rnow: t - 3000 };
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

async function login(d, ip) {
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
  return snapshot(u.id, s);
}

async function route(d, ip) {
  if (d.a === 'roster') return { type: 'roster', list: L.roster(await getDb()) };
  if (d.a === 'login') return login(d, ip);
  const au = await authed(d.session);
  if (!au) return { type: 'auth_error', resume: true };
  const { uid, hash } = au, t = now();
  switch (d.a) {
    case 'resume': case 'snapshot': return snapshot(uid, d.session);
    case 'poll': return poll(uid, d);
    case 'logout': await q('DELETE FROM sessions WHERE hash = $1', [hash]); return { type: 'bye' };
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
    case 'addemp': case 'setquota': {
      const res = await mutate(async db => {
        if (!(db.users[uid] || {}).admin) return { type: 'emp_err', msg: 'Hanya admin yang dapat melakukan ini.' };
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
        const nu = (db.users[id] = { id, name: L.nice(name), title, pinChanged: false }); if (jatah != null) nu.quota = jatah;
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
  if (!au || !(db.users[au.uid] || {}).admin) return json(res, 403, { error: 'Hanya admin yang dapat mengunggah data cuti.' });
  try {
    const r = await L.parseCuti(raw, db.users);
    let file = 'cuti.xlsx'; try { file = L.clean(decodeURIComponent(req.headers['x-filename'] || ''), 80) || file; } catch {}
    await mutate(async d => { d.cuti = { rows: r.rows, quotas: r.quotas, year: r.year, total: r.total, people: r.people, updatedAt: now(), by: d.users[au.uid].name, file }; }); // data lama diganti
    await bumpVer();
    json(res, 200, { ok: true, total: r.total, people: r.people, year: r.year, skipped: r.skipped, conflicts: r.conflicts, quotaCount: Object.keys(r.quotas).length, unmatched: r.unmatched });
  } catch (e) { json(res, 400, { error: e.message || 'File tidak dapat dibaca.' }); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Gunakan POST.' });
  try {
    await ready();
    const raw = await readBody(req);
    if (String(req.headers['content-type'] || '').includes('octet-stream')) return await upload(req, res, raw);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x').split(',')[0].trim();
    json(res, 200, await route(JSON.parse(raw.toString() || '{}'), ip));
  } catch (e) { console.error(e); json(res, 500, { type: 'error', msg: 'Terjadi kesalahan di server.' }); }
};
