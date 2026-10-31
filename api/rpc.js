(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = { doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4', cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z', phone: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18.5h2', news: 'M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2zM18 9h2a1 1 0 011 1v8a2 2 0 01-2 2M8 8h7M8 12h7M8 16h4', clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.5A8 8 0 1121 12z', person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6', search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5', bell: 'M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4', back: 'M15 5l-7 7 7 7', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', plus: 'M12 5v14M5 12h14', group: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M17 11a2.5 2.5 0 100-5M18 15c2 .4 3 2 3 5', chev: 'M9 5l7 7-7 7', pin: 'M12 17v5M8 3h8l-1 6 3 3H6l3-3z', out: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9', copy: 'M9 9h11v11H9zM5 15V4h11', close: 'M6 6l12 12M18 6L6 18', edit: 'M4 20h4L19 9l-4-4L4 16z', check: 'M5 12.5l4.5 4.5L19 7.5', upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', file: 'M6 3h8l4 4v14H6zM14 3v5h5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', link: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1' };
const ic = (n, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;
// Menu terakhir disimpan per tab browser: refresh tetap di menu yang sama, login baru selalu mulai dari Beranda
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }, del: k => { try { sessionStorage.removeItem(k); } catch {} } };
const savedTab = () => { const t = ss.get('hub-tab'); return ['home', 'chat', 'news', 'me', 'att', 'cuti', 'izin'].includes(t) ? t : 'home'; };
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const COL = [['#e3dfff', '#372abf'], ['#c9f7e3', '#005137'], ['#dce9ff', '#1f1ab3'], ['#ffe9cc', '#8a4b00'], ['#fde0ef', '#8f1f55']];

let session = ls.get('hub-session'), roster = [], pinChanged = true, authed = false;
// Splash tampil minimal 2 detik, lalu halaman login (atau aplikasi bila sesi masih berlaku)
let lastPin = '', forcePin = false, pinSet = false, splashOn = true;
const splashMin = new Promise(r => setTimeout(r, 2000));
function hideSplash() {
  if (!splashOn) return; splashOn = false;
  splashMin.then(() => { const l = $('#login'); if (l) l.classList.add('live'); const sp = $('#splash'); if (!sp) return; sp.classList.add('out'); setTimeout(() => sp.remove(), 800); });
}
const lastUser = () => { try { return JSON.parse(ls.get('hub-last') || 'null'); } catch { return null; } };
let helper = false, admRows = [], dev = null, devPending = 0, att = null, attU = null, attC = null, attSrc = null, attKind = 'telat', attFrom = null, attTo = null, attMonth = 'all', attSort = 'desc', quotas = {}, cuti = null, admin = false, empPaint = null, peer = {}, ws, me = null, users = new Map(), msgs = {}, reads = {}, tab = savedTab(), filter = 'all', q = '', open = null, typing = {}, connected = false;

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
const SEND = ['login', 'send', 'read', 'changepin', 'logout', 'addemp', 'setquota', 'delemp', 'checkin', 'checkout'];
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
  else if (d.type === 'emp_del') { users.delete(d.id); delete quotas[d.id]; if (open && open.includes(d.id)) { open = null; $('#chat').hidden = true; $('#chat').innerHTML = ''; } render(); if (empPaint) empPaint(); empMsg(`${d.name} berhasil dihapus.`, true, true); }
  else if (d.type === 'checkin_ok') { ci = d.ci; hcBusy = false; hcMsg = ''; addAttRow(d.ci.row); updHc(); if (tab === 'att') render(); }
  else if (d.type === 'checkout_ok') { ci = d.ci; hcBusy = false; hcMsg = ''; addAttRow(d.ci.row); updHc(); if (tab === 'att') render(); }
  else if (d.type === 'checkout_confirm') { hcBusy = false; updHc(); askEarlyOut(d.hm); }
  else if (d.type === 'checkin_err' || d.type === 'checkout_err') { hcBusy = false; hcMsg = d.msg; updHc(); }
  else if (d.type === 'emp_err') empMsg(d.msg, false);
  else if (d.type === 'cuti') { cuti = d.cuti; if (tab === 'me' || tab === 'cuti') render(); const ci = $('#cinfo'); if (ci) ci.innerHTML = cutiInfo(); }
  else if (d.type === 'quotas') { quotas = d.map; if (empPaint) empPaint(); }
  else if (d.type === 'quota_err') empMsg(d.msg, false);
  else if (d.type === 'pin_ok') pinDone();
  else if (d.type === 'pin_err') pinErr(d.msg);
  else if (d.type === 'init') {
    if (d.session) { const fresh = d.session !== session; session = d.session; ls.set('hub-session', session); if (fresh) tab = 'home'; } // login baru -> mulai dari Beranda; pemulihan sesi (refresh) -> menu terakhir
    authed = true; pinChanged = !!d.pinChanged || pinSet; hideSplash();
    { const m = d.users.find(x => x.id === d.me); if (m) ls.set('hub-last', JSON.stringify({ id: m.id, name: m.name, title: m.title })); }
    if (!pinChanged) { if (!forcePin) showSetPin(); } else { forcePin = false; $('#login').hidden = true; $('#login').innerHTML = ''; }
    me = d.me; admin = !!d.admin; helper = !!d.helper; dev = d.dev || null; devPending = d.devPending || 0; ci = d.ci || null; if (d.office) office = d.office; cuti = d.cuti; attC = d.chk && d.chk.has ? d.chk : null; setAtt(d.att); quotas = d.quotas || {}; peer = d.peer || {}; users = new Map(d.users.map(u => [u.id, u])); msgs = d.msgs; reads = d.reads; connected = true;
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
const TITLES = { home: 'Beranda', chat: 'Pesan Dan Obrolan', att: 'Absensi Karyawan', cuti: 'Informasi Cuti', izin: 'Izin Pulang', news: 'News Update', me: 'Profil Karyawan' };
const NAV = [['home', 'home', 'Beranda'], ['chat', 'chat', 'Obrolan'], ['news', 'news', 'News'], ['me', 'person', 'Profil']];
function paintNav(n, sub) { // menu dibuat sekali lalu hanya diubah kelasnya, supaya gelembung penanda bergeser dengan animasi halus
  const nav = $('#nav'); let first = false;
  if (!nav.dataset.built) {
    first = true; nav.classList.add('noanim'); nav.dataset.built = '1'; nav.style.setProperty('--n', NAV.length);
    nav.innerHTML = '<i class="nb"></i>' + NAV.map(([k, i, l]) => `<button data-tab="${k}"><span class="ni">${ic(i)}<span class="badge" hidden></span></span><span class="nl">${l}</span></button>`).join('');
  }
  const idx = Math.max(0, NAV.findIndex(([k]) => tab === k || (sub && k === 'home')));
  nav.style.setProperty('--i', idx);
  [...nav.querySelectorAll('button')].forEach((b, j) => {
    const on = j === idx, bg = b.querySelector('.badge'), k = NAV[j][0];
    b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    const show = k === 'chat' && n > 0; bg.hidden = !show; if (show) bg.textContent = n;
  });
  if (first) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove('noanim')));
}
function render() {
  if (!me) return;
  ss.set('hub-tab', tab);
  const u = users.get(me), n = totalUnread();
  $('#title').textContent = TITLES[tab]; $('#main').classList.remove('nw'); if (tab !== 'news') delete $('#main').dataset.nk; if (tab !== 'izin') delete $('#main').dataset.iz; if (tab !== 'home' && !(tab === 'izin' && izCo())) stopGeo();
  $('#meBtn').innerHTML = av(u, 's');
  $('#bell').innerHTML = ic('bell') + (n ? '<span class="dot"></span>' : '');
  document.title = (n ? `(${n}) ` : '') + 'Hub Karyawan';
  const sub = tab === 'att' || tab === 'cuti' || tab === 'izin'; // halaman yang dibuka dari kisi menu Beranda (tidak ada di menu bawah)
  $('#topback').hidden = !sub; $('#topback').innerHTML = ic('back'); document.querySelector('.brand .logo').hidden = sub;
  paintNav(n, sub);
  if (tab === 'chat') renderChat(); else if (tab === 'home') renderHome(); else if (tab === 'att') renderAtt(); else if (tab === 'cuti') renderCuti(); else if (tab === 'izin') renderIzin(); else if (tab === 'news') renderNews(); else renderMe();
}

