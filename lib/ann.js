// Announcements: pengumuman kantor (teks + gambar opsional) yang diinput admin dan tampil di Beranda.
// Gambar disimpan di database sebagai teks base64 (sudah diperkecil di ponsel admin) dan disajikan lewat alamat bertanda tangan.
const crypto = require('crypto');
const SECRET = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'portalhub';
const HOME = 5, KEEP = 30, MAXIMG = 600 * 1024;
const key = id => crypto.createHmac('sha256', SECRET).update('ann:' + id).digest('hex').slice(0, 20);
const imgUrl = id => `/api/rpc?img=${id}&k=${key(id)}`;
// teks bebas: baris baru dipertahankan, karakter kontrol lain dibuang
const text = (s, n) => String(s || '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const out = r => ({ id: Number(r.id), title: r.title, body: r.body, ts: Number(r.ts), by: r.author || '', img: r.has ? imgUrl(r.id) : null });
const COLS = 'id, title, body, ts, author, (img IS NOT NULL) AS has';
// Tabel dibuat otomatis saat pertama dipakai, jadi fitur ini tetap jalan walau lib/db.js belum diperbarui
let tbl = null;
const ensure = q => (tbl = tbl || q('CREATE TABLE IF NOT EXISTS announcements (id bigserial PRIMARY KEY, title text NOT NULL, body text NOT NULL, ts bigint NOT NULL, author text, img text)').catch(e => { tbl = null; throw e; }));

const latest = async (q, n = HOME) => (await ensure(q), await q(`SELECT ${COLS} FROM announcements ORDER BY id DESC LIMIT $1`, [n])).rows.map(out);
const all = q => latest(q, KEEP);

// Tanggal dan jam selalu dari server (tidak bisa diubah dari ponsel)
async function add(q, author, d, now) {
  await ensure(q);
  const title = text(d.title, 80), body = text(d.body, 1000);
  if (!title) return { error: 'Judul wajib diisi.' };
  if (!body) return { error: 'Keterangan wajib diisi.' };
  let img = null;
  if (d.img) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(d.img));
    if (!m) return { error: 'Format gambar tidak didukung.' };
    const raw = Buffer.from(m[1], 'base64');
    if (raw.length > MAXIMG) return { error: 'Ukuran gambar terlalu besar.' };
    if (raw[0] !== 0xff || raw[1] !== 0xd8) return { error: 'Berkas bukan gambar JPEG yang valid.' };
    img = raw.toString('base64');
  }
  await q('INSERT INTO announcements (title, body, ts, author, img) VALUES ($1, $2, $3, $4, $5)', [title, body, now, text(author, 60), img]);
  await q(`DELETE FROM announcements WHERE id NOT IN (SELECT id FROM announcements ORDER BY id DESC LIMIT ${KEEP})`); // simpan maksimal 30 terbaru
  return { ok: true };
}
const del = async (q, id) => { await ensure(q); await q('DELETE FROM announcements WHERE id = $1', [Number(id) || 0]); };

// GET /api/rpc?img=ID&k=TANDA -> gambar JPEG
async function image(q, id, k) {
  id = Number(id); if (!id || String(k || '') !== key(id)) return null;
  await ensure(q);
  const r = await q('SELECT img FROM announcements WHERE id = $1 AND img IS NOT NULL', [id]);
  return r.rows[0] ? Buffer.from(r.rows[0].img, 'base64') : null;
}
module.exports = { latest, all, add, del, image, key, HOME, KEEP };
