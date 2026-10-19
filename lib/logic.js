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

module.exports = { QUOTA, sha, setPin, okPin, nice, normName, userId, clean, validQ, quotaOf, quotaMap, cutiFor, roster, parseCuti, parseDate };
