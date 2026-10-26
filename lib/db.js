// Penyimpanan PostgreSQL (Neon/Supabase/Vercel Postgres). Semua data disimpan di database, bukan di berkas.
const { Pool } = require('pg');
const L = require('./logic');
const EMP = require('./employees.json');
const URL_ = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const pool = new Pool({ connectionString: URL_, max: 3, idleTimeoutMillis: 10000, ssl: /localhost|127\.0\.0\.1/.test(URL_) ? false : { rejectUnauthorized: false } });
const q = (text, p) => pool.query(text, p);

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k text PRIMARY KEY, v jsonb NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (hash text PRIMARY KEY, uid text NOT NULL, ts bigint NOT NULL)',
  'CREATE TABLE IF NOT EXISTS presence (uid text PRIMARY KEY, ts bigint NOT NULL)',
  'CREATE TABLE IF NOT EXISTS messages (id bigserial PRIMARY KEY, conv text NOT NULL, frm text NOT NULL, body text NOT NULL, ts bigint NOT NULL)',
  'CREATE INDEX IF NOT EXISTS messages_conv ON messages (conv, id)',
  'CREATE TABLE IF NOT EXISTS reads (uid text NOT NULL, conv text NOT NULL, last_id bigint NOT NULL, upd bigint NOT NULL, PRIMARY KEY (uid, conv))',
  'CREATE TABLE IF NOT EXISTS attendance (uid text NOT NULL, d text NOT NULL, aktual text, status text NOT NULL, kind text NOT NULL, mins int, PRIMARY KEY (uid, d))',
  'CREATE TABLE IF NOT EXISTS checkins (uid text NOT NULL, d text NOT NULL, ts bigint NOT NULL, lat double precision, lng double precision, acc real, PRIMARY KEY (uid, d))',
  'ALTER TABLE checkins ADD COLUMN IF NOT EXISTS out_ts bigint, ADD COLUMN IF NOT EXISTS out_lat double precision, ADD COLUMN IF NOT EXISTS out_lng double precision',
  'CREATE TABLE IF NOT EXISTS devices (uid text NOT NULL, dh text NOT NULL, label text, status text NOT NULL, created bigint NOT NULL, seen bigint NOT NULL, PRIMARY KEY (uid, dh))',
  'ALTER TABLE checkins ADD COLUMN IF NOT EXISTS dev text, ADD COLUMN IF NOT EXISTS out_dev text',
  'CREATE TABLE IF NOT EXISTS fails (k text PRIMARY KEY, n int NOT NULL, until bigint NOT NULL, ts bigint NOT NULL)',
];
let readyP = null;
const ready = () => (readyP = readyP || (async () => { for (const s of SCHEMA) await q(s); })().catch(e => { readyP = null; throw e; }));

// Baca/ubah data utama (akun, PIN, cuti) dengan kunci baris agar aman dari permintaan bersamaan
let cache = null, cacheAt = 0, seeded = false;
async function mutate(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query("SELECT v FROM kv WHERE k = 'db' FOR UPDATE");
    const db = (r.rows[0] && r.rows[0].v) || { v: 2, users: {}, cuti: null };
    const result = await fn(db);
    await c.query("INSERT INTO kv (k, v) VALUES ('db', $1::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [JSON.stringify(db)]);
    await c.query('COMMIT'); cache = null; return result;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
async function seed(d) { // akun dari employees.json; PIN awal hanya dipakai saat akun pertama dibuat
  d.users = d.users || {};
  await Promise.all(EMP.map(async e => {
    const id = L.userId(e.name); if ((d.deleted || {})[id]) return; let u = d.users[id];
    if (!u) { u = d.users[id] = { id, pinChanged: false }; await L.setPin(u, e.pin || '123456'); }
    u.name = L.nice(e.name.trim().replace(/\s+/g, ' ')); u.title = e.title.trim(); if (e.admin) u.admin = true;
  }));
}
const needSeed = db => !db || EMP.some(e => { const id = L.userId(e.name); if ((db.deleted || {})[id]) return false; const u = db.users[id]; return !u || u.title !== e.title.trim() || (e.admin && !u.admin); });
async function getDb(fresh) {
  if (!fresh && cache && Date.now() - cacheAt < 10000) return cache;
  const get = async () => ((await q("SELECT v FROM kv WHERE k = 'db'")).rows[0] || {}).v;
  let db = await get();
  if (!seeded) { if (needSeed(db)) { await mutate(seed); db = await get(); } seeded = true; }
  cache = db; cacheAt = Date.now(); return db;
}
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
const bumpVer = () => q("INSERT INTO kv (k, v) VALUES ('ver', '1'::jsonb) ON CONFLICT (k) DO UPDATE SET v = to_jsonb(((kv.v #>> '{}')::int) + 1)");
module.exports = { q, ready, getDb, mutate, tx, bumpVer };
