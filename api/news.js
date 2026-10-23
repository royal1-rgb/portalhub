// Berita dari RSS resmi ANTARA News (https://www.antaranews.com/rss). Hanya judul, ringkasan singkat, gambar, dan tautan ke artikel asli.
const FEEDS = { bisnis: 'ekonomi-bisnis', ekonomi: 'ekonomi', terkini: 'terkini', lifestyle: 'lifestyle' };
const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&');
const unwrap = s => ent(String(s || '').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ''));
const text = s => unwrap(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };
function parse(xml) {
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) || []).slice(0, 25).map(it => {
    const link = text(tag(it, 'link')), img = (it.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '', t = Date.parse(text(tag(it, 'pubDate')));
    const sum = text(tag(it, 'content:encoded') || tag(it, 'description')).slice(0, 220);
    return { title: text(tag(it, 'title')), link, img: /^https:\/\//.test(img) ? img : '', time: isNaN(t) ? 0 : t, sum };
  }).filter(x => x.title && /^https:\/\/([a-z0-9-]+\.)?antaranews\.com\//.test(x.link));
}
module.exports = async (req, res) => {
  const k = FEEDS[String(req.query && req.query.c || 'bisnis')] ? String(req.query.c || 'bisnis') : 'bisnis';
  try {
    const r = await fetch(`https://www.antaranews.com/rss/${FEEDS[k]}.xml`, { headers: { 'user-agent': 'HubKaryawan/1.0 (RSS reader)', accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ ok: true, source: 'ANTARA News', cat: k, items: parse(await r.text()) });
  } catch (e) { res.status(502).json({ ok: false, error: 'Berita belum dapat dimuat.' }); }
};
module.exports.parse = parse;
