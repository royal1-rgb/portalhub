// Server lokal untuk uji coba: node dev.js (butuh DATABASE_URL). Di Vercel, berkas ini tidak dipakai.
const http = require('http'), fs = require('fs'), path = require('path');
const rpc = require('./api/rpc.js'), PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/rpc') return rpc(req, res);
  if (req.url.split('?')[0] === '/api/news') { const u = new URL(req.url, 'http://x'); req.query = Object.fromEntries(u.searchParams); res.status = c => (res.statusCode = c, res); res.json = o => (res.setHeader('content-type', 'application/json'), res.end(JSON.stringify(o))); return require('./api/news.js')(req, res); }
  const p = req.url.split('?')[0], f = path.join(PUB, path.normalize(p === '/' ? '/index.html' : p));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(process.env.PORT || 3000, () => console.log('Dev server: http://localhost:' + (process.env.PORT || 3000)));
