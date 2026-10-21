(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = { clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.5A8 8 0 1121 12z', person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6', search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5', bell: 'M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4', back: 'M15 5l-7 7 7 7', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', plus: 'M12 5v14M5 12h14', group: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M17 11a2.5 2.5 0 100-5M18 15c2 .4 3 2 3 5', chev: 'M9 5l7 7-7 7', pin: 'M12 17v5M8 3h8l-1 6 3 3H6l3-3z', out: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9', copy: 'M9 9h11v11H9zM5 15V4h11', close: 'M6 6l12 12M18 6L6 18', edit: 'M4 20h4L19 9l-4-4L4 16z', check: 'M5 12.5l4.5 4.5L19 7.5', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', file: 'M6 3h8l4 4v14H6zM14 3v5h5', link: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1' };
const ic = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const COL = [['#e3dfff', '#372abf'], ['#c9f7e3', '#005137'], ['#dce9ff', '#1f1ab3'], ['#ffe9cc', '#8a4b00'], ['#fde0ef', '#8f1f55']];

let session = ls.get('hub-session'), roster = [], pinChanged = true, authed = false;
let att = null, attKind = 'telat', attFrom = null, attTo = null, attMonth = 'all', attSort = 'desc', quotas = {}, cuti = null, admin = false, empPaint = null, peer = {}, ws, me = null, users = new Map(), msgs = {}, reads = {}, tab = 'chat', filter = 'all', q = '', open = null, typing = {}, connected = false;

// ---------- util ----------
const hm = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayLbl = t => sameDay(t, Date.now()) ? 'Hari ini' : sameDay(t, Date.now() - 864e5) ? 'Kemarin' : new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const shortT = t => sameDay(t, Date.now()) ? hm(t) : sameDay(t, Date.now() - 864e5) ? 'Kemarin' : new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const short = n => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]; };
const ini = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const av = (u, cls = '', dot = false) => { const [b, f] = COL[parseInt(u.id.slice(0, 4), 16) % COL.length]; return `<div class="av ${cls}" style="background:${b};color:${f}">${esc(ini(u.name))}${dot && u.online ? '<i></i>' : ''}</div>`; };
const unread = c => (msgs[c] || []).filter(m => m.id > (reads[c] || 0) && m.from !== me).length;
const totalUnread = () => Object.keys(msgs).reduce((s, c) => s + unread(c), 0);
const last = c => (msgs[c] || []).slice(-1)[0];
const dmId = id => 'd:' + [me, id].sort().join(':');
const convIds = () => ['all', ...Object.keys(msgs).filter(c => c.startsWith('d:'))];
const meta = c => {
  if (c === 'all') return { name: 'Semua Karyawan', pill: `Grup Internal (${users.size} Anggota)`, group: true, av: `<div class="av grp">${ic('group')}</div>` };
  const o = users.get(c.split(':').slice(1).find(i => i !== me)) || { id: '0000', name: 'Pengguna', title: '' };
  return { name: o.name, pill: o.title, hrd: /\bHR\b/i.test(o.title), av: av(o, '', true), user: o };
};


// ---------- koneksi ----------
// ---------- koneksi (HTTP + polling; cocok untuk Vercel) ----------
let since = 0, rsince = 0, ver = 0, pollT = null, polling = false;
async function api(body) {
  try {
    const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, session }) });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json(); if (!connected) { connected = true; paintOff(); } return d;
  } catch { if (connected) { connected = false; paintOff(); } return null; }
}
const SEND = ['login', 'send', 'read', 'changepin', 'logout', 'addemp', 'setquota'];
function send(d) {
  if (!SEND.includes(d.type)) return Promise.resolve(null);
  return api({ ...d, a: d.type }).then(r => { if (r && r.type && !['noop', 'bye'].includes(r.type)) handle(r); return r; });
}
async function start() {
  const r = await api({ a: 'roster' });
  if (!r) return setTimeout(start, 3000);
  handle(r);
  if (session) { const s = await api({ a: 'resume' }); if (s) handle(s); else setTimeout(start, 3000); }
}
function startPoll() { clearTimeout(pollT); pollT = setTimeout(pollOnce, 300); }
async function pollOnce() {
  if (!authed || polling) return; polling = true;
  try {
    const r = await api({ a: 'poll', since, rsince });
    if (r && r.type === 'poll') {
      let mx = since;
      for (const m of r.msgs) { handle({ type: 'msg', msg: m }); mx = Math.max(mx, m.id); }
      since = Math.max(since, mx - 30); rsince = r.rnow;
      for (const x of r.reads) handle({ type: 'receipt', conv: x.conv, by: x.uid, upTo: x.last_id });
      const on = new Set(r.online); let ch = false;
      for (const u of users.values()) { const o = on.has(u.id) || u.id === me; if (u.online !== o) { u.online = o; ch = true; } }
      if (ch) { render(); if (open) chatHead(); if (empPaint) empPaint(); }
      if (r.ver !== ver) { ver = r.ver; const s = await api({ a: 'snapshot' }); if (s && s.type === 'init') handle(s); }
    } else if (r && r.type === 'auth_error') handle(r);
  } finally { polling = false; }
  if (authed) pollT = setTimeout(pollOnce, document.hidden ? 20000 : open ? 3000 : 6000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && authed) { clearTimeout(pollT); pollOnce(); } });
