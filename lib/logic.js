// Logika bersama: PIN, jatah/data cuti, pembaca berkas Excel
const crypto = require('crypto');
const QUOTA = Number(process.env.CUTI_QUOTA) || 12; // jatah cuti bawaan (hari)
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pin, salt) => new Promise((ok, no) => crypto.scrypt(String(pin), salt, 32, (e, k) => (e ? no(e) : ok(k.toString('hex')))));
async function setPin(u, pin) { u.salt = crypto.randomBytes(8).toString('hex'); u.pinHash = await scrypt(pin, u.salt); }
async function okPin(u, pin) { const a = Buffer.from(await scrypt(pin, u.salt), 'hex'), b = Buffer.from(u.pinHash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const nice = s => s.toLowerCase().replace(/(^|[\s.\-'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const normName = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const userId = name => sha(normName(name)).slice(0, 12);
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const validQ = v => { const q = Number(String(v ?? '').trim().replace(',', '.')); return String(v ?? '').trim() !== '' && Number.isFinite(q) && q >= 0 && q <= 366 ? Math.round(q * 2) / 2 : null; };
function quotaOf(db, u) { // prioritas: jatah dari berkas cuti terakhir > jatah manual admin > bawaan
  const f = db.cuti && db.cuti.quotas && db.cuti.quotas[u.id];
  if (f != null) return { q: f, src: 'file' };
  if (u.quota != null) return { q: u.quota, src: 'manual' };
  return { q: QUOTA, src: 'default' };
}
const quotaMap = db => Object.fromEntries(Object.values(db.users).map(x => [x.id, quotaOf(db, x)]));
function cutiFor(db, u) {
  const c = db.cuti, Q = quotaOf(db, u).q;
  if (!c) return { has: false, quota: Q };
  const list = (c.rows[u.id] || []).slice().sort((a, b) => b.d.localeCompare(a.d));
  const used = list.filter(x => x.d.startsWith(String(c.year)) && /^cuti$/i.test(x.s)).length;
  return { has: true, quota: Q, year: c.year, used, remaining: Math.max(0, Q - used), list, updatedAt: c.updatedAt, by: c.by, file: c.file, total: c.total, people: c.people, quotaCount: Object.keys(c.quotas || {}).length };
}
const roster = db => Object.values(db.users).map(u => ({ id: u.id, name: u.name, title: u.title })).sort((a, b) => a.name.localeCompare(b.name));

function parseDate(v) {
  let y, mo, d;
  if (v instanceof Date) { if (isNaN(v)) return null; y = v.getUTCFullYear(); mo = v.getUTCMonth() + 1; d = v.getUTCDate(); }
  else if (typeof v === 'number') { const t = new Date(Math.round((v - 25569) * 864e5)); y = t.getUTCFullYear(); mo = t.getUTCMonth() + 1; d = t.getUTCDate(); }
  else {
    const str = String(v || '').trim();
    let x = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (x) { d = +x[1]; mo = +x[2]; y = +x[3]; }
    else if ((x = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +x[1]; mo = +x[2]; d = +x[3]; }
    else return null;
  }
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
async function parseCuti(buf, users) {
  let rows;
  try { rows = await require('read-excel-file/node')(buf); } catch { throw new Error('File tidak dapat dibaca. Pastikan berformat .xlsx.'); }
  if (!rows.length) throw new Error('File kosong.');
  const head = rows[0].map(h => String(h || '').trim().toLowerCase());
  const iN = head.indexOf('nama'), iT = head.indexOf('tanggal'), iS = head.indexOf('status');
  const iQ = head.findIndex(h => ['jatah', 'jatah cuti', 'kuota', 'kuota cuti', 'hak cuti', 'total cuti'].includes(h));
  if (iN < 0 || iT < 0) throw new Error('Kolom "Nama" dan "Tanggal" tidak ditemukan di baris pertama.');
  if (head.includes('aktual')) throw new Error('Berkas ini tampak seperti data absensi (ada kolom Aktual). Unggah lewat menu Data Absensi.');
  const map = {}, quotas = {}, unmatched = new Set(); let skipped = 0, total = 0, maxYear = 0, conflicts = 0;
  for (const r of rows.slice(1)) {
    const name = normName(r[iN]), id = sha(name).slice(0, 12), hasDate = r[iT] != null && String(r[iT]).trim() !== '';
    if (!name) continue;
    if (!users[id]) { unmatched.add(String(r[iN]).trim()); continue; }
    if (iQ >= 0 && r[iQ] != null && String(r[iQ]).trim() !== '') {
      const q = validQ(r[iQ]);
      if (q == null) skipped++; else if (quotas[id] != null && quotas[id] !== q) conflicts++; else quotas[id] = q;
    }
    if (!hasDate) continue; // baris khusus jatah (tanpa tanggal cuti)
    const date = parseDate(r[iT]);
    if (!date) { skipped++; continue; }
    const list = (map[id] = map[id] || []);
    if (list.some(x => x.d === date)) { skipped++; continue; }
    list.push({ d: date, s: String(iS >= 0 && r[iS] != null ? r[iS] : 'Cuti').replace(/\s+/g, ' ').trim() || 'Cuti' });
    total++; maxYear = Math.max(maxYear, +date.slice(0, 4));
  }
  if (!total && !Object.keys(quotas).length) throw new Error('Tidak ada baris cuti yang valid. Periksa kolom Nama dan Tanggal (contoh 30-01-2026).');
  return { rows: map, quotas, total, people: Object.keys(map).length, year: maxYear || new Date().getFullYear(), skipped, conflicts, unmatched: [...unmatched] };
}

// ---------- Absensi ----------
const GRACE_MIN = 15; // toleransi keterlambatan: jam masuk 08:00, terlambat jika lewat 08:15
function outTime(a) { // "08:10 - 15:30" -> menit sejak 00:00 untuk jam pulang; null jika belum tercatat
  const m = String(a || '').match(/^\s*\d{1,2}[.:]\d{2}\s*-\s*(\d{1,2})[.:](\d{2})\s*$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function inTime(a) { // jam masuk dari "08:10 - 17:00" -> menit sejak 00:00
  const m = String(a || '').match(/^\s*(\d{1,2})[.:](\d{2})\s*-/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function applyGrace(kind, mins, status, aktual) {
  const i = inTime(aktual);
  if (kind === 'telat' && ((mins != null && mins <= GRACE_MIN) || (i != null && i <= 8 * 60 + GRACE_MIN))) kind = /pulang awal/i.test(status || '') ? 'pulang' : 'ontime'; // dalam toleransi
  const o = outTime(aktual);
  if (kind === 'ontime' && o != null && o < 16 * 60) kind = 'pulang'; // pulang sebelum 16:00
  else if (kind === 'pulang' && o != null && o >= 16 * 60) kind = 'ontime'; // status 'Pulang Awal' dari berkas diabaikan jika pulang jam 16:00 atau lebih
  return kind;
}
function classify(raw) {
  const l = String(raw || '').replace(/\s+/g, ' ').trim().toLowerCase(), m = l.match(/(\d+)\s*menit/), mins = m ? Number(m[1]) : null;
  let kind = 'lain';
  if (l.includes('terlambat')) kind = 'telat'; // termasuk "Datang Terlambat dan Pulang Awal"
  else if (l === 'ontime') kind = 'ontime';
  else if (l.startsWith('alpha') || l === 'alpa') kind = 'alpha';
  else if (l === 'cuti') kind = 'cuti';
  else if (l === 'sakit') kind = 'sakit';
  else if (l === 'ijin' || l === 'izin') kind = 'ijin';
  else if (l.startsWith('dinas')) kind = 'dinas';
  else if (l.startsWith('pulang awal')) kind = 'pulang';
  else if (l.startsWith('lembur') || l === 'overtime') kind = 'lembur';
  else if (['off', 'libur', 'libur nasional', 'hut ri', 'maulid nabi', 'tidak wajib absen'].includes(l)) kind = 'libur';
  return { kind: applyGrace(kind, mins, l, null), mins };
}
async function parseAbsensi(buf, users) {
  let rows;
  try { rows = await require('read-excel-file/node')(buf); } catch { throw new Error('File tidak dapat dibaca. Pastikan berformat .xlsx.'); }
  if (!rows.length) throw new Error('File kosong.');
  const head = rows[0].map(h => String(h || '').trim().toLowerCase());
  const iN = head.indexOf('nama'), iT = head.indexOf('tanggal'), iS = head.indexOf('status'), iA = head.indexOf('aktual');
  if (iN < 0 || iT < 0 || iS < 0 || iA < 0) throw new Error('Kolom "Nama", "Tanggal", "Aktual", dan "Status" tidak ditemukan di baris pertama. Pastikan ini berkas absensi, bukan berkas cuti.');
  const out = [], seen = new Set(), unmatched = new Set(), unknown = new Set(); let skipped = 0, from = '9999', to = '0000';
  for (const r of rows.slice(1)) {
    const name = normName(r[iN]); if (!name) continue;
    const uid = sha(name).slice(0, 12);
    if (!users[uid]) { unmatched.add(String(r[iN]).trim().replace(/\s+/g, ' ')); continue; }
    const d = parseDate(r[iT]), s = String(r[iS] ?? '').replace(/\s+/g, ' ').trim();
    if (!d || !s || seen.has(uid + d)) { skipped++; continue; }
    seen.add(uid + d);
    const a = iA >= 0 && r[iA] != null ? String(r[iA]).trim() : '';
    const c = classify(s); c.kind = applyGrace(c.kind, c.mins, s, a); if (c.kind === 'lain') unknown.add(s);
    out.push({ uid, d, a: a || null, s, k: c.kind, m: c.mins });
    if (d < from) from = d; if (d > to) to = d;
  }
  if (!out.length) throw new Error('Tidak ada baris absensi yang cocok dengan karyawan terdaftar. Periksa kolom Nama.');
  return { rows: out, people: new Set(out.map(x => x.uid)).size, from, to, skipped, unmatched: [...unmatched], unknown: [...unknown] };
}

// ---------- Check-in (GPS) ----------
const OFFICE = { lat: -6.875116155353869, lng: 109.67663296836024, r: Number(process.env.CHECKIN_RADIUS) || 100 }; // radius valid (meter)
const rad = x => x * Math.PI / 180;
function distM(a, b, c, d) { // jarak dua titik (meter), rumus haversine
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function wib(ts) { const iso = new Date(Number(ts) + 7 * 36e5).toISOString(); return { d: iso.slice(0, 10), hm: iso.slice(11, 16) }; }
function checkinRow(ts) { // baris absensi dari check-in; aturan terlambat sama dengan data Excel (jam masuk 08:00, toleransi 15 menit)
  const { d, hm } = wib(ts), late = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) - 480, a = `${hm} - ?`, s = late > 0 ? `Terlambat ${late} menit` : 'Ontime', c = classify(s);
  return { d, a, s, k: applyGrace(c.kind, c.mins, s, a), m: c.mins };
}
module.exports = { OFFICE, distM, wib, checkinRow, classify, applyGrace, GRACE_MIN, parseAbsensi, QUOTA, sha, setPin, okPin, nice, normName, userId, clean, validQ, quotaOf, quotaMap, cutiFor, roster, parseCuti, parseDate };