const NEWS_URL = 'https://www.okezone.com/tag/dunia-kerja', NCATS = [['bisnis', 'Bisnis'], ['ekonomi', 'Ekonomi'], ['terkini', 'Terkini'], ['lifestyle', 'Lifestyle']];
let newsSrc = 'antara', newsCat = 'bisnis', newsMem = {};
const isPC = () => window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 6e4)); return !t ? '' : m < 60 ? `${m || 1} mnt lalu` : m < 1440 ? `${Math.floor(m / 60)} jam lalu` : m < 10080 ? `${Math.floor(m / 1440)} hari lalu` : new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
function renderNews(force) {
  const m = $('#main'), key = newsSrc + newsCat;
  if (!force && m.dataset.nk === key && m.firstChild) { if (newsSrc === 'okezone' && !isPC()) m.classList.add('nw'); return; } // render ulang karena pesan baru tidak boleh memuat ulang halaman
  m.dataset.nk = key;
  const seg = `<div class="nseg"><button data-ns="antara" class="${newsSrc === 'antara' ? 'on' : ''}">ANTARA News</button><button data-ns="okezone" class="${newsSrc === 'okezone' ? 'on' : ''}">Okezone</button></div>`;
  if (newsSrc === 'okezone') {
    if (isPC()) {
      m.innerHTML = seg + `<div class="card nwc"><div class="nwi">${ic('news', 30)}</div><h3>Okezone · Dunia Kerja</h3><p>Okezone tidak mengizinkan halamannya ditampilkan di dalam aplikasi pada tampilan komputer. Buka langsung di tab baru, atau akses Hub dari ponsel.</p><a class="btn" href="${NEWS_URL}" target="_blank" rel="noopener noreferrer">Buka Okezone Dunia Kerja</a></div>`;
    } else {
      m.classList.add('nw');
      m.innerHTML = `<div style="padding:0 16px">${seg}</div><div class="nbar"><span>Okezone · Dunia Kerja</span><a href="${NEWS_URL}" target="_blank" rel="noopener noreferrer">Buka di tab baru ${ic('chev', 14)}</a></div>
        <div class="nfr"><div class="nld">Memuat berita…<small>Jika tidak tampil, ketuk "Buka di tab baru".</small></div><iframe src="${NEWS_URL}" title="Okezone Dunia Kerja" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"></iframe></div>`;
    }
    return;
  }
  m.innerHTML = seg + `<div class="chips nchips">${NCATS.map(([k, l]) => `<button class="chip ${newsCat === k ? 'on' : ''}" data-nc="${k}">${l}</button>`).join('')}</div><div id="nlist"></div>
    <p class="nsrc">Sumber: <a href="https://www.antaranews.com" target="_blank" rel="noopener noreferrer">ANTARA News</a> (RSS resmi). Ketuk berita untuk membaca selengkapnya di situs aslinya.</p>`;
  const c = newsCat, hit = newsMem[c], el = $('#nlist');
  const paint = d => { if (newsCat !== c || !$('#nlist')) return; $('#nlist').innerHTML = d.items.length ? d.items.map(x => `<a class="nw-i" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div><b>${esc(x.title)}</b><p>${esc(x.sum)}</p><small>${esc(ago(x.time))}</small></div></a>`).join('') : '<div class="empty">Belum ada berita.</div>'; };
  if (hit && Date.now() - hit.t < 6e5) return paint(hit);
  el.innerHTML = '<div class="empty">Memuat berita…</div>';
  fetch('/api/news?c=' + c).then(r => r.json()).then(d => { if (!d.ok) throw 0; newsMem[c] = { t: Date.now(), items: d.items }; paint(newsMem[c]); })
    .catch(() => { if (newsCat === c && $('#nlist')) $('#nlist').innerHTML = hit ? (paint(hit), '') : '<div class="empty">Berita belum dapat dimuat. Coba lagi beberapa saat.</div>'; });
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

// ---------- Kehadiran hari ini (check-in GPS) ----------
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
let hc = null, hcMap = null, hcL = null, geo = { st: 'idle', lat: 0, lng: 0, acc: 0 }, geoW = null, ci = null, hcBusy = false, hcMsg = '', hcT = null, office = { lat: -6.8751736305230855, lng: 109.67676355886489, r: 15 };
const wibHM = ts => new Date(ts + 7 * 36e5).toISOString().slice(11, 16);
const gDist = (a, b, c, d) => { const r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742000 * Math.asin(Math.min(1, Math.sqrt(h))); };
const hq = x => hc.querySelector(x);
function loadLeaflet(cb) {
  if (window.L) return cb(true);
  if (hcL) return hcL.push(cb); hcL = [cb];
  const done = ok => { const l = hcL; hcL = null; l.forEach(f => f(ok)); };
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'; document.head.appendChild(css);
  const js = document.createElement('script'); js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'; js.onload = () => done(!!window.L); js.onerror = () => done(false); document.head.appendChild(js);
}
function startGeo(force) {
  if (geoW != null && !force) return;
  if (geoW != null) { navigator.geolocation.clearWatch(geoW); geoW = null; }
  if (!navigator.geolocation) { geo.st = 'nogeo'; return updHc(); }
  if (window.isSecureContext === false) { geo.st = 'insecure'; return updHc(); }
  geo.st = 'wait'; updHc();
  geoW = navigator.geolocation.watchPosition(p => { geo = { st: 'ok', lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 0 }; updHc(); },
    e => { if (e.code === 1) { geo.st = 'denied'; navigator.geolocation.clearWatch(geoW); geoW = null; } else geo.st = 'err'; updHc(); },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
}
function stopGeo() { if (geoW != null) { navigator.geolocation.clearWatch(geoW); geoW = null; } clearInterval(hcT); hcT = null; }
const geoInside = () => geo.st === 'ok' && geo.acc <= 150 && gDist(geo.lat, geo.lng, office.lat, office.lng) <= office.r;
function addAttRow(r) { // check-in baru -> data check-in (terpisah dari data unggahan admin)
  if (!attC) attC = { has: true, file: 'Check-in GPS', total: 0, people: 1, from: r.d, to: r.d, updatedAt: Date.now(), by: 'Check-in GPS', rows: [] };
  attC.rows = attC.rows.filter(x => x.d !== r.d); {
    attC.rows.push(r); attC.rows.sort((a, b) => (a.d < b.d ? 1 : -1)); attC.total = attC.rows.length; attC.updatedAt = Date.now();
    if (r.d < attC.from) attC.from = r.d; if (r.d > attC.to) attC.to = r.d;
  }
  useAtt();
}
function buildCard() {
  hc = document.createElement('div'); hc.className = 'hcard';
  hc.innerHTML = `<div class="hh"><span>Kehadiran Hari Ini</span><time class="hd"></time></div>
    <div class="hb"><div class="hl2"><div class="ht"><b class="htm">--:--</b><em class="hz"></em></div><span class="hbd no"></span><p class="hi"></p></div>
    <div class="hmap"><div class="hm"></div><button type="button" class="hpill wait"></button><span class="hattr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span></div></div>
    <p class="hmsg" hidden></p><button type="button" class="hgo"></button>`;
  hq('.hpill').onclick = () => { if (['denied', 'err', 'nogeo', 'insecure'].includes(geo.st)) startGeo(true); };
  hq('.hgo').onclick = () => doGo(false);
}
function doGo(confirm) {
  if ((ci && ci.out) || hcBusy || !geoInside()) return;
  hcBusy = true; hcMsg = ''; updHc();
  send({ type: ci ? 'checkout' : 'checkin', lat: geo.lat, lng: geo.lng, acc: geo.acc, confirm: !!confirm }).then(r => { if (!r) { hcBusy = false; hcMsg = 'Gagal terhubung ke server. Coba lagi.'; updHc(); } });
}
function askEarlyOut(hm) { // peringatan check out sebelum jam pulang kerja (16.00): wajib mengajukan izin pulang
  let m = $('#early'); if (m) m.remove();
  m = document.createElement('div'); m.id = 'early'; m.className = 'mdl';
  m.innerHTML = `<div class="mdb" role="alertdialog" aria-modal="true" aria-labelledby="eh"><div class="mdi">${ic('clock', 26)}</div><h3 id="eh">Belum Jam Pulang Kerja</h3>
    <p>Sekarang pukul <b>${esc(hm.replace(':', '.'))} WIB</b>. Jam pulang kerja adalah pukul <b>16.00</b>.</p><p class="mq">Untuk check out lebih awal, ajukan izin pulang terlebih dahulu.</p>
    <div class="mda col"><button type="button" class="btn" data-y>${ic('doc', 18)}Ajukan Izin Pulang</button><button type="button" class="btn sec2" data-n>Tutup</button></div></div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', esc_); }, esc_ = e => { if (e.key === 'Escape') close(); };
  m.querySelector('[data-n]').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  m.querySelector('[data-y]').onclick = () => { close(); tab = 'izin'; render(); $('#main').scrollTop = 0; };
  document.addEventListener('keydown', esc_); document.body.appendChild(m); m.querySelector('[data-y]').focus();
}
function initMap() {
  if (hcMap || !hc.isConnected || !hq('.hm').offsetWidth) return;
  loadLeaflet(ok => {
    if (!ok || hcMap || !hc.isConnected) return;
    const m = hcMap = L.map(hq('.hm'), { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false }).setView([office.lat, office.lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    hcMap._area = L.circle([office.lat, office.lng], { radius: office.r, color: '#0D429D', weight: 1.5, fillColor: '#3B6FD0', fillOpacity: .15 }).addTo(m);
    L.marker([office.lat, office.lng], { icon: L.divIcon({ className: '', html: '<div class="mpin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(m);
    hcMap._me = L.circleMarker([0, 0], { radius: 6, color: '#fff', weight: 2.5, fillColor: '#2563eb', fillOpacity: 1, opacity: 0 }).addTo(m);
    updMap();
  });
}
function updMap() {
  if (!hcMap) return;
  const key = geo.st + geo.lat.toFixed(5) + geo.lng.toFixed(5) + hq('.hm').offsetWidth; if (hcMap._key === key) return; hcMap._key = key; hcMap.invalidateSize();
  const b = hcMap._area.getBounds();
  if (geo.st === 'ok') { hcMap._me.setLatLng([geo.lat, geo.lng]).setStyle({ opacity: 1, fillOpacity: 1 }); hcMap.fitBounds(b.extend([geo.lat, geo.lng]), { padding: [16, 16], maxZoom: 18, animate: false }); }
  else { hcMap._me.setStyle({ opacity: 0, fillOpacity: 0 }); hcMap.fitBounds(b, { padding: [10, 10], maxZoom: 18, animate: false }); }
}
function updHc() {
  if (!hc) return;
  const d = new Date(), p2 = n => String(n).padStart(2, '0'), off = -d.getTimezoneOffset() / 60, inside = geoInside();
  hq('.htm').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`; hq('.hz').textContent = { 7: 'WIB', 8: 'WITA', 9: 'WIT' }[off] || 'GMT' + (off >= 0 ? '+' : '') + off;
  hq('.hd').textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  const dist = geo.st === 'ok' ? Math.round(gDist(geo.lat, geo.lng, office.lat, office.lng)) : 0, pill = hq('.hpill'), bd = hq('.hbd'), go = hq('.hgo'), msg = hq('.hmsg');
  const P = { wait: ['wait', 'Mencari lokasi…'], denied: ['bad', 'Izin lokasi ditolak'], err: ['bad', 'Lokasi tidak tersedia'], nogeo: ['bad', 'GPS tidak didukung'], insecure: ['bad', 'Perlu koneksi HTTPS'], idle: ['wait', 'Mencari lokasi…'] }[geo.st] || (geo.acc > 150 ? ['warn', 'Sinyal GPS lemah'] : inside ? ['ok', 'Lokasi Valid'] : ['warn', `Di luar area · ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'}`]);
  pill.className = 'hpill ' + P[0]; pill.textContent = P[1];
  const late = ci && ci.row.k === 'telat', early = ci && ci.out && ci.row.k === 'pulang';
  bd.className = 'hbd ' + (ci ? (late || early ? 'late' : 'ok') : 'no'); bd.innerHTML = ci ? (late ? 'Terlambat' : early ? 'Pulang Awal' : `Hadir ${ic('check', 13)}`) : 'Belum Check-in';
  hq('.hi').innerHTML = ci ? `${ic('clock', 14)}<span>Check in ${wibHM(ci.ts)} WIB${ci.out ? `<br>Check out ${wibHM(ci.out)} WIB` : ''}</span>` : inside ? `${ic('clock', 14)}Kamu berada di area kantor` : geo.st === 'denied' ? 'Aktifkan izin lokasi di browser, lalu ketuk label di peta.' : `${ic('clock', 14)}Belum check in hari ini`;
  const done = !!(ci && ci.out);
  go.disabled = done || hcBusy || !inside;
  go.innerHTML = done ? `${ic('check', 18)}Sudah Check Out` : hcBusy ? 'Memproses…' : ci ? `${ic('out', 18)}Check Out` : `${ic('clock', 18)}Check In`;
  msg.hidden = !hcMsg; msg.textContent = hcMsg;
  if (!done && !hcBusy && !inside && geo.st === 'ok' && geo.acc <= 150 && !hcMsg) { msg.hidden = false; msg.textContent = `${ci ? 'Check Out' : 'Check In'} aktif saat kamu berada dalam ${office.r} m dari lokasi kantor.`; }
  updMap();
}
function mountCard() {
  if (!hc) buildCard();
  const slot = $('#hcslot'); slot.replaceWith(hc);
  startGeo(); clearInterval(hcT); hcT = setInterval(() => { if (!hc.isConnected) { if (!(tab === 'izin' && izCo())) stopGeo(); return; } updHc(); }, 1000);
  updHc(); initMap(); if (hcMap) updMap();
}
function renderHome() {
  const u = users.get(me);
  $('#main').innerHTML = `<div class="gr"><h2>Halo, ${esc(u.name.split(' ').slice(0, 2).join(' '))} </h2><p>Selamat datang di Hub Karyawan · ${esc(u.title)}</p></div>
    ${devBanner()}
    <div id="hcslot"></div>
    ${homeMenu()}
    <div class="card"><b style="font-weight:600">Undang rekan kerja</b><p style="margin:4px 0 12px;color:var(--ink2)">Minta rekan membuka alamat ini di browser (satu jaringan Wi-Fi/LAN).</p>
    <button class="btn sec2" id="copy">${ic('copy', 18)}<span>${esc(location.origin)}</span></button></div>
    <div class="sec"><h3 class="h">Obrolan terbaru</h3></div><div class="threads" id="hthreads"></div>`;
  mountCard();
  const saved = filter; filter = 'all'; q = '';
  const items = convIds().filter(c => last(c)).sort((a, b) => last(b).time - last(a).time).slice(0, 3);
  $('#hthreads').innerHTML = items.length ? items.map(c => { const m = meta(c), l = last(c); return `<button class="th ${unread(c) ? 'u' : ''}" data-c="${esc(c)}">${m.av}<div class="bd"><div class="r1"><span class="nm">${esc(m.name)}</span><time>${shortT(l.time)}</time></div><p>${esc(l.text)}</p></div></button>`; }).join('') : '<div class="empty">Belum ada obrolan.</div>';
  filter = saved;
}

function renderMe() {
  const u = users.get(me);
  $('#main').innerHTML = `<div class="card prof">${av({ ...u, online: true }, 'xl', true)}<h2>${esc(u.name)}</h2><span class="pill">${esc(u.title)}</span><p>ID: KNT-${esc(me.slice(0, 4).toUpperCase())}</p><button class="btn sec2 sm" id="pin">${ic('edit', 16)}Ubah PIN</button></div>${devCard()}${admin || helper ? adminMenu() : ''}${pinChanged ? '' : '<div class="banner">Kamu masih memakai PIN bawaan. Ubah PIN lewat tombol di atas agar akunmu aman.</div>'}
    <div class="card" style="padding:4px 20px"><button class="li" id="copy"><span class="ic">${ic('link', 20)}</span><div><b>Alamat aplikasi</b><small>${esc(location.origin)}</small></div>${ic('copy', 18)}</button></div>
    <button class="btn out" id="logout">${ic('out', 20)}Keluar Akun</button><div class="ver">Portal Hub 1.0 · Mekar Jaya Sentosa</div>`;
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
const LGX_TOP = `<div class="lgx-top"><div class="lgc"><img src="/logo-mark.png" alt="Mjs Group"></div><b>Mjs Group</b>
  <svg viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 38C40 18 70 24 105 30S170 14 215 22s80-10 110-6 55 8 75 2V70H0z" fill="#fff" opacity=".28"/><path d="M0 48C50 30 90 40 135 44s90-22 140-16 85 14 125 4V70H0z" fill="#fff" opacity=".5"/><path d="M0 56C60 46 110 56 170 56s120-16 170-10 40 4 60 2V70H0z" fill="#fff"/></svg></div>`;
const eyeBtn = `<button type="button" class="eye" aria-label="Tampilkan PIN">${ic('eye', 20)}</button>`;
function eyeBind(root) { root.querySelectorAll('.eye').forEach(b => b.onclick = () => { const i = b.previousElementSibling, t = i.type === 'password'; root.querySelectorAll('.pw input').forEach(x => x.type = t ? 'text' : 'password'); }); }
function showLogin() {
  const el = $('#login'); el.hidden = false; forcePin = false; pinSet = false; lastPin = ''; el.classList.toggle('live', !splashOn);
  let sel = null; const lu = lastUser(); if (lu) sel = roster.find(r => r.id === lu.id) || null;
  const back = !!sel, nm = n => { const w = n.trim().split(/\s+/); return w.slice(0, 2).join(' '); };
  el.innerHTML = `<div class="lgx">${LGX_TOP}<form class="lgx-f" id="pf" autocomplete="off">
    <h2>${back ? 'Halo, ' + esc(nm(sel.name)) : 'Masuk ke Akun Anda'}</h2>
    <p class="lgx-s">${back ? 'Masukkan PIN untuk melanjutkan.' : 'Pertama kali masuk? Ketik namamu, lalu pakai PIN awal dari admin. Kamu akan diminta membuat PIN baru.'}</p>
    <label class="lf"><span>Nama (Username)</span><input id="un" type="text" placeholder="Ketik namamu" autocomplete="off" autocapitalize="words" spellcheck="false" value="${back ? esc(sel.name) : ''}"><div class="sug" id="sug" hidden></div></label>
    <label class="lf"><span>PIN</span><div class="pw"><input id="pn" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Masukkan PIN 6 angka" autocomplete="current-password">${eyeBtn}</div></label>
    <div class="err" id="lerr" role="alert"></div>
    <div class="lgx-btns"><button class="pill-b" id="go" type="submit">Masuk</button>${back ? '<button class="pill-o" id="chg" type="button">Ganti Akun</button>' : ''}</div></form></div>`;
  eyeBind(el);
  const un = $('#un'), sug = $('#sug'), norm = x => String(x || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const paint = () => {
    const t = norm(un.value); if (!t || (sel && norm(sel.name) === t)) { sug.hidden = true; return; }
    const list = roster.filter(r => norm(r.name + ' ' + r.title).includes(t)).slice(0, 6);
    sug.hidden = !list.length;
    sug.innerHTML = list.map(r => `<button type="button" class="li" data-r="${r.id}">${av(r, 's')}<div><b>${esc(r.name)}</b><small>${esc(r.title)}</small></div></button>`).join('');
  };
  const pick = r => { sel = r; un.value = r.name; sug.hidden = true; $('#pn').focus(); };
  un.oninput = () => { if (sel && norm(sel.name) !== norm(un.value)) sel = null; paint(); loginErr(''); };
  un.onfocus = paint;
  sug.onpointerdown = e => { const b = e.target.closest('[data-r]'); if (b) { e.preventDefault(); pick(roster.find(r => r.id === b.dataset.r)); } };
  if (back) { const c = $('#chg'); c.onclick = () => { ls.del('hub-last'); sel = null; un.value = ''; $('#pn').value = ''; $('.lgx-f h2').textContent = 'Masuk ke Akun Anda'; $('.lgx-s').textContent = 'Ketik namamu, lalu masukkan PIN.'; c.remove(); un.focus(); }; }
  $('#pn').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); };
  $('#pf').onsubmit = e => {
    e.preventDefault(); const pin = $('#pn').value;
    if (!sel) { const t = norm(un.value), ex = roster.filter(r => norm(r.name) === t), part = roster.filter(r => norm(r.name).includes(t)); sel = ex.length === 1 ? ex[0] : (t && part.length === 1 ? part[0] : null); if (sel) un.value = sel.name; }
    if (!sel) return loginErr('Nama tidak ditemukan. Ketik lalu pilih namamu dari daftar.', true);
    if (pin.length !== 6) return loginErr('PIN terdiri dari 6 angka.');
    lastPin = pin; const go = $('#go'); go.disabled = true; go.textContent = 'Memproses…';
    send({ type: 'login', id: sel.id, pin }).then(r => { if (!r) loginErr('Tidak dapat terhubung ke server. Coba lagi.'); });
  };
  hideSplash();
}
function loginErr(m, keep) { const e = $('#lerr'); if (e) e.textContent = m || ''; const go = $('#go'); if (go) { go.disabled = false; go.textContent = 'Masuk'; } if (m && !keep && $('#pn')) { $('#pn').value = ''; $('#pn').focus(); } }
// Login pertama (masih PIN bawaan): wajib membuat PIN baru sebelum memakai aplikasi
function showSetPin() {
  forcePin = true; const el = $('#login'); el.hidden = false; el.classList.add('live');
  const needOld = !lastPin, fld = (l, ac) => `<label class="lf"><span>${l}</span><div class="pw"><input class="pi" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6 angka" autocomplete="${ac}">${eyeBtn}</div></label>`;
  el.innerHTML = `<div class="lgx">${LGX_TOP}<form class="lgx-f" id="pnf" autocomplete="off">
    <h2>Buat PIN Baru</h2>
    <p class="lgx-s">Ini login pertamamu. Demi keamanan, ganti PIN bawaan dengan PIN pilihanmu sendiri sebelum melanjutkan.</p>
    ${needOld ? fld('PIN saat ini', 'current-password') : ''}${fld('PIN baru (6 angka)', 'new-password')}${fld('Ulangi PIN baru', 'new-password')}
    <div class="err" id="perr" role="alert"></div>
    <div class="lgx-btns"><button class="pill-b" id="sv" type="submit">Simpan &amp; Lanjutkan</button></div>
    <button class="lgx-link" type="button" id="lo">Keluar</button></form></div>`;
  eyeBind(el);
  const ins = [...el.querySelectorAll('.pi')]; ins[0].focus();
  ins.forEach(i => i.oninput = () => { i.value = i.value.replace(/\D/g, ''); });
  $('#lo').onclick = () => { send({ type: 'logout' }).finally(() => { ls.del('hub-session'); ss.del('hub-tab'); location.reload(); }); };
  $('#pnf').onsubmit = e => {
    e.preventDefault(); const v = ins.map(i => i.value), old = needOld ? v[0] : lastPin, b = v[needOld ? 1 : 0], c = v[needOld ? 2 : 1];
    if (needOld && old.length !== 6) return pinErr('PIN saat ini terdiri dari 6 angka.');
    if (b.length !== 6) return pinErr('PIN baru harus 6 angka.');
    if (b !== c) return pinErr('Pengulangan PIN tidak sama.');
    if (b === old) return pinErr('PIN baru tidak boleh sama dengan PIN lama.');
    const sv = $('#sv'); sv.disabled = true; sv.textContent = 'Menyimpan…'; pinErr('');
    send({ type: 'changepin', old, pin: b }).then(r => { if (!r) pinErr('Tidak dapat terhubung ke server. Coba lagi.'); });
  };
}
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
// Kisi menu di Beranda (tanpa judul): Absensi dan Info Cuti
function homeMenu() {
  const items = [['att', 'clock', 'Absensi', '#D97706', '#FEF3E2'], ['cuti', 'cal', 'Info Cuti', '#059669', '#E6F7F0'], ['izin', 'doc', 'Izin', '#7C3AED', '#F1EAFE']];
  return `<div class="card" style="padding:16px 12px 10px"><div class="mgrid">${items.map(([k, i, l, c, bg]) =>
    `<button class="mi" data-go="${k}"><span class="mic" style="background:${bg};color:${c}">${ic(i, 26)}</span><span class="ml">${l}</span></button>`).join('')}</div></div>`;
}
// ---------- Form Izin Pulang ----------
const IZIN_TIPE = ['Sakit', 'Orang Tua / Saudara Meninggal', 'Menjalani Pengobatan', 'Mengantar Anak', 'Mengantar Orang Tua / Saudara', 'Lain-lain'];
let izT = null, izOut = null;
const izCo = () => !!(ci && !ci.out); // sudah check in & belum check out: submit form izin = izin pulang + Check Out sekaligus
function izDT(d) {
  const off = -d.getTimezoneOffset() / 60, z = { 7: 'WIB', 8: 'WITA', 9: 'WIT' }[off] || 'GMT' + (off >= 0 ? '+' : '') + off, p2 = n => String(n).padStart(2, '0');
  return `${d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${p2(d.getHours())}.${p2(d.getMinutes())} ${z}`;
}
function renderIzin(force) {
  const m = $('#main'); if (!force && m.dataset.iz === '1' && m.firstChild) return; // render ulang oleh pesan baru tidak boleh menghapus isian form
  m.dataset.iz = '1'; izOut = null; if (izCo() && geoW == null) startGeo(); const u = users.get(me) || {}, pi = $('#izprint'); if (pi) pi.remove();
  m.innerHTML = `<div class="sec" style="margin:8px 0 10px"><div><h3 class="h">Form Izin Pulang</h3><small style="color:var(--ink2)">Isi form, lalu simpan sebagai gambar atau cetak.</small></div></div>${izCo() ? `<div class="izbn">${ic('clock', 18)}<span>Kamu sudah check in. Submit form ini akan <b>sekaligus mencatat Check Out</b>${new Date().getHours() < 16 ? ' dan keterangan izin pulang awal' : ''} di Absensi.</span></div>` : ''}
    <form class="card izf" id="izform" novalidate>
      <label class="fld"><span>Nama</span><input id="iz-n" value="${esc(u.name || '')}" readonly></label>
      <label class="fld"><span>Divisi</span><input id="iz-d" value="${esc(u.title || '')}" readonly></label>
      <label class="fld"><span>Tipe Izin Pulang</span><select id="iz-t" required><option value="" disabled selected>Pilih tipe izin…</option>${IZIN_TIPE.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="fld"><span>Alasan Pulang <b style="color:var(--err)">*</b></span><textarea id="iz-r" rows="4" maxlength="300" placeholder="Tuliskan alasan pulang…" required></textarea></label>
      <label class="fld"><span>Tanggal dan Jam Pulang</span><input id="iz-w" readonly></label>
      <div class="izm"><div class="fl">Mengetahui</div>
        <div class="izs"><div><div class="izb izb-e"></div><small>HRD</small></div>
        <div><div class="izb"><canvas id="iz-s" aria-label="Tanda tangan user"></canvas><button type="button" id="iz-c" class="izc">Hapus</button></div><small>User · tanda tangan di kotak</small></div></div></div>
      <div class="err" id="iz-e" role="alert"></div>
      <button class="btn" type="submit">${ic('check', 18)}${izCo() ? 'Submit & Check Out' : 'Submit'}</button></form><div id="izres"></div>`;
  const cv = $('#iz-s'), fit = () => { const r = cv.getBoundingClientRect(), k = devicePixelRatio || 1; if (cv._w !== r.width) { cv._w = r.width; cv.width = r.width * k; cv.height = r.height * k; cv.getContext('2d').scale(k, k); cv.dirty = false; } };
  fit(); const g = cv.getContext('2d'); g.lineWidth = 2.2; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0b1c30'; let dr = false;
  const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { dr = true; cv.setPointerCapture(e.pointerId); g.beginPath(); const [x, y] = pt(e); g.moveTo(x, y); g.lineTo(x + .1, y + .1); g.stroke(); cv.dirty = true; e.preventDefault(); };
  cv.onpointermove = e => { if (!dr) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { dr = false; };
  $('#iz-c').onclick = () => { g.clearRect(0, 0, cv.width, cv.height); cv.dirty = false; };
  const tick = () => { const w = $('#iz-w'); if (!w || tab !== 'izin') { clearInterval(izT); izT = null; return; } if (!izOut) w.value = izDT(new Date()); };
  tick(); clearInterval(izT); izT = setInterval(tick, 1000);
  $('#izform').onsubmit = async e => {
    e.preventDefault(); const err = $('#iz-e'), tp = $('#iz-t').value, rs = $('#iz-r').value.replace(/\s+/g, ' ').trim();
    if (!tp) { err.textContent = 'Pilih tipe izin pulang.'; return $('#iz-t').focus(); }
    if (rs.length < 3) { err.textContent = 'Alasan pulang wajib diisi.'; return $('#iz-r').focus(); }
    err.textContent = ''; const now = new Date(), btn = e.submitter;
    const co = izCo();
    if (co && !geoInside()) { err.textContent = geo.st === 'ok' ? `Check Out hanya bisa dari area kantor (maksimal ${office.r} m). Posisimu saat ini di luar area.` : 'Lokasi belum terdeteksi. Aktifkan GPS lalu coba lagi.'; return; }
    izOut = { name: u.name || '', div: u.title || '', tipe: tp, alasan: rs, dt: izDT(now), sig: cv.dirty ? cv : null, co };
    if (btn) btn.disabled = true;
    if (co) { // check out dicatat bersama izin pulang awal (keterangan izin hanya disimpan bila sebelum 16.00)
      const r = await send({ type: 'checkout', lat: geo.lat, lng: geo.lng, acc: geo.acc, izin: { tipe: tp, alasan: rs } });
      if (!r || r.type !== 'checkout_ok') { err.textContent = !r ? 'Gagal terhubung ke server. Coba lagi.' : r.type === 'checkout_confirm' ? 'Check Out belum dapat dicatat. Coba lagi.' : (r.msg || 'Check Out gagal.'); izOut = null; if (btn) btn.disabled = false; return; }
      hcMsg = '';
    }
    try { const c = await drawIzin(izOut); izOut.url = c.toDataURL('image/jpeg', .93); } catch { err.textContent = 'Gagal membuat gambar.'; izOut = null; if (btn) btn.disabled = false; return; }
    $('#izform').hidden = true; 
    $('#izres').innerHTML = `<div class="card izr"><div class="sec" style="margin:0 0 10px"><h3 class="h" style="font-size:15px">${izOut.co ? 'Check Out &amp; izin pulang tercatat' : 'Izin pulang terkirim'}</h3><span class="aktif">Selesai</span></div>
      <img class="izimg" src="${izOut.url}" alt="Form izin pulang ${esc(izOut.name)}">
      <div class="izact"><button class="btn" id="iz-dl">${ic('copy', 18)}Simpan JPG</button><button class="btn sec2" id="iz-pr">${ic('doc', 18)}Cetak</button></div>
      <button class="btn sec2" id="iz-new" style="margin-top:10px">${ic('plus', 18)}Buat Izin Baru</button></div>`;
    $('#iz-dl').onclick = () => { const a = document.createElement('a'); a.href = izOut.url; a.download = `Izin-Pulang_${izOut.name.replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.jpg`; document.body.appendChild(a); a.click(); a.remove(); };
    $('#iz-pr').onclick = () => { let p = $('#izprint'); if (!p) { p = document.createElement('div'); p.id = 'izprint'; document.body.appendChild(p); } p.innerHTML = `<img src="${izOut.url}" alt="">`; const im = p.querySelector('img'); (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => window.print()); };
    $('#iz-new').onclick = () => renderIzin(true);
    $('#izres').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}
const IZ_LOGO = 'data:image/jpeg;base64,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';
function izWrap(g, text, maxW) { const out = []; let line = ''; for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; } } if (line) out.push(line); return out; }
async function drawIzin(o) {
  try { await Promise.all(['400', '600', '700'].map(w => document.fonts.load(`${w} 30px "Plus Jakarta Sans"`))); } catch {}
  const logo = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = IZ_LOGO; }); // logo disematkan agar selalu muncul di hasil JPG
  const W = 1000, M = 72, F = '"Plus Jakarta Sans", system-ui, sans-serif', c = document.createElement('canvas'), g0 = c.getContext('2d');
  g0.font = `500 32px ${F}`; const LW = 300, VW = W - M * 2 - LW - 24, rows = [['Nama', o.name], ['Divisi', o.div], ['Tipe Izin Pulang', o.tipe], ['Alasan Pulang', o.alasan], ['Tanggal dan Jam Pulang', o.dt]].map(([l, v]) => [l, izWrap(g0, v, VW)]);
  g0.font = `700 28px ${F}`; rows.forEach(r => { r[2] = izWrap(g0, r[0], LW); });
  const rowH = r => Math.max(r[1].length, r[2].length) * 46 + 26, tableH = rows.reduce((a, r) => a + rowH(r), 0), top = 250, sigTop = top + tableH + 70, H = sigTop + 460;
  c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0D429D'; g.fillRect(0, 0, W, 14);
  if (logo) g.drawImage(logo, M, 44, 98, Math.round(98 * logo.height / logo.width));
  g.textBaseline = 'alphabetic'; g.fillStyle = '#0b1c30'; g.font = `700 30px ${F}`; g.fillText('Mjs Group', M + (logo ? 120 : 0), 88); g.font = `500 22px ${F}`; g.fillStyle = '#44505f'; g.fillText('Mekar Jaya Sentosa', M + (logo ? 120 : 0), 122);
  g.textAlign = 'center'; g.fillStyle = '#0D429D'; g.font = `800 48px ${F}`; g.fillText('FORM IZIN PULANG', W / 2, 210); g.textAlign = 'left';
  g.strokeStyle = '#cbd5e1'; g.lineWidth = 2; g.beginPath(); g.moveTo(M, 236); g.lineTo(W - M, 236); g.stroke();
  let y = top;
  rows.forEach(r => {
    const h = rowH(r); g.fillStyle = '#334155'; g.font = `700 28px ${F}`; r[2].forEach((t, i) => g.fillText(t, M, y + 40 + i * 46)); g.fillText(':', M + LW, y + 40);
    g.fillStyle = '#0b1c30'; g.font = `500 32px ${F}`; r[1].forEach((t, i) => g.fillText(t, M + LW + 24, y + 40 + i * 46));
    g.strokeStyle = '#e2e8f0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(M, y + h); g.lineTo(W - M, y + h); g.stroke(); y += h;
  });
  g.fillStyle = '#0b1c30'; g.font = `700 32px ${F}`; g.fillText('Mengetahui,', M, sigTop);
  const bw = 380, bx = [M, W - M - bw], by = sigTop + 64, bh = 190;
  [['HRD', null, '(............................)'], ['User', o.sig, `( ${o.name} )`]].forEach(([lb, sig, nm], i) => {
    const x = bx[i]; g.textAlign = 'center'; g.fillStyle = '#334155'; g.font = `700 28px ${F}`; g.fillText(lb, x + bw / 2, by + 6);
    g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.setLineDash([8, 6]); g.strokeRect(x, by + 22, bw, bh); g.setLineDash([]);
    if (sig) { const k = Math.min((bw - 20) / sig.width, (bh - 20) / sig.height); g.drawImage(sig, x + (bw - sig.width * k) / 2, by + 22 + (bh - sig.height * k) / 2, sig.width * k, sig.height * k); }
    g.fillStyle = '#0b1c30'; g.font = `600 26px ${F}`; g.fillText(nm.length > 30 ? nm.slice(0, 29) + '…)' : nm, x + bw / 2, by + bh + 70); g.textAlign = 'left';
  });
  g.fillStyle = '#64748b'; g.font = `400 20px ${F}`; g.textAlign = 'center'; g.fillText(`Dibuat melalui Portal Hub · ${o.dt}`, W / 2, H - 28); g.textAlign = 'left';
  return c;
}
function renderCuti() { $('#main').innerHTML = cutiHTML(); }
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
  if (r.iz) return r.s; // izin pulang awal dari form: keterangan sudah lengkap
  let t = r.s;
  if (r.k !== 'telat' && /terlambat/i.test(t)) t = t.replace(/(datang\s+)?terlambat/i, 'Toleransi').replace(r.m > 15 ? /\s*\d+\s*menit/i : /$^/, '');
  const o = String(r.a || '').match(/-\s*(\d{1,2})[.:](\d{2})\s*$/), early = o && +o[1] * 60 + +o[2] < 960;
  if (early && !/pulang awal/i.test(t) && ['ontime', 'pulang', 'telat'].includes(r.k)) t += ' · Pulang awal (sebelum 16.00)';
  if (r.k === 'ontime' && /pulang awal/i.test(t)) t = /^\s*pulang awal/i.test(t) ? 'Tepat Waktu' : t.replace(/\s*dan\s+pulang awal(\s+\d+\s*menit)?/i, '');
  return t;
};
const jam = a => {
  if (!a) return '';
  const m = String(a).match(/^(\d{1,2})[.:](\d{2})\s*-\s*(?:(\d{1,2})[.:](\d{2})|\?)$/);
  if (!m) return esc(a);
  return `${m[1].padStart(2, '0')}:${m[2]} – ${m[3] ? m[3].padStart(2, '0') + ':' + m[4] : '?'}`;
};
function setAtt(a) { // data unggahan admin baru -> filter tanggal dikembalikan ke semua
  const prev = attU && attU.updatedAt; attU = a && a.has ? a : null;
  if (!attU || attU.updatedAt !== prev) { attFrom = attTo = null; attMonth = 'all'; }
  useAtt();
}
function useAtt(reset) { // sumber yang tampil di menu Absensi: 'upload' (Excel admin) atau 'chk' (check-in GPS)
  if (!attSrc) attSrc = attU ? 'upload' : 'chk';
  att = attSrc === 'chk' ? attC : attU;
  if (reset) { attFrom = attTo = null; attMonth = 'all'; attKind = 'telat'; }
}
const attSeg = () => `<div class="nseg" style="margin-bottom:12px"><button data-as="chk" class="${attSrc === 'chk' ? 'on' : ''}">Check-in${attC ? ` (${attC.rows.length})` : ''}</button><button data-as="upload" class="${attSrc === 'upload' ? 'on' : ''}">Data Admin${attU ? ` (${attU.rows.length})` : ''}</button></div>`;
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
  useAtt(); const a = att, head = '<div class="sec" style="margin:0 0 10px"><h3 class="h">Rekap Absensi</h3></div>' + attSeg();
  if (!a || !a.has) { $('#main').innerHTML = head + `<div class="empty">${attSrc === 'chk' ? 'Belum ada check-in. Lakukan Check In dari Beranda saat berada di lokasi kantor.' : 'Data absensi belum tersedia. Admin belum mengunggah data absensi.'}</div>`; return; }
  const foot = `<div class="ver" style="text-align:left;font-weight:400;margin:4px 0 14px">${attSrc === 'chk' ? 'Berdasarkan check-in GPS di aplikasi' : `Data diperbarui ${fmtDT(a.updatedAt)} oleh ${esc(a.by)}`}</div>`;
  if (!a.rows.length) { $('#main').innerHTML = head + '<div class="empty">Belum ada catatan absensi atas namamu pada periode ini. Jika menurutmu keliru, hubungi admin.</div>' + foot; return; }
  if (!$('#attres') || !$('#main').querySelector('[data-as].on') || $('#main').dataset.as !== attSrc) {
    $('#main').dataset.as = attSrc;
    $('#main').innerHTML = attSeg() + `<div class="sec" style="margin:0 0 10px"><div><h3 class="h">Rekap Absensi</h3><small id="attper" style="color:var(--ink2)"></small></div></div>
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
  const a = attU && attU.has ? attU : null;
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
// ---------- Perangkat (cegah check in lewat ponsel orang lain) ----------
// Menu admin berbentuk kisi ikon (4 kolom), seperti menu utama aplikasi mobile
function adminMenu() {
  const all = [['emp', 'group', 'Kelola Karyawan', '#1F55C8', '#E8F0FE'], ['cutiAdm', 'cal', 'Data Cuti', '#059669', '#E6F7F0'], ['attAdm', 'clock', 'Data Absensi', '#D97706', '#FEF3E2'], ['devAdm', 'phone', 'Perangkat Karyawan', '#7C3AED', '#F1EAFE'], ['admAdm', 'shield', 'Kelola Admin', '#DB2777', '#FDE8F3']];
  const items = admin ? all : all.filter(i => ['cutiAdm', 'attAdm'].includes(i[0])); // admin pembantu: hanya Data Cuti dan Data Absensi
  return `<div class="card" style="padding:16px 12px 10px"><h3 class="h" style="font-size:16px;margin:0 6px 12px">${admin ? 'Menu Admin' : 'Menu Admin Data'}</h3><div class="mgrid">${items.map(([id, i, l, c, bg]) =>
    `<button class="mi" id="${id}"><span class="mic" style="background:${bg};color:${c}">${ic(i, 26)}${id === 'devAdm' && devPending ? `<i class="mb">${devPending}</i>` : ''}</span><span class="ml">${l}</span></button>`).join('')}</div></div>`;
}
// ---------- Kelola admin pembantu (khusus admin utama) ----------
function admPaint() {
  const el = $('#alist'); if (!el) return;
  const t = ($('#aq').value || '').trim().toLowerCase(), hs = admRows.filter(x => x.helper);
  $('#acnt').textContent = hs.length;
  const row = x => `<div class="li">${av(x, 's')}<div><b>${esc(x.name)}</b><small>${esc(x.title)}</small></div><button type="button" class="chip ${x.helper ? '' : 'on'}" data-hl="${x.id}|${x.helper ? 0 : 1}">${x.helper ? 'Cabut' : 'Jadikan admin'}</button></div>`;
  const list = admRows.filter(x => !t || (x.name + ' ' + x.title).toLowerCase().includes(t)).sort((a, b) => (b.helper - a.helper) || a.name.localeCompare(b.name));
  el.innerHTML = list.map(row).join('') || '<div class="empty">Tidak ditemukan.</div>';
}
async function admLoad(body) {
  const r = await api(body); if (!r || r.type !== 'adminlist') { const e = $('#alist'); if (e) e.innerHTML = '<div class="empty">Gagal memuat. Coba lagi.</div>'; return; }
  admRows = r.list; admPaint();
}
async function admSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<div class="sh"><h3>Kelola Admin<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    <p style="margin:0 0 10px;color:var(--ink2);font-size:13px;line-height:20px">Pilih karyawan yang boleh membantu menginput data. <b>Admin pembantu</b> hanya melihat menu <b>Data Cuti</b> dan <b>Data Absensi</b> (unggah berkas Excel). Menu lain tetap khusus admin utama. Jumlahnya bebas, dan bisa dicabut kapan saja.</p>
    <div class="sec" style="margin:8px 0"><h3 class="h" style="font-size:14px">Admin pembantu (<span id="acnt">0</span>)</h3></div>
    <div class="search" style="margin-bottom:8px">${ic('search', 20)}<input id="aq" type="search" placeholder="Cari nama atau jabatan..." autocomplete="off"></div><div id="alist"><div class="empty">Memuat…</div></div></div>`;
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
  $('#aq').oninput = admPaint;
  await admLoad({ a: 'adminlist' });
}
function devBanner() {
  if (dev && dev.on && dev.status === 'pending') return '<div class="banner" style="margin:0 0 12px"><b>Perangkat ini belum disetujui admin.</b> Chat tetap bisa dipakai, tetapi check in/out hanya dari ponselmu sendiri yang sudah terdaftar. Permintaan persetujuan sudah dikirim ke admin.</div>';
  if (admin && devPending) return `<div class="banner" style="margin:0 0 12px"><b>${devPending} perangkat karyawan menunggu persetujuan.</b> Buka Profil → Perangkat Karyawan.</div>`;
  return '';
}
function devCard() {
  if (!dev || !dev.on) return '';
  const ok = dev.status === 'approved';
  return `<div class="card li" style="padding:14px 20px"><span class="ic ${ok ? 'ok' : ''}">${ic(ok ? 'check' : 'clock', 20)}</span><div><b>Perangkat ini</b><small>${esc(dev.label)} · ${ok ? 'Terdaftar untuk check in' : 'Menunggu persetujuan admin'}</small></div></div>`;
}
async function devSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<div class="sh"><h3>Perangkat Karyawan<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3><div id="dvb"><div class="empty">Memuat…</div></div></div>`;
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
  await devLoad({ a: 'devlist' });
}
async function devLoad(body) {
  const r = await api(body), el = $('#dvb'); if (!el) return;
  if (!r || r.type !== 'devlist') { el.innerHTML = '<div class="empty">Gagal memuat. Coba lagi.</div>'; return; }
  const pend = r.list.filter(x => x.status === 'pending'), appr = r.list.filter(x => x.status === 'approved');
  const row = (x, btns) => `<div class="li" style="align-items:flex-start"><div><b>${esc(x.name)}${x.shared ? ' <span class="pill" style="background:#fef2f2;color:var(--err)">dipakai &gt;1 akun</span>' : ''}</b><small>${esc(x.label)}${x.title ? ' · ' + esc(x.title) : ''}<br>Pertama terlihat ${fmtDT(x.created)}</small></div><div style="display:flex;gap:6px;flex:none">${btns}</div></div>`;
  el.innerHTML = `<p style="margin:0 0 10px;color:var(--ink2);font-size:13px;line-height:20px">Check in/out hanya bisa dari perangkat yang disetujui di sini (satu akun satu perangkat). Menyetujui perangkat baru otomatis menggantikan perangkat lama akun itu. Periksa nama dan jenis ponselnya sebelum menyetujui.</p>
    ${r.msg ? `<div class="err" style="color:var(--sec);margin:0 0 8px">${esc(r.msg)}</div>` : ''}
    <div class="sec" style="margin:8px 0 0"><h3 class="h" style="font-size:14px">Menunggu persetujuan (${pend.length})</h3>${pend.length > 1 ? '<button class="chip" id="dvall">Setujui semua</button>' : ''}</div>
    ${pend.map(x => row(x, `<button class="chip on" data-dva="${x.uid}|${x.dh}">Setujui</button><button class="chip" data-dvr="${x.uid}|${x.dh}">Tolak</button>`)).join('') || '<div class="empty" style="margin:8px 0">Tidak ada permintaan.</div>'}
    <div class="sec" style="margin:16px 0 0"><h3 class="h" style="font-size:14px">Terdaftar (${appr.length})</h3></div>
    ${appr.map(x => row(x, `<button class="chip" data-dvr="${x.uid}|${x.dh}">Cabut</button>`)).join('') || '<div class="empty" style="margin:8px 0">Belum ada perangkat terdaftar.</div>'}`;
}
function empSheet() {
  const sh = $('#sheet'); sh.hidden = false;
  sh.innerHTML = `<form class="sh" id="ef"><h3>Tambah Karyawan<button type="button" class="icon-btn" id="xs" aria-label="Tutup">${ic('close')}</button></h3>
    <label class="fld"><span>Nama lengkap</span><input id="en" maxlength="40" required autocomplete="off"></label>
    <label class="fld"><span>Jabatan</span><input id="et" maxlength="40" required placeholder="Contoh: Staff Finance" autocomplete="off"></label>
    <label class="fld"><span>PIN awal (6 angka)</span><input id="ep" type="text" inputmode="numeric" maxlength="6" placeholder="Kosongkan untuk 123456" autocomplete="off"></label>
    <label class="fld"><span>Jatah cuti per tahun (hari)</span><input id="ej" type="text" inputmode="decimal" maxlength="5" placeholder="Kosongkan untuk 12" autocomplete="off"></label>
    <div class="err" id="eerr" role="alert"></div><button class="btn" type="submit">${ic('plus', 18)}Tambah Karyawan</button>
    <div class="sec"><h3 class="h" style="font-size:14px">Terdaftar (<span id="ecnt"></span>)</h3><small style="color:var(--ink2)">Ketuk jatah untuk mengubah · ✕ untuk menghapus</small></div>
    <div class="search" style="margin-bottom:8px">${ic('search', 20)}<input id="eq" type="search" placeholder="Cari nama atau jabatan..." autocomplete="off"></div><div id="elist"></div></form>`;
  const paint = () => {
    const t = $('#eq').value.trim().toLowerCase(), list = [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    $('#ecnt').textContent = list.length;
    $('#elist').innerHTML = list.filter(x => !t || (x.name + ' ' + x.title).toLowerCase().includes(t)).map(x => `<div class="li">${av(x, 's')}<div><b>${esc(x.name)}</b><small>${esc(x.title)}</small></div><button type="button" class="qb ${(quotas[x.id] || {}).src === 'file' ? 'f' : ''}" data-q="${x.id}" aria-label="Ubah jatah cuti ${esc(x.name)}">Jatah ${quotas[x.id] ? nf(quotas[x.id].q) : '…'}</button>${x.id === me || x.admin ? '' : `<button type="button" class="db" data-del="${x.id}" aria-label="Hapus ${esc(x.name)}">${ic('close', 16)}</button>`}</div>`).join('') || '<div class="empty">Tidak ditemukan.</div>';
  };
  paint(); $('#eq').oninput = paint; empPaint = paint;
  $('#ep').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); };
  sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) { sh.hidden = true; empPaint = null; } };
  $('#elist').onclick = e => {
    const b = e.target.closest('[data-del]'); if (!b) return; const u = users.get(b.dataset.del); if (!u) return;
    if (confirm(`Hapus karyawan ${u.name}?\n\nAkun, data cuti, data absensi, dan pesannya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`)) send({ type: 'delemp', id: u.id });
  };
  $('#ef').onsubmit = e => { e.preventDefault(); send({ type: 'addemp', name: $('#en').value, title: $('#et').value, pin: $('#ep').value, jatah: $('#ej').value }); };
}
function empMsg(m, ok, keep) {
  const e = $('#eerr'); if (!e) return;
  e.textContent = m; e.style.color = ok ? 'var(--sec)' : 'var(--err)';
  if (ok && !keep) { ['#en', '#et', '#ep', '#ej'].forEach(i => ($(i).value = '')); $('#en').focus(); }
}
function pinErr(m) { const e = $('#perr'); if (e) e.textContent = m; const sv = $('#sv'); if (sv && m) { sv.disabled = false; sv.innerHTML = 'Simpan &amp; Lanjutkan'; } }
function pinDone() {
  pinChanged = true; pinSet = true; const sh = $('#sheet');
  if (forcePin) {
    forcePin = false; lastPin = ''; $('#login').hidden = true; $('#login').innerHTML = '';
    sh.hidden = false; sh.onclick = e => { if (e.target === sh || e.target.closest('#xs')) sh.hidden = true; };
    sh.innerHTML = `<div class="sh"><h3>PIN berhasil dibuat</h3><p style="margin:0 0 16px;color:var(--ink2)">Mulai sekarang gunakan PIN barumu untuk masuk. Selamat datang di Portal Hub!</p><button class="btn" id="xs">Mulai</button></div>`;
    render(); return;
  }
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
  const t = e.target.closest('[data-tab],[data-f],[data-u],[data-c],[data-go],#topback,[data-q],[data-att],[data-ak],[data-am],[data-ns],[data-nc],[data-as],[data-sort],#adreset,#new,#pin,#emp,#cutiAdm,#attAdm,#devAdm,#admAdm,[data-hl],#dvall,[data-dva],[data-dvr],#copy,#logout,#bell,#meBtn');
  if (!t) return;
  if (t.dataset.as) { attSrc = t.dataset.as; useAtt(true); $('#main').dataset.as = ''; renderAtt(); $('#main').scrollTop = 0; return; }
  if (t.dataset.ns) { newsSrc = t.dataset.ns; renderNews(true); return; }
  if (t.dataset.nc) { newsCat = t.dataset.nc; renderNews(true); return; }
  if (t.dataset.tab) { tab = t.dataset.tab; render(); $('#main').scrollTop = 0; }
  else if (t.dataset.q) {
    const u = users.get(t.dataset.q), cur = (quotas[t.dataset.q] || {}).q;
    const v = prompt(`Jatah cuti ${u ? u.name : ''} (hari per tahun):`, cur ?? '');
    if (v !== null) send({ type: 'setquota', id: t.dataset.q, quota: v });
  } else if (t.dataset.go) { tab = t.dataset.go; render(); $('#main').scrollTop = 0; }
  else if (t.id === 'topback') { tab = 'home'; render(); $('#main').scrollTop = 0; }
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
  else if (t.id === 'devAdm') devSheet();
  else if (t.id === 'admAdm') admSheet();
  else if (t.dataset.hl) admLoad({ a: 'sethelper', id: t.dataset.hl.split('|')[0], on: t.dataset.hl.split('|')[1] === '1' });
  else if (t.id === 'dvall') { if (confirm('Setujui perangkat untuk semua akun yang belum punya perangkat terdaftar?\nPastikan daftar nama dan jenis ponselnya sudah kamu periksa.')) devLoad({ a: 'devapproveall' }); }
  else if (t.dataset.dva) devLoad({ a: 'devapprove', uid: t.dataset.dva.split('|')[0], dh: t.dataset.dva.split('|')[1] });
  else if (t.dataset.dvr) { if (confirm('Cabut/tolak perangkat ini?')) devLoad({ a: 'devrevoke', uid: t.dataset.dvr.split('|')[0], dh: t.dataset.dvr.split('|')[1] }); }
  else if (t.id === 'bell') { tab = 'chat'; filter = 'unread'; render(); }
  else if (t.id === 'meBtn') { tab = 'me'; render(); }
  else if (t.id === 'copy') { const s = t.querySelector('span:last-child') || t; try { navigator.clipboard.writeText(location.origin); } catch {} s.textContent = 'Alamat disalin'; setTimeout(render, 1200); }
  else if (t.id === 'logout' && confirm('Keluar dari akun ini di perangkat ini?')) { send({ type: 'logout' }).finally(() => { ls.del('hub-session'); ss.del('hub-tab'); location.reload(); }); }
});

$('#nav').innerHTML = ''; $('#title').textContent = TITLES.home;
start();
})();