function handle(d) {
  if (d.type === 'roster') { roster = d.list; if (!session && !authed) showLogin(); }
  else if (d.type === 'auth_error') {
    if (d.resume) { session = null; authed = false; clearTimeout(pollT); ls.del('hub-session'); showLogin(); } else loginErr(d.msg);
  } else if (d.type === 'emp_ok') empMsg(`${d.name} berhasil ditambahkan. PIN awal: ${d.pin}`, true);
  else if (d.type === 'emp_err') empMsg(d.msg, false);
  else if (d.type === 'cuti') { cuti = d.cuti; if (tab === 'me') render(); const ci = $('#cinfo'); if (ci) ci.innerHTML = cutiInfo(); }
  else if (d.type === 'quotas') { quotas = d.map; if (empPaint) empPaint(); }
  else if (d.type === 'quota_err') empMsg(d.msg, false);
  else if (d.type === 'pin_ok') pinDone();
  else if (d.type === 'pin_err') pinErr(d.msg);
  else if (d.type === 'init') {
    if (d.session) { session = d.session; ls.set('hub-session', session); }
    authed = true; pinChanged = d.pinChanged; $('#login').hidden = true; $('#login').innerHTML = '';
    me = d.me; admin = !!d.admin; cuti = d.cuti; setAtt(d.att); quotas = d.quotas || {}; peer = d.peer || {}; users = new Map(d.users.map(u => [u.id, u])); msgs = d.msgs; reads = d.reads; connected = true;
    since = Math.max(0, (d.maxId || 0) - 30); rsince = d.rnow || 0; ver = d.ver || 0;
    paintOff(); render(); if (open && $('#msgs')) { chatHead(); paintMsgs(); }
    if (!$('#detail').hidden) paintDetail(); const ai = $('#ainfo'); if (ai) ai.innerHTML = attInfo();
    startPoll();
  } else if (d.type === 'user') { users.set(d.user.id, d.user); render(); if (open) chatHead(); if (empPaint) empPaint(); }
  else if (d.type === 'msg') {
    const m = d.msg, ML = (msgs[m.conv] = msgs[m.conv] || []);
    if (ML.some(x => x.id === m.id)) return;
    ML.push(m); ML.sort((a, b) => a.id - b.id);
    delete typing[m.conv];
    if (m.from !== me) { const p = (peer[m.conv] = peer[m.conv] || {}); p[m.from] = Math.max(m.id, p[m.from] || 0); }
    if (open === m.conv && m.from !== me) { reads[m.conv] = m.id; send({ type: 'read', conv: m.conv }); }
    if (m.from === me) reads[m.conv] = m.id;
    render(); if (open === m.conv) paintMsgs();
  } else if (d.type === 'receipt') {
    const p = (peer[d.conv] = peer[d.conv] || {}); p[d.by] = Math.max(p[d.by] || 0, d.upTo);
    if (open === d.conv) paintMsgs();
  } else if (d.type === 'typing') {
    typing[d.conv] = d.from; if (open === d.conv) paintTyping();
    setTimeout(() => { if (typing[d.conv] === d.from) { delete typing[d.conv]; if (open === d.conv) paintTyping(); } }, 2500);
  }
}
function paintOff() {
  let o = $('.off'); if (connected) return o && o.remove();
  if (!o) { o = document.createElement('div'); o.className = 'off'; $('#app').appendChild(o); }
  o.textContent = 'Terputus dari server, mencoba lagi…';
}

// ---------- render utama ----------
const TITLES = { home: 'Beranda', chat: 'Pesan Dan Obrolan', att: 'Absensi Karyawan', me: 'Profil Karyawan' };
function render() {
  if (!me) return;
  const u = users.get(me), n = totalUnread();
  $('#title').textContent = TITLES[tab];
  $('#meBtn').innerHTML = av(u, 's');
  $('#bell').innerHTML = ic('bell') + (n ? '<span class="dot"></span>' : '');
  document.title = (n ? `(${n}) ` : '') + 'Hub Karyawan';
  $('#nav').innerHTML = [['home', 'home', 'Beranda'], ['chat', 'chat', 'Obrolan'], ['att', 'clock', 'Absensi'], ['me', 'person', 'Profil']].map(([k, i, l]) =>
    `<button data-tab="${k}" class="${tab === k ? 'on' : ''}"${tab === k ? ' aria-current="page"' : ''}><span style="position:relative">${ic(i)}${k === 'chat' && n ? `<span class="badge">${n}</span>` : ''}</span>${l}</button>`).join('');
  if (tab === 'chat') renderChat(); else if (tab === 'home') renderHome(); else if (tab === 'att') renderAtt(); else renderMe();
}

function renderChat() {
  const main = $('#main');
  if (!$('#q')) {
    main.innerHTML = `<div class="search">${ic('search', 20)}<input id="q" type="search" placeholder="Cari rekan kerja atau divisi..." value="${esc(q)}"></div>
      <div class="chips" id="chips"></div><div class="sec"><h2><i></i>Rekan Kerja Online</h2><span id="onc"></span></div><div class="strip" id="strip"></div>
      <div class="sec" style="margin-top:12px"><h3 class="h">Percakapan</h3></div><div class="threads" id="threads"></div>
      <div class="fab"><button id="new">${ic('plus', 20)}Pesan Baru</button></div>`;
    $('#q').oninput = e => { q = e.target.value; renderChat(); };
  }
  const un = totalUnread();
  const chips = [['all', 'Semua'], ['unread', 'Belum Dibaca'], ['group', 'Grup'], ['online', 'Online']];
  $('#chips').innerHTML = chips.map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${esc(k)}">${l}${k === 'unread' && un ? `<b>${un}</b>` : ''}</button>`).join('');
  const on = [...users.values()].filter(x => x.online && x.id !== me);
  $('#onc').textContent = on.length + ' Aktif';
  $('#strip').innerHTML = on.length ? on.map(x => `<button class="pp" data-u="${x.id}">${av(x, '', true)}<b>${esc(short(x.name))}</b><small>${esc(x.title)}</small></button>`).join('')
    : '<div class="empty" style="margin:0 16px 0 0">Belum ada rekan yang online. Bagikan alamat aplikasi ini ke rekan satu jaringan.</div>';
  const term = q.toLowerCase();
  const list = convIds().map(c => ({ c, m: meta(c), l: last(c), u: unread(c) })).filter(x => {
    if (filter === 'unread' && !x.u) return false;
    if (filter === 'group' && !x.m.group) return false;
    if (filter === 'online' && !(x.m.user && x.m.user.online)) return false;
    return !term || (x.m.name + ' ' + x.m.pill + ' ' + (x.l ? x.l.text : '')).toLowerCase().includes(term);
  }).sort((a, b) => (b.c === 'all') - (a.c === 'all') || (b.l ? b.l.time : 0) - (a.l ? a.l.time : 0));
  $('#threads').innerHTML = list.length ? list.map(({ c, m, l, u }) => {
    const who = l && m.group ? (l.from === me ? 'Kamu' : short((users.get(l.from) || { name: '?' }).name)) + ': ' : '';
    return `<button class="th ${u ? 'u' : ''}" data-c="${esc(c)}">${m.av}<div class="bd"><div class="r1"><span class="nm">${esc(m.name)}${c === 'all' ? ic('pin', 15) : ''}</span>${l ? `<time>${shortT(l.time)}</time>` : ''}</div>
      ${m.pill ? `<span class="pill ${m.hrd ? 'hrd' : m.group ? 'g' : ''}">${esc(m.pill)}</span>` : ''}<p>${l ? esc(who + l.text) : 'Belum ada pesan. Sapa duluan!'}</p></div>
      ${u ? `<span class="cnt">${u}</span>` : `<span class="rt">${ic('chev', 20)}</span>`}</button>`;
  }).join('') : '<div class="empty">Tidak ada percakapan yang cocok.</div>';
}

function renderHome() {
  const u = users.get(me), on = [...users.values()].filter(x => x.online).length, n = totalUnread();
  $('#main').innerHTML = `<div class="hero"><p>Selamat datang kembali</p><h2>${esc(u.name.split(' ')[0])}</h2><p>${esc(u.title)}</p></div>
    <div class="tiles"><button class="card" data-go="chat" style="text-align:left"><b>${n}</b><span>Pesan belum dibaca</span></button><div class="card"><b>${on}</b><span>Rekan online</span></div></div>
    <div class="card"><b style="font-weight:600">Undang rekan kerja</b><p style="margin:4px 0 12px;color:var(--ink2)">Minta rekan membuka alamat ini di browser (satu jaringan Wi-Fi/LAN).</p>
    <button class="btn sec2" id="copy">${ic('copy', 18)}<span>${esc(location.origin)}</span></button></div>
    <div class="sec"><h3 class="h">Obrolan terbaru</h3></div><div class="threads" id="hthreads"></div>`;
  const saved = filter; filter = 'all'; q = '';
  const items = convIds().filter(c => last(c)).sort((a, b) => last(b).time - last(a).time).slice(0, 3);
  $('#hthreads').innerHTML = items.length ? items.map(c => { const m = meta(c), l = last(c); return `<button class="th ${unread(c) ? 'u' : ''}" data-c="${esc(c)}">${m.av}<div class="bd"><div class="r1"><span class="nm">${esc(m.name)}</span><time>${shortT(l.time)}</time></div><p>${esc(l.text)}</p></div></button>`; }).join('') : '<div class="empty">Belum ada obrolan.</div>';
  filter = saved;
}

function renderMe() {
  const u = users.get(me);
  $('#main').innerHTML = `<div class="card prof">${av({ ...u, online: true }, 'xl', true)}<h2>${esc(u.name)}</h2><span class="pill">${esc(u.title)}</span><p>ID: KNT-${esc(me.slice(0, 4).toUpperCase())}</p><button class="btn sec2 sm" id="pin">${ic('edit', 16)}Ubah PIN</button></div>${admin ? `<button class="card li" id="emp" style="width:100%;padding:16px 20px"><span class="ic">${ic('group', 20)}</span><div><b>Kelola Karyawan</b><small>Tambah karyawan agar bisa login · Admin</small></div>${ic('chev', 20)}</button><button class="card li" id="cutiAdm" style="width:100%;padding:16px 20px"><span class="ic">${ic('file', 20)}</span><div><b>Data Cuti</b><small>Unggah ulang berkas Excel cuti · Admin</small></div>${ic('chev', 20)}</button><button class="card li" id="attAdm" style="width:100%;padding:16px 20px"><span class="ic">${ic('clock', 20)}</span><div><b>Data Absensi</b><small>Unggah ulang berkas Excel absensi · Admin</small></div>${ic('chev', 20)}</button>` : ''}${pinChanged ? '' : '<div class="banner">Kamu masih memakai PIN bawaan. Ubah PIN lewat tombol di atas agar akunmu aman.</div>'}
    ${cutiHTML()}<div class="card" style="padding:4px 20px"><button class="li" id="copy"><span class="ic">${ic('link', 20)}</span><div><b>Alamat aplikasi</b><small>${esc(location.origin)}</small></div>${ic('copy', 18)}</button></div>
    <button class="btn out" id="logout">${ic('out', 20)}Keluar Akun</button><div class="ver">Hub Karyawan 1.0 · Jaringan lokal</div>`;
}

// ---------- ruang obrolan ----------
function openChat(c) {
  open = c; const el = $('#chat'); el.hidden = false;
  el.innerHTML = `<header><button class="icon-btn" id="back" aria-label="Kembali">${ic('back')}</button><div class="ct" id="ch"></div></header><div id="msgs"></div><div class="typ" id="typ"></div>
    <form class="comp" id="comp"><input id="inp" maxlength="2000" placeholder="Tulis pesan" autocomplete="off"><button aria-label="Kirim">${ic('send', 20)}</button></form>`;
  chatHead(); paintMsgs();
  const last_ = last(c); if (last_ && last_.id > (reads[c] || 0)) { reads[c] = last_.id; send({ type: 'read', conv: c }); render(); }
  let t = 0;
  $('#inp').oninput = () => { if (Date.now() - t > 1500) { t = Date.now(); send({ type: 'typing', conv: c }); } };
  $('#comp').onsubmit = e => { e.preventDefault(); const v = $('#inp').value.trim(); if (v) { const p = send({ type: 'send', conv: c, text: v }); $('#inp').value = ''; p.then(r => { if ((!r || r.type !== 'msg') && $('#inp') && !$('#inp').value) $('#inp').value = v; }); } };
  $('#back').onclick = () => { open = null; el.hidden = true; el.innerHTML = ''; render(); };
  if (innerWidth > 700) $('#inp').focus();
}
function chatHead() {
  const m = meta(open), on = m.user && m.user.online;
  $('#ch').innerHTML = `${m.av.replace('class="av ', 'class="av s ')}<div style="min-width:0"><b>${esc(m.name)}</b><small class="${on ? 'on' : ''}">${m.group ? users.size + ' anggota' : on ? 'Online' : m.user && m.user.lastSeen ? 'Terakhir aktif ' + (sameDay(m.user.lastSeen, Date.now()) ? '' : shortT(m.user.lastSeen) + ' ') + hm(m.user.lastSeen) : 'Offline'}</small></div>`;
}
function paintMsgs() {
  const box = $('#msgs'); if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120 || !box.children.length;
  let prev = null, html = '';
  for (const m of msgs[open] || []) {
    if (!prev || !sameDay(prev.time, m.time)) html += `<div class="day">${dayLbl(m.time)}</div>`;
    const mine = m.from === me, nm = !mine && open === 'all' && (!prev || prev.from !== m.from || !sameDay(prev.time, m.time));
    html += `<div class="b ${mine ? 'me' : ''}">${nm ? `<span class="w">${esc((users.get(m.from) || { name: '?' }).name)}</span>` : ''}${esc(m.text)}<span class="t">${hm(m.time)}${mine ? tick(m) : ''}</span></div>`;
    prev = m;
  }
  box.innerHTML = html || '<div class="empty" style="margin:auto">Belum ada pesan. Mulai percakapan dengan menyapa.</div>';
  if (near) box.scrollTop = box.scrollHeight;
}
function tick(m) {
  const others = (m.conv === 'all' ? [...users.keys()] : m.conv.split(':').slice(1)).filter(id => id !== me);
  const n = others.filter(id => ((peer[m.conv] || {})[id] || 0) >= m.id).length;
  const read = m.conv === 'all' ? n > 0 : n === others.length && n > 0;
  const svg = read ? '<path d="M1.5 12.5l4.5 4.5L15 7.5M9.5 16.5l1.5 1.5L21 7.5"/>' : '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
  const label = read ? (m.conv === 'all' ? `Sudah dibaca (${n} orang)` : 'Sudah dibaca') : 'Terkirim, belum dibaca';
  return `<span class="tk ${read ? 'r' : ''}" role="img" aria-label="${label}" title="${label}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>${read && m.conv === 'all' ? n : ''}</span>`;
}
function paintTyping() {
  const t = $('#typ'); if (!t) return;
  const u = users.get(typing[open]); t.textContent = u ? `${short(u.name)} sedang mengetik…` : '';
}

// ---------- form profil & sheet ----------
function showLogin() {
  const el = $('#login'); el.hidden = false; let sel = null;
 el.innerHTML = `<form class="lg" id="pf"><div class="lg-brand"><img class="logo" src="/logo.jpg" width="72" height="72" alt="Mjs Group"><span>Mjs Group</span></div>
    <h1>Portal Hub Employee</h1><p>Pilih namamu, lalu masukkan PIN untuk masuk.</p>
    <div id="pick"><div class="search" style="margin-bottom:8px">${ic('search', 20)}<input id="rq" type="search" placeholder="Cari nama..." autocomplete="off"></div><div class="rl" id="rl"></div></div>
    <div id="chosen" hidden></div>
    <label class="fld" id="pinf" hidden><span>PIN (6 angka)</span><input id="pn" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password"></label>
    <div class="err" id="lerr" role="alert"></div><button class="btn" id="go" type="submit" hidden>Masuk ke Obrolan</button></form>`;
  const paint = () => {
    const t = $('#rq').value.trim().toLowerCase(), list = roster.filter(r => !t || (r.name + ' ' + r.title).toLowerCase().includes(t));
    $('#rl').innerHTML = list.length ? list.map(r => `<button type="button" class="li" data-r="${r.id}">${av(r, 's')}<div><b>${esc(r.name)}</b><small>${esc(r.title)}</small></div></button>`).join('') : '<div class="empty">Nama tidak ditemukan.</div>';
  };
  const choose = id => {
    sel = roster.find(r => r.id === id); const on = !!sel;
    $('#pick').hidden = on; $('#chosen').hidden = !on; $('#pinf').hidden = !on; $('#go').hidden = !on; loginErr('');
    if (on) { $('#chosen').innerHTML = `<div class="li" style="border:0;padding:0 0 16px">${av(sel, '')}<div><b>${esc(sel.name)}</b><small>${esc(sel.title)}</small></div><button type="button" class="btn sec2 sm" id="chg" style="height:36px;padding:0 14px">Ganti</button></div>`; $('#chg').onclick = () => choose(null); $('#pn').focus(); }
    else { $('#pn').value = ''; $('#rq').focus(); }
  };
  $('#rq').oninput = paint; paint();
  $('#rl').onclick = e => { const b = e.target.closest('[data-r]'); if (b) choose(b.dataset.r); };
  $('#pn').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); };
  $('#pf').onsubmit = e => {
    e.preventDefault(); const pin = $('#pn').value;
    if (!sel) return; if (pin.length !== 6) return loginErr('PIN terdiri dari 6 angka.');
    send({ type: 'login', id: sel.id, pin });
  };
}
function loginErr(m) { const e = $('#lerr'); if (e) e.textContent = m || ''; if (m && $('#pn')) { $('#pn').value = ''; $('#pn').focus(); } }
function pinSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<form class="sh" id="pnf"><h3>Ubah PIN<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    ${['PIN lama', 'PIN baru (6 angka)', 'Ulangi PIN baru'].map((l, i) => `<label class="fld"><span>${l}</span><input class="pi" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="${i ? 'new-password' : 'current-password'}"></label>`).join('')}
    <div class="err" id="perr" role="alert"></div><button class="btn" type="submit">Simpan PIN</button></form>`;
  const ins = [...sh.querySelectorAll('.pi')]; ins[0].focus();
  ins.forEach(i => i.oninput = () => { i.value = i.value.replace(/\D/g, ''); });
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
  $('#pnf').onsubmit = e => {
    e.preventDefault(); const [a, b, c] = ins.map(i => i.value);
    if (b.length !== 6) return pinErr('PIN baru harus 6 angka.');
    if (b !== c) return pinErr('Pengulangan PIN tidak sama.');
    send({ type: 'changepin', old: a, pin: b });
  };
}
const nf = x => Number.isInteger(x) ? String(x) : String(x).replace('.', ',');
const fmtDT = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('.', ':');
const fmtD = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
function cutiHTML() {
  const c = cuti, ok = c && c.has;
  const head = `<div class="sec" style="margin:8px 0 10px;align-items:flex-end"><div><h3 class="h">Informasi &amp; Sisa Cuti</h3>${ok ? `<small style="color:var(--ink2)">Periode Tahun ${c.year}</small>` : ''}</div>${ok ? '<span class="aktif">Aktif</span>' : ''}</div>`;
  if (!ok) return head + '<div class="empty" style="margin-bottom:12px">Data cuti belum tersedia. Admin belum mengunggah data cuti.</div>';
  const pct = c.quota ? Math.round(c.remaining / c.quota * 100) : 0, over = c.used > c.quota;
  return head + `<div class="card cuti"><div class="cl">${ic('check', 16)}Cuti Tahunan</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin:8px 0 14px"><div><span class="big">${nf(c.remaining)}</span> <span class="bigl">Hari Tersisa</span><div class="sub">dari total jatah ${nf(c.quota)} hari per tahun</div></div><div class="ring" style="--p:${pct}"><span>${pct}%<br>Sisa</span></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="bl"><span>${nf(c.used)} Hari Digunakan</span><b>${nf(c.remaining)} Hari Tersedia</b></div>${over ? `<div class="banner" style="margin:12px 0 0">Cuti terpakai (${nf(c.used)} hari) melebihi jatah ${nf(c.quota)} hari.</div>` : ''}</div>
    <div class="card" style="padding:8px 20px"><div class="sec" style="margin:8px 0 0"><h3 class="h" style="font-size:14px">Riwayat Cuti</h3><span style="color:var(--ink2)">${c.list.length} hari</span></div>
    ${c.list.length ? c.list.map(x => `<div class="li"><span class="ic ok">${ic('check', 18)}</span><div><b>${esc(fmtD(x.d))}</b><small>${esc(x.s)}</small></div></div>`).join('') : '<div class="empty" style="margin:12px 0">Belum ada cuti tercatat.</div>'}</div>
    <div class="ver" style="margin:0 0 14px;text-align:left;font-weight:400">Data diperbarui ${fmtDT(c.updatedAt)} oleh ${esc(c.by)}</div>`;
}
function cutiInfo() {
  const c = cuti && cuti.has ? cuti : null;
  return c ? `Data saat ini: <b>${esc(c.file)}</b> · ${c.total} hari cuti untuk ${c.people} karyawan · diunggah ${fmtDT(c.updatedAt)} oleh ${esc(c.by)}` : 'Belum ada data cuti.';
}
function cutiSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<div class="sh"><h3>Data Cuti<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    <div class="empty" id="cinfo" style="margin-bottom:12px">${cutiInfo()}</div>
    <p style="margin:0 0 10px;color:var(--ink2);font-size:13px;line-height:20px">Berkas Excel (.xlsx) dengan kolom <b>Nama</b>, <b>Tanggal</b> (contoh 30-01-2026), dan <b>Status</b>. Satu baris = satu hari cuti. Mengunggah berkas baru <b>mengganti seluruh data cuti sebelumnya</b>.</p><p style="margin:0 0 14px;color:var(--ink2);font-size:13px;line-height:20px">Jatah cuti tiap karyawan boleh berbeda: tambahkan kolom <b>Jatah</b> (isi sama di semua baris orang itu). Karyawan tanpa cuti cukup 1 baris dengan Tanggal dikosongkan. Tanpa kolom Jatah, dipakai jatah manual atau bawaan.</p>
    <label class="btn" style="cursor:pointer">${ic('upload', 18)}Pilih berkas .xlsx<input type="file" id="cf" accept=".xlsx" hidden></label><div class="err" id="cres" role="status" style="margin-top:12px"></div></div>`;
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
  $('#cf').onchange = async e => {
    const f = e.target.files[0], out = $('#cres'); if (!f) return;
    const say = (m, good) => { out.style.color = good ? 'var(--sec)' : 'var(--err)'; out.innerHTML = m; };
    if (!/\.xlsx$/i.test(f.name)) { e.target.value = ''; return say('Berkas harus berformat .xlsx.'); }
    if (!confirm(`Unggah "${f.name}"?\nData cuti sebelumnya akan diganti seluruhnya.`)) { e.target.value = ''; return; }
    say('Mengunggah…', true);
    try {
      const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-session': session, 'x-filename': encodeURIComponent(f.name) }, body: f });
      const d = await r.json();
      if (!r.ok) return say(esc(d.error || 'Gagal mengunggah.'));
      say(`Berhasil: ${d.total} hari cuti untuk ${d.people} karyawan (periode ${d.year}).` + (d.quotaCount ? `<br>Jatah cuti dari berkas: ${d.quotaCount} karyawan.` : '<br>Berkas tanpa kolom Jatah: dipakai jatah manual atau bawaan.') + (d.conflicts ? `<br>${d.conflicts} baris memiliki jatah berbeda untuk orang yang sama (dipakai nilai pertama).` : '') + (d.skipped ? `<br>${d.skipped} baris dilewati (tanggal tidak valid atau ganda).` : '') + (d.unmatched.length ? `<br>${d.unmatched.length} nama tidak ada di daftar karyawan: ${esc(d.unmatched.slice(0, 8).join(', '))}${d.unmatched.length > 8 ? '…' : ''}` : ''), true);
    } catch { say('Gagal terhubung ke server.'); }
    e.target.value = '';
  };
}
// ---------- Absensi ----------
const KINDS = { telat: 'Terlambat', ontime: 'Tepat Waktu', alpha: 'Alpha', pulang: 'Pulang Awal', cuti: 'Cuti', sakit: 'Sakit', ijin: 'Ijin', dinas: 'Dinas Luar', lembur: 'Lembur', libur: 'Libur / OFF', lain: 'Lainnya' };
const KORDER = Object.keys(KINDS);
const fmtLong = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); };
const monthLbl = mo => new Date(+mo.slice(0, 4), +mo.slice(5, 7) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const KET = r => { // keterangan detail: dalam toleransi (<=15 menit) bukan terlambat; pulang sebelum 16.00 = pulang awal
  let t = r.s;
  if (r.k !== 'telat' && r.m != null && r.m <= 15 && /terlambat/i.test(t)) t = t.replace(/(datang\s+)?terlambat/i, 'Toleransi');
  const o = String(r.a || '').match(/-\s*(\d{1,2})[.:](\d{2})\s*$/), early = o && +o[1] * 60 + +o[2] < 960;
  if (early && !/pulang awal/i.test(t) && ['ontime', 'pulang', 'telat'].includes(r.k)) t += ' · Pulang awal (sebelum 16.00)';
  return t;
};
const jam = a => {
  if (!a) return '';
  const m = String(a).match(/^(\d{1,2})[.:](\d{2})\s*-\s*(?:(\d{1,2})[.:](\d{2})|\?)$/);
  if (!m) return esc(a);
  return `${m[1].padStart(2, '0')}:${m[2]} – ${m[3] ? m[3].padStart(2, '0') + ':' + m[4] : '?'}`;
};
function setAtt(a) { // data baru (mis. admin mengunggah ulang) -> filter tanggal dikembalikan ke semua
  const prev = att && att.updatedAt; att = a || null;
  if (!att || att.updatedAt !== prev) { attFrom = attTo = null; attMonth = 'all'; }
}
const effFrom = () => attFrom || (att && att.from), effTo = () => attTo || (att && att.to);
const attRows = () => ((att && att.rows) || []).filter(r => r.d >= effFrom() && r.d <= effTo());
const periodLabel = () => effFrom() === effTo() ? fmtLong(effFrom()) : `${fmtLong(effFrom())} – ${fmtLong(effTo())}`;
function attMonths() { // semua bulan pada periode data
  const out = []; let [y, m] = att.from.slice(0, 7).split('-').map(Number); const end = att.to.slice(0, 7);
  for (;;) { const k = `${y}-${String(m).padStart(2, '0')}`; out.push(k); if (k >= end) break; if (++m > 12) { m = 1; y++; } }
  return out;
}
function setMonth(mo) {
  attMonth = mo;
  if (mo === 'all') attFrom = attTo = null;
  else { const [y, m] = mo.split('-').map(Number), e = `${mo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; attFrom = mo + '-01' > att.from ? mo + '-01' : att.from; attTo = e < att.to ? e : att.to; }
  renderAtt();
}
document.addEventListener('change', e => {
  if (e.target.id !== 'adf' && e.target.id !== 'adt') return;
  let f = $('#adf').value || null, t = $('#adt').value || null;
  if (f && t && f > t) { if (e.target.id === 'adf') t = f; else f = t; } // tanggal lain menyesuaikan
  attFrom = f; attTo = t; attMonth = null; renderAtt();
});
const attGroup = () => { const by = {}; attRows().forEach(r => (by[r.k] = by[r.k] || []).push(r)); return by; };
function renderAtt() {
  const a = att;
  if (!a || !a.has) { $('#main').innerHTML = '<div class="sec" style="margin:0 0 10px"><h3 class="h">Rekap Absensi</h3></div><div class="empty">Data absensi belum tersedia. Admin belum mengunggah data absensi.</div>'; return; }
  const foot = `<div class="ver" style="text-align:left;font-weight:400;margin:4px 0 14px">Data diperbarui ${fmtDT(a.updatedAt)} oleh ${esc(a.by)}</div>`;
  if (!a.rows.length) { $('#main').innerHTML = '<div class="sec" style="margin:0 0 10px"><h3 class="h">Rekap Absensi</h3></div><div class="empty">Belum ada catatan absensi atas namamu pada periode ini. Jika menurutmu keliru, hubungi admin.</div>' + foot; return; }
  if (!$('#attres')) {
    $('#main').innerHTML = `<div class="sec" style="margin:0 0 10px"><div><h3 class="h">Rekap Absensi</h3><small id="attper" style="color:var(--ink2)"></small></div></div>
      <div class="card" style="padding:14px 16px"><div class="fl">Pilih bulan</div><div class="chips" id="amchips" style="margin:6px -16px 12px;padding:2px 16px"></div>
      <div class="drow"><label class="fld" style="margin:0"><span>Dari tanggal</span><input id="adf" type="date"></label><label class="fld" style="margin:0"><span>Sampai tanggal</span><input id="adt" type="date"></label></div>
      <button class="btn sec2" id="adreset" style="margin-top:12px;height:40px" hidden>Tampilkan semua tanggal</button></div><div id="attres"></div>`;
  }
  $('#amchips').innerHTML = [['all', 'Semua'], ...attMonths().map(k => [k, monthLbl(k)])].map(([k, l]) => `<button class="chip ${attMonth === k ? 'on' : ''}" data-am="${k}">${l}</button>`).join('');
  $('#adf').min = $('#adt').min = a.from; $('#adf').max = $('#adt').max = a.to;
  $('#adf').value = effFrom(); $('#adt').value = effTo();
  $('#adreset').hidden = !(attFrom || attTo); $('#attper').textContent = periodLabel();
  const rows = attRows();
  if (!rows.length) { $('#attres').innerHTML = '<div class="empty" style="margin-top:12px">Tidak ada catatan absensi pada rentang tanggal ini.</div>' + foot; return; }
  const by = attGroup(), tel = by.telat || [], mins = tel.reduce((s, r) => s + (r.m || 0), 0), nomin = tel.filter(r => r.m == null).length;
  const tiles = KORDER.filter(k => k !== 'telat' && (by[k] || []).length).map(k => `<button class="tile ${k}" data-att="${k}"><b>${by[k].length}</b><span>${KINDS[k]}</span></button>`).join('');
  $('#attres').innerHTML = `<button class="card ahero" data-att="telat" style="width:100%;text-align:left"><div class="cl" style="color:#b45309">${ic('clock', 16)}Keterlambatan</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:6px"><div><span class="big">${tel.length}</span> <span class="bigl">kali terlambat</span>
    <div class="sub">${tel.length ? `Total ${nf(mins)} menit${nomin ? ` (+${nomin} hari tanpa keterangan menit)` : ''} · ketuk untuk melihat tanggal` : 'Tidak ada keterlambatan pada periode ini. Pertahankan!'}</div></div><span style="color:#94a3b8">${ic('chev', 22)}</span></div></button>
    <div class="agrid">${tiles}</div>${foot}`;
}
function openDetail(kind) { attKind = kind; paintDetail(); }
function paintDetail() {
  const el = $('#detail'); el.hidden = false;
  const by = attGroup(), rows = attRows(), kinds = KORDER.filter(k => (by[k] || []).length);
  let list = attKind === 'all' ? rows : (by[attKind] || []);
  if (attSort === 'asc') list = list.slice().reverse();
  const chips = [['all', 'Semua', rows.length], ...kinds.map(k => [k, KINDS[k], by[k].length])];
  let html = '', cur = '';
  for (const r of list) {
    const mo = r.d.slice(0, 7);
    if (mo !== cur) { cur = mo; html += `<div class="mh">${monthLbl(mo)} · ${list.filter(x => x.d.startsWith(mo)).length} hari</div>`; }
    const noOut = /-\s*\?$/.test(r.a || '');
    html += `<div class="li"><span class="ic k-${r.k}">${ic(r.k === 'telat' || r.k === 'ontime' ? 'clock' : 'check', 18)}</span><div><b>${esc(fmtD(r.d))}</b><small>${esc(KET(r))}${noOut ? ' · jam pulang belum tercatat' : ''}</small></div><span class="jam">${jam(r.a)}</span></div>`;
  }
  el.innerHTML = `<header><button class="icon-btn" id="dback" aria-label="Kembali">${ic('back')}</button><div class="ct"><div style="min-width:0"><b>Detail Absensi</b><small>${esc(attKind === 'all' ? 'Semua status' : KINDS[attKind])} · ${list.length} hari</small></div></div><button class="chip" data-sort style="margin-left:auto;margin-right:12px">${attSort === 'desc' ? 'Terbaru' : 'Terlama'}</button></header>
    <div class="chips" style="margin:0;padding:10px 16px">${chips.map(([k, l, n]) => `<button class="chip ${attKind === k ? 'on' : ''}" data-ak="${k}">${l}<b>${n}</b></button>`).join('')}</div>
    <div class="dl"><div class="sub" style="margin:10px 0 0">Periode ${periodLabel()}</div>${html || '<div class="empty">Tidak ada data untuk status ini.</div>'}</div>`;
  $('#dback').onclick = () => { el.hidden = true; el.innerHTML = ''; };
}
function attInfo() {
  const a = att && att.has ? att : null;
  return a ? `Data saat ini: <b>${esc(a.file)}</b> · ${a.total} catatan untuk ${a.people} karyawan · ${fmtLong(a.from)} – ${fmtLong(a.to)} · diunggah ${fmtDT(a.updatedAt)} oleh ${esc(a.by)}` : 'Belum ada data absensi.';
}
function attSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<div class="sh"><h3>Data Absensi<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    <div class="empty" id="ainfo" style="margin-bottom:12px">${attInfo()}</div>
    <p style="margin:0 0 14px;color:var(--ink2);font-size:13px;line-height:20px">Berkas Excel (.xlsx) dengan kolom <b>Nama</b>, <b>Tanggal</b> (contoh 30-08-2026), <b>Aktual</b> (contoh 07.38 - 16.07), dan <b>Status</b>. Satu baris = satu hari per karyawan. Mengunggah berkas baru <b>menghapus seluruh data absensi sebelumnya</b>.</p>
    <label class="btn" style="cursor:pointer">${ic('upload', 18)}Pilih berkas .xlsx<input type="file" id="af" accept=".xlsx" hidden></label><div class="err" id="ares" role="status" style="margin-top:12px"></div></div>`;
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
  $('#af').onchange = async e => {
    const f = e.target.files[0], out = $('#ares'); if (!f) return;
    const say = (m, good) => { out.style.color = good ? 'var(--sec)' : 'var(--err)'; out.innerHTML = m; };
    if (!/\.xlsx$/i.test(f.name)) { e.target.value = ''; return say('Berkas harus berformat .xlsx.'); }
    if (!confirm(`Unggah "${f.name}"?\nData absensi sebelumnya akan dihapus dan diganti seluruhnya.`)) { e.target.value = ''; return; }
    say('Mengunggah…', true);
    try {
      const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-session': session, 'x-kind': 'absensi', 'x-filename': encodeURIComponent(f.name) }, body: f });
      const d = await r.json();
      if (!r.ok) return say(esc(d.error || 'Gagal mengunggah.'));
      say(`Berhasil: ${d.total} catatan absensi untuk ${d.people} karyawan (${fmtLong(d.from)} – ${fmtLong(d.to)}).` + (d.skipped ? `<br>${d.skipped} baris dilewati (tanggal/status kosong atau ganda).` : '') +
        (d.unmatched.length ? `<br>${d.unmatched.length} nama di berkas belum terdaftar sebagai karyawan, datanya tidak dimuat: ${esc(d.unmatched.slice(0, 6).join(', '))}${d.unmatched.length > 6 ? '…' : ''}. Tambahkan lewat Kelola Karyawan, lalu unggah ulang.` : '') +
        (d.unknown.length ? `<br>Status belum dikenali (masuk kategori Lainnya): ${esc(d.unknown.slice(0, 5).join(', '))}` : ''), true);
    } catch { say('Gagal terhubung ke server.'); }
    e.target.value = '';
  };
}
function empSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<form class="sh" id="ef"><h3>Tambah Karyawan<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    <label class="fld"><span>Nama lengkap</span><input id="en" maxlength="40" required autocomplete="off"></label>
    <label class="fld"><span>Jabatan</span><input id="et" maxlength="40" required placeholder="Contoh: Staff Finance" autocomplete="off"></label>
    <label class="fld"><span>PIN awal (6 angka)</span><input id="ep" type="text" inputmode="numeric" maxlength="6" placeholder="Kosongkan untuk 123456" autocomplete="off"></label>
    <label class="fld"><span>Jatah cuti per tahun (hari)</span><input id="ej" type="text" inputmode="decimal" maxlength="5" placeholder="Kosongkan untuk 12" autocomplete="off"></label>
    <div class="err" id="eerr" role="alert"></div><button class="btn" type="submit">${ic('plus', 18)}Tambah Karyawan</button>
    <div class="sec"><h3 class="h" style="font-size:14px">Terdaftar (<span id="ecnt"></span>)</h3><small style="color:var(--ink2)">Ketuk jatah untuk mengubah</small></div>
    <div class="search" style="margin-bottom:8px">${ic('search', 20)}<input id="eq" type="search" placeholder="Cari nama atau jabatan..." autocomplete="off"></div><div id="elist"></div></form>`;
  const paint = () => {
    const t = $('#eq').value.trim().toLowerCase(), list = [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    $('#ecnt').textContent = list.length;
    $('#elist').innerHTML = list.filter(x => !t || (x.name + ' ' + x.title).toLowerCase().includes(t)).map(x => `<div class="li">${av(x, 's')}<div><b>${esc(x.name)}</b><small>${esc(x.title)}</small></div><button type="button" class="qb ${(quotas[x.id] || {}).src === 'file' ? 'f' : ''}" data-q="${x.id}" aria-label="Ubah jatah cuti ${esc(x.name)}">Jatah ${quotas[x.id] ? nf(quotas[x.id].q) : '…'}</button></div>`).join('') || '<div class="empty">Tidak ditemukan.</div>';
  };
  paint(); $('#eq').oninput = paint; empPaint = paint;
  $('#ep').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); };
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) { sh.hidden = true; empPaint = null; } };
  $('#ef').onsubmit = e => { e.preventDefault(); send({ type: 'addemp', name: $('#en').value, title: $('#et').value, pin: $('#ep').value, jatah: $('#ej').value }); };
}
function empMsg(m, ok) {
  const e = $('#eerr'); if (!e) return;
  e.textContent = m; e.style.color = ok ? 'var(--sec)' : 'var(--err)';
  if (ok) { ['#en', '#et', '#ep', '#ej'].forEach(i => ($(i).value = '')); $('#en').focus(); }
}
function pinErr(m) { const e = $('#perr'); if (e) e.textContent = m; }
function pinDone() {
  pinChanged = true; const sh = $('#sheet');
  sh.innerHTML = `<div class="sh"><h3>PIN berhasil diubah</h3><p style="margin:0 0 16px;color:var(--ink2)">Gunakan PIN baru saat masuk di perangkat lain. Perangkat lain yang sedang masuk akan diminta login ulang.</p><button class="btn" id="xs">Selesai</button></div>`;
  render();
}
function newSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  const list = [...users.values()].filter(x => x.id !== me).sort((a, b) => b.online - a.online || a.name.localeCompare(b.name));
  sh.innerHTML = `<div class="sh"><h3>Pesan Baru<button class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    ${list.length ? list.map(x => `<button class="li" data-u="${x.id}">${av(x, '', true)}<div><b>${esc(x.name)}</b><small>${esc(x.title)}</small></div></button>`).join('') : '<div class="empty">Belum ada rekan lain yang terdaftar.</div>'}</div>`;
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
}

// ---------- event ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-f],[data-u],[data-c],[data-go],[data-q],[data-att],[data-ak],[data-am],[data-sort],#adreset,#new,#pin,#emp,#cutiAdm,#attAdm,#copy,#logout,#bell,#meBtn');
  if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); $('#main').scrollTop = 0; }
  else if (t.dataset.q) {
    const u = users.get(t.dataset.q), cur = (quotas[t.dataset.q] || {}).q;
    const v = prompt(`Jatah cuti ${u ? u.name : ''} (hari per tahun):`, cur ?? '');
    if (v !== null) send({ type: 'setquota', id: t.dataset.q, quota: v });
  } else if (t.dataset.go) { tab = t.dataset.go; render(); }
  else if (t.dataset.f) { filter = t.dataset.f; renderChat(); }
  else if (t.hasAttribute('data-sort')) { attSort = attSort === 'desc' ? 'asc' : 'desc'; paintDetail(); }
  else if (t.dataset.am) setMonth(t.dataset.am);
  else if (t.id === 'adreset') setMonth('all');
  else if (t.dataset.att) openDetail(t.dataset.att);
  else if (t.dataset.ak) { attKind = t.dataset.ak; paintDetail(); }
  else if (t.dataset.c) openChat(t.dataset.c);
  else if (t.dataset.u) { $('#sheet').hidden = true; openChat(dmId(t.dataset.u)); }
  else if (t.id === 'new') newSheet();
  else if (t.id === 'pin') pinSheet();
  else if (t.id === 'emp') empSheet();
  else if (t.id === 'cutiAdm') cutiSheet();
  else if (t.id === 'attAdm') attSheet();
  else if (t.id === 'bell') { tab = 'chat'; filter = 'unread'; render(); }
  else if (t.id === 'meBtn') { tab = 'me'; render(); }
  else if (t.id === 'copy') { const s = t.querySelector('span:last-child') || t; try { navigator.clipboard.writeText(location.origin); } catch {} s.textContent = 'Alamat disalin'; setTimeout(render, 1200); }
  else if (t.id === 'logout' && confirm('Keluar dari akun ini di perangkat ini?')) { send({ type: 'logout' }); ls.del('hub-session'); location.reload(); }
});

$('#nav').innerHTML = ''; $('#title').textContent = TITLES.chat;
start();
})();
