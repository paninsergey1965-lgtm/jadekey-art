const GITHUB_RAW = "https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main";

addEventListener("fetch", e => e.respondWith(handle(e.request)));

async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  // Route: /JK-XXXXXX — passport page
  const jkMatch = path.match(/^\/(JK-\d+)$/i);
  if (jkMatch) return servePassport(jkMatch[1].toUpperCase());

  // Route: /clients — all clients list
  if (path === "/clients") return serveClientsList();

  // Route: /clients/slug — single client page
  const clientMatch = path.match(/^\/clients\/([a-z0-9-]+)$/i);
  if (clientMatch) return serveClient(clientMatch[1]);

  // Route: /admin
  if (path === "/admin") return serveFile("admin.html");

  // Route: / — main page
  if (path === "/") return serveFile("index.html");

  return new Response("Not found", { status: 404 });
}

async function loadDB() {
  const res = await fetch(`${GITHUB_RAW}/works.json?t=${Date.now()}`);
  return await res.json();
}

async function servePassport(jkId) {
  const db = await loadDB();
  const works = db.works || db; // support both old and new format
  const work = works[jkId];

  if (!work) return new Response(notFoundPage(jkId), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  if (!work.public) return new Response(privatePage(jkId), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  return new Response(passportPage(jkId, work), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function serveClientsList() {
  const db = await loadDB();
  const clients = db.clients || {};
  const works = db.works || {};

  const cards = Object.entries(clients).map(([slug, c]) => {
    const clientWorks = (c.works || []).map(id => works[id]).filter(Boolean);
    const firstPublic = clientWorks.find(w => w.public);
    const thumb = firstPublic ? `${GITHUB_RAW}/${firstPublic.photo}` : '';
    const workCount = clientWorks.length;
    const publicCount = clientWorks.filter(w => w.public).length;

    return `<a href="/clients/${slug}" class="cc">
      ${thumb ? `<img class="cc-img" src="${thumb}" alt="${c.name}">` : '<div class="cc-img cc-no-img"></div>'}
      <div class="cc-body">
        <div class="cc-type">${c.type}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-city">${c.city}</div>
        <div class="cc-footer">
          <span class="cc-count">${workCount} work${workCount!==1?'s':''} · ${publicCount} public</span>
          <span class="cc-arrow">→</span>
        </div>
      </div>
    </a>`;
  }).join('');

  return new Response(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JadeKey — Our Clients</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a08;color:#f4efe6;font-family:'Cormorant Garamond',serif;min-height:100vh}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 40px;border-bottom:1px solid rgba(184,154,110,0.1)}
.logo{font-size:13px;font-weight:300;letter-spacing:.3em;text-transform:uppercase;text-decoration:none;color:#f4efe6}
.logo em{color:#b83225;font-style:normal}
.back{font-family:'Space Mono',monospace;font-size:10px;color:#b89a6e;text-decoration:none;letter-spacing:.15em}
.back:hover{color:#f4efe6}
.content{padding:64px 40px;max-width:1000px}
h1{font-size:clamp(32px,5vw,56px);font-weight:300;margin-bottom:8px}
.sub{font-family:'Space Mono',monospace;font-size:10px;color:#b89a6e;letter-spacing:.2em;margin-bottom:56px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
.cc{background:rgba(244,239,230,.03);border:1px solid rgba(184,154,110,.1);text-decoration:none;color:#f4efe6;display:block;transition:background .3s}
.cc:hover{background:rgba(184,154,110,.07)}
.cc-img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block;filter:grayscale(15%)}
.cc-no-img{background:rgba(184,154,110,.08)}
.cc-body{padding:24px}
.cc-type{font-family:'Space Mono',monospace;font-size:9px;color:#b89a6e;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px}
.cc-name{font-size:22px;font-weight:300;margin-bottom:4px}
.cc-city{font-size:14px;color:rgba(244,239,230,.45);margin-bottom:16px}
.cc-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(184,154,110,.1);padding-top:14px}
.cc-count{font-family:'Space Mono',monospace;font-size:9px;color:rgba(244,239,230,.3);letter-spacing:.1em}
.cc-arrow{color:rgba(184,154,110,.4);font-size:16px}
.cc:hover .cc-arrow{color:#b89a6e}
@media(max-width:700px){.grid{grid-template-columns:1fr}.content{padding:40px 20px}nav{padding:16px 20px}}
</style></head><body>
<nav>
  <a href="/" class="logo">JADE<em>KEY</em></a>
  <a href="/" class="back">← Back</a>
</nav>
<div class="content">
  <h1>Our Clients</h1>
  <div class="sub">${Object.keys(clients).length} registered · JadeKey Authentication System</div>
  <div class="grid">${cards || '<p style="font-family:Space Mono,monospace;font-size:11px;color:#b89a6e">No clients yet</p>'}</div>
</div>
</body></html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function serveClient(slug) {
  const db = await loadDB();
  const clients = db.clients || {};
  const works = db.works || {};
  const client = clients[slug];

  if (!client) return new Response("Client not found", { status: 404 });

  const clientWorks = (client.works || []);
  const cards = clientWorks.map(id => {
    const w = works[id];
    if (!w) return '';
    if (!w.public) return `<div class="wc wc-private">
      <div class="wc-img-wrap"><div class="wc-private-icon">🔒</div></div>
      <div class="wc-body">
        <div class="wc-id">${id}</div>
        <div class="wc-title" style="font-style:italic;color:rgba(244,239,230,.3)">Private work</div>
        <div class="wc-meta">Access restricted by owner</div>
      </div>
    </div>`;
    const img = `${GITHUB_RAW}/${w.photo}`;
    return `<a href="/${id}" class="wc">
      <img class="wc-img" src="${img}" alt="${w.title}">
      <div class="wc-body">
        <div class="wc-id">${id}</div>
        <div class="wc-title">${w.title}</div>
        <div class="wc-meta">${w.artist} · ${w.year}</div>
        <div class="wc-footer">
          <span class="wc-badge pub">PUBLIC</span>
          <span class="wc-arrow">→ passport</span>
        </div>
      </div>
    </a>`;
  }).join('');

  return new Response(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JadeKey — ${client.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a08;color:#f4efe6;font-family:'Cormorant Garamond',serif;min-height:100vh}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 40px;border-bottom:1px solid rgba(184,154,110,0.1)}
.logo{font-size:13px;font-weight:300;letter-spacing:.3em;text-transform:uppercase;text-decoration:none;color:#f4efe6}
.logo em{color:#b83225;font-style:normal}
.back{font-family:'Space Mono',monospace;font-size:10px;color:#b89a6e;text-decoration:none;letter-spacing:.15em}
.back:hover{color:#f4efe6}
.header{padding:64px 40px 40px;border-bottom:1px solid rgba(184,154,110,.1);max-width:1000px}
.client-type{font-family:'Space Mono',monospace;font-size:10px;color:#b83225;letter-spacing:.3em;text-transform:uppercase;margin-bottom:16px}
.client-name{font-size:clamp(36px,6vw,72px);font-weight:300;line-height:1;margin-bottom:8px}
.client-city{font-size:18px;color:rgba(244,239,230,.4);margin-bottom:0}
.content{padding:40px 40px 80px;max-width:1000px}
.works-label{font-family:'Space Mono',monospace;font-size:10px;color:#b89a6e;letter-spacing:.3em;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
.wc{background:rgba(244,239,230,.03);border:1px solid rgba(184,154,110,.1);text-decoration:none;color:#f4efe6;display:block;transition:background .3s}
.wc:hover{background:rgba(184,154,110,.07)}
.wc-private{cursor:default}
.wc-private:hover{background:rgba(244,239,230,.03)}
.wc-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;filter:grayscale(15%)}
.wc-img-wrap{width:100%;aspect-ratio:4/3;background:rgba(244,239,230,.03);display:flex;align-items:center;justify-content:center}
.wc-private-icon{font-size:32px;opacity:.3}
.wc-body{padding:20px}
.wc-id{font-family:'Space Mono',monospace;font-size:9px;color:#b89a6e;letter-spacing:.2em;margin-bottom:6px}
.wc-title{font-size:20px;font-weight:300;font-style:italic;margin-bottom:4px}
.wc-meta{font-size:13px;color:rgba(244,239,230,.4);margin-bottom:14px}
.wc-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(184,154,110,.1);padding-top:12px}
.wc-badge{font-family:'Space Mono',monospace;font-size:8px;padding:3px 8px}
.wc-badge.pub{background:rgba(184,154,110,.15);color:#b89a6e;border:1px solid rgba(184,154,110,.3)}
.wc-arrow{font-family:'Space Mono',monospace;font-size:9px;color:rgba(184,154,110,.4);letter-spacing:.1em}
.wc:hover .wc-arrow{color:#b89a6e}
@media(max-width:700px){.grid{grid-template-columns:1fr}.header{padding:40px 20px 32px}.content{padding:32px 20px 60px}nav{padding:16px 20px}}
</style></head><body>
<nav>
  <a href="/" class="logo">JADE<em>KEY</em></a>
  <a href="/clients" class="back">← Our Clients</a>
</nav>
<div class="header">
  <div class="client-type">${client.type}</div>
  <div class="client-name">${client.name}</div>
  <div class="client-city">${client.city}</div>
</div>
<div class="content">
  <div class="works-label">${clientWorks.length} registered work${clientWorks.length!==1?'s':''}</div>
  <div class="grid">${cards}</div>
</div>
</body></html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

async function serveFile(filename) {
  const r = await fetch(`${GITHUB_RAW}/${filename}`);
  const h = await r.text();
  return new Response(h, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}


// Passport page generator for JadeKey worker
// Called from servePassport() in worker.js

function passportPage(id, w) {
  // Build TON anchor block if available
  const tonBlock = w.ton_tx ? [
    '<div style="padding:32px 40px;border-bottom:1px solid rgba(154,125,78,0.2);background:rgba(26,23,20,0.02)">',
    '<div style="display:flex;align-items:center;gap:24px;max-width:800px">',
    '<div style="width:44px;height:44px;background:rgba(0,136,204,0.1);border:1px solid rgba(0,136,204,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:#29b6f6">&#x2B21;</div>',
    '<div style="flex:1">',
    '<div style="font-family:Space Mono,monospace;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#29b6f6;margin-bottom:6px">BLOCKCHAIN ANCHOR &middot; TON</div>',
    '<div style="font-family:Space Mono,monospace;font-size:11px;color:#1a1714;letter-spacing:.05em;margin-bottom:4px;word-break:break-all">' + (w.ton_agate_hash ? 'JadeKey:' + id + ':' + w.ton_agate_hash.slice(0,16) : 'JadeKey:' + id) + '</div>',
    '<div style="font-family:Space Mono,monospace;font-size:9px;color:#6b5f4e">' + (w.ton_anchored_at || '2026-05-30') + ' &middot; Immutable proof of existence</div>',
    '</div>',
    '<a href="' + (w.ton_explorer_agate || 'https://tonviewer.com/UQCSHtvmlLI8uWI0SpP0Nuwbf5Yth4MrW9sPhwW7jnyBEKCu') + '" target="_blank" style="font-family:Space Mono,monospace;font-size:10px;color:#29b6f6;text-decoration:none;border:1px solid rgba(0,136,204,0.3);padding:6px 12px;white-space:nowrap">Verify &rarr;</a>',
    '</div></div>'
  ].join('') : '';
  const RAW = 'https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main';
  const photoUrl = `${RAW}/${w.photo}`;
  const agateUrl = `${RAW}/${w.agate}`;
  const artistPhotoUrl = w.artist_photo ? `${RAW}/${w.artist_photo}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JadeKey — ${id} · ${w.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Cinzel:wght@400;500&family=Space+Mono:wght@400&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #f2ece0;
  --ink: #1a1714;
  --gold: #9a7d4e;
  --red: #8b2218;
  --pale: #e8e0d0;
  --mid: #6b5f4e;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: 'EB Garamond', serif; }

/* GRAIN */
body::after {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 999;
}

/* HEADER */
.passport-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 40px;
  border-bottom: 1px solid rgba(154,125,78,0.25);
}
.header-logo {
  font-family: 'Cinzel', serif;
  font-size: 13px;
  letter-spacing: 0.35em;
  color: var(--ink);
  text-decoration: none;
}
.header-logo em { color: var(--red); font-style: normal; }
.header-right {
  display: flex; align-items: center; gap: 20px;
}
.back-link {
  font-family: 'Space Mono', monospace;
  font-size: 10px; letter-spacing: 0.15em;
  color: var(--gold); text-decoration: none;
}
.back-link:hover { color: var(--ink); }
.passport-id {
  font-family: 'Space Mono', monospace;
  font-size: 11px; color: var(--gold);
  letter-spacing: 0.1em;
}

/* LANG TOGGLE */
.lang-toggle {
  display: flex; border: 1px solid rgba(154,125,78,0.3);
}
.lang-btn {
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 0.15em;
  padding: 5px 10px; cursor: pointer;
  color: var(--gold); background: transparent; border: none;
}
.lang-btn.active { background: var(--gold); color: var(--bg); }

/* ARTWORK SECTION */
.artwork-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 60vh;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.artwork-photo {
  overflow: hidden;
  background: #1a1714;
}
.artwork-photo img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0.95;
}
.artwork-info {
  padding: 56px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid rgba(154,125,78,0.15);
}
.section-tag {
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--red);
  margin-bottom: 28px;
}
.artwork-title {
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 400;
  font-style: italic;
  line-height: 1.1;
  margin-bottom: 10px;
}
.artwork-title-zh {
  font-size: 20px;
  color: var(--gold);
  margin-bottom: 40px;
  font-style: normal;
}
.divider {
  width: 40px; height: 1px;
  background: var(--gold);
  margin-bottom: 36px;
}
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px 32px;
}
.meta-item label {
  font-family: 'Space Mono', monospace;
  font-size: 8px; letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
  display: block; margin-bottom: 5px;
}
.meta-item .val {
  font-size: 16px;
  color: var(--ink);
  line-height: 1.4;
}
.meta-item .val-sub {
  font-size: 12px;
  color: var(--mid);
  margin-top: 2px;
}

/* ARTIST SECTION */
.artist-section {
  display: grid;
  grid-template-columns: 360px 1fr;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.artist-photo-wrap {
  position: relative;
  overflow: hidden;
  background: #1a1714;
  min-height: 400px;
}
.artist-photo-wrap img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  filter: sepia(15%) contrast(1.05);
}
.artist-photo-caption {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 20px 24px;
  background: linear-gradient(transparent, rgba(26,23,20,0.8));
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 0.2em;
  color: rgba(242,236,224,0.7);
}
.artist-info {
  padding: 56px 56px;
  border-left: 1px solid rgba(154,125,78,0.15);
}
.artist-name {
  font-family: 'Cinzel', serif;
  font-size: 32px; font-weight: 500;
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}
.artist-name-zh {
  font-size: 18px; color: var(--gold);
  margin-bottom: 8px;
}
.artist-dates {
  font-family: 'Space Mono', monospace;
  font-size: 10px; letter-spacing: 0.2em;
  color: var(--mid);
  margin-bottom: 32px;
}
.artist-bio {
  font-size: 17px;
  line-height: 1.75;
  color: rgba(26,23,20,0.75);
  max-width: 520px;
}

/* AGATE SECTION */
.agate-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.agate-photo {
  background: #0e0c0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  min-height: 360px;
}
.agate-photo img {
  max-width: 280px;
  max-height: 280px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 8px 32px rgba(0,0,0,0.6));
}
.agate-info {
  padding: 56px 56px;
  border-left: 1px solid rgba(154,125,78,0.15);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.agate-title {
  font-size: 28px;
  font-style: italic;
  margin-bottom: 8px;
}
.agate-subtitle {
  font-family: 'Space Mono', monospace;
  font-size: 10px; letter-spacing: 0.2em;
  color: var(--gold);
  margin-bottom: 32px;
}
.agate-desc {
  font-size: 16px;
  line-height: 1.7;
  color: rgba(26,23,20,0.7);
  margin-bottom: 32px;
}
.hash-block {
  background: rgba(26,23,20,0.05);
  border: 1px solid rgba(154,125,78,0.2);
  padding: 16px 20px;
}
.hash-block label {
  font-family: 'Space Mono', monospace;
  font-size: 8px; letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--gold);
  display: block; margin-bottom: 6px;
}
.hash-val {
  font-family: 'Space Mono', monospace;
  font-size: 11px; color: var(--mid);
  letter-spacing: 0.05em;
  word-break: break-all;
}

/* FOOTER / SEAL */
.passport-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 40px;
  background: var(--ink);
  color: var(--bg);
}
.seal-group {
  display: flex; align-items: center; gap: 20px;
}
.seal-circle {
  width: 56px; height: 56px;
  border: 2px solid var(--red);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.seal-inner {
  width: 40px; height: 40px;
  background: var(--red);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 7px; color: var(--bg);
  text-align: center; line-height: 1.4;
}
.seal-text strong {
  display: block;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--bg);
}
.seal-text span {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: rgba(242,236,224,0.4);
  letter-spacing: 0.1em;
}
.footer-right {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: rgba(242,236,224,0.3);
  text-align: right;
  letter-spacing: 0.1em;
  line-height: 1.7;
}

/* OWNER STRIP */
.owner-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 40px;
  border-bottom: 1px solid rgba(154,125,78,0.2);
  background: var(--pale);
}
.owner-label {
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 4px;
}
.owner-name { font-size: 18px; }
.owner-city {
  font-family: 'Space Mono', monospace;
  font-size: 10px; color: var(--mid);
  letter-spacing: 0.1em;
}
.reg-date {
  font-family: 'Space Mono', monospace;
  font-size: 10px; color: var(--mid);
  letter-spacing: 0.1em;
  text-align: right;
}



/* TON ANCHOR */
.ton-section{padding:32px 40px;border-bottom:1px solid rgba(154,125,78,0.2);background:rgba(26,23,20,0.02);}
.ton-inner{display:flex;align-items:center;gap:24px;}
.ton-icon{width:44px;height:44px;background:rgba(0,136,204,0.1);border:1px solid rgba(0,136,204,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:#29b6f6;}
.ton-body{flex:1;}
.ton-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#29b6f6;margin-bottom:5px;}
.ton-comment{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink);letter-spacing:.05em;margin-bottom:3px;word-break:break-all;}
.ton-date{font-family:'Space Mono',monospace;font-size:9px;color:var(--mid);}
.ton-link{font-family:'Space Mono',monospace;font-size:10px;color:#29b6f6;text-decoration:none;white-space:nowrap;}

/* TON ANCHOR */
.ton-section{padding:32px 40px;border-bottom:1px solid rgba(154,125,78,0.2);background:rgba(26,23,20,0.02);}
.ton-inner{display:flex;align-items:center;gap:24px;max-width:800px;}
.ton-icon{width:44px;height:44px;background:rgba(0,136,204,0.1);border:1px solid rgba(0,136,204,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:#29b6f6;}
.ton-body{flex:1;}
.ton-label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#29b6f6;margin-bottom:6px;}
.ton-comment{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink);letter-spacing:.05em;margin-bottom:4px;word-break:break-all;}
.ton-date{font-family:'Space Mono',monospace;font-size:9px;color:var(--mid);letter-spacing:.1em;}
.ton-link{font-family:'Space Mono',monospace;font-size:10px;color:#29b6f6;text-decoration:none;letter-spacing:.1em;white-space:nowrap;border:1px solid rgba(0,136,204,0.3);padding:6px 12px;}
.ton-link:hover{background:rgba(0,136,204,0.1);}
@media(max-width:768px){.ton-section{padding:24px 20px;}.ton-inner{gap:16px;}.ton-link{display:block;margin-top:12px;text-align:center;}}
/* MOBILE */
@media (max-width: 768px) {
  .passport-header { padding: 16px 20px; }
  .artwork-section, .artist-section, .agate-section { grid-template-columns: 1fr; }
  .artwork-photo { height: 70vw; }
  .artwork-info { padding: 36px 20px; border-left: none; border-top: 1px solid rgba(154,125,78,0.15); }
  .artist-photo-wrap { min-height: 280px; }
  .artist-info { padding: 36px 20px; border-left: none; border-top: 1px solid rgba(154,125,78,0.15); }
  .agate-photo { padding: 40px 20px; }
  .agate-info { padding: 36px 20px; border-left: none; border-top: 1px solid rgba(154,125,78,0.15); }
  .passport-footer { flex-direction: column; gap: 20px; padding: 32px 20px; text-align: center; }
  .footer-right { text-align: center; }
  .owner-strip { flex-direction: column; align-items: flex-start; gap: 8px; padding: 24px 20px; }
  .reg-date { text-align: left; }
}
</style>
</head>
<body>

<header class="passport-header">
  <a href="/" class="header-logo">JADE<em>KEY</em></a>
  <div class="header-right">
    ${w.client ? `<a href="/clients/${w.client}" class="back-link">← Collection</a>` : ''}
    <span class="passport-id">${id}</span>
    <div class="lang-toggle">
      <button class="lang-btn active" onclick="setLang('en')">EN</button>
      <button class="lang-btn" onclick="setLang('ru')">RU</button>
    </div>
  </div>
</header>

<!-- ARTWORK -->
<div class="artwork-section">
  <div class="artwork-photo">
    <img src="${photoUrl}" alt="${w.title}">
  </div>
  <div class="artwork-info">
    <div class="section-tag" data-en="Certificate of Authenticity" data-ru="Сертификат подлинности">Certificate of Authenticity</div>
    <div class="artwork-title">${w.title}</div>
    <div class="artwork-title-zh">${w.title_zh}</div>
    <div class="divider"></div>
    <div class="meta-grid">
      <div class="meta-item">
        <label data-en="Medium" data-ru="Техника">Medium</label>
        <div class="val">${w.medium}</div>
        <div class="val-sub">${w.medium_zh}</div>
      </div>
      <div class="meta-item">
        <label data-en="Year" data-ru="Год">Year</label>
        <div class="val">${w.year}</div>
      </div>
      <div class="meta-item">
        <label data-en="Tradition" data-ru="Традиция">Tradition</label>
        <div class="val">${w.tradition}</div>
      </div>
      <div class="meta-item">
        <label data-en="Registered" data-ru="Зарегистрировано">Registered</label>
        <div class="val">${w.registered}</div>
      </div>
    </div>
  </div>
</div>

<!-- ARTIST -->
<div class="artist-section">
  ${artistPhotoUrl ? `
  <div class="artist-photo-wrap">
    <img src="${artistPhotoUrl}" alt="${w.artist_full}">
    <div class="artist-photo-caption">${w.artist_full} · ${w.artist_born} – ${w.artist_died}</div>
  </div>` : ''}
  <div class="artist-info" ${!artistPhotoUrl ? 'style="grid-column:1/3"' : ''}>
    <div class="section-tag" data-en="About the Artist" data-ru="О художнике">About the Artist</div>
    <div class="artist-name">${w.artist_full || w.artist}</div>
    <div class="artist-name-zh">${w.artist_zh}</div>
    <div class="artist-dates">${w.artist_born} — ${w.artist_died}</div>
    <div class="artist-bio" id="artist-bio">${w.artist_bio_en || ''}</div>
  </div>
</div>

<!-- OWNER -->
<div class="owner-strip">
  <div>
    <div class="owner-label" data-en="Collector" data-ru="Коллекционер">Collector</div>
    <div class="owner-name">${w.owner}</div>
    <div class="owner-city">${w.owner_city}</div>
  </div>
  <div class="reg-date">
    <div class="owner-label" data-en="Registered" data-ru="Дата регистрации">Registered</div>
    <div>${w.registered}</div>
    <div style="margin-top:2px;font-size:9px;letter-spacing:.1em">jadekey.art</div>
  </div>
</div>

<!-- AGATE -->
<div class="agate-section">
  <div class="agate-photo">
    <img src="${agateUrl}" alt="JadeKey Mineral PUF ${id}">
  </div>
  <div class="agate-info">
    <div class="section-tag" data-en="Physical Authentication Key" data-ru="Физический ключ аутентификации">Physical Authentication Key</div>
    <div class="agate-title" data-en="Mineral PUF" data-ru="Минеральный PUF">Mineral PUF</div>
    <div class="agate-subtitle">AGATE SLICE · PHYSICALLY UNCLONABLE FUNCTION</div>
    <div class="agate-desc" id="agate-desc">A unique agate specimen whose internal microstructure — formed over millions of years — serves as an unclonable physical identifier permanently linked to this artwork.</div>
    <div class="hash-block">
      <label>JadeKey ID</label>
      <div class="hash-val">${id} · Verified & Registered · jadekey.art</div>
    </div>
  </div>
</div>


${tonBlock}
<!-- FOOTER -->
<footer class="passport-footer">
  <div class="seal-group">
    <div class="seal-circle">
      <div class="seal-inner">JK<br>✓</div>
    </div>
    <div class="seal-text">
      <strong>${id}</strong>
      <span data-en="Authenticated by JadeKey" data-ru="Верифицировано JadeKey">Authenticated by JadeKey</span>
    </div>
  </div>
  <div class="disclaimer" id="disc" style="padding:24px 40px;background:var(--ink);border-top:1px solid rgba(154,125,78,0.2);text-align:center"><p id="disc-text" style="font-family:Space Mono,monospace;font-size:9px;color:rgba(242,236,224,0.35);letter-spacing:0.08em;line-height:1.8;max-width:700px;margin:0 auto"><span data-en="JadeKey registers the physical identifier of an object. The authenticity of the artwork is confirmed by the owner and the author. JadeKey does not guarantee the accuracy of the information provided and bears no responsibility for the accuracy of information declared by users or third parties." data-ru="JadeKey регистрирует физический идентификатор объекта. Подлинность произведения искусства подтверждается владельцем и автором. JadeKey не гарантирует достоверность предоставленных сведений и не несёт ответственности за точность информации, заявленной пользователями или третьими лицами." data-zh="JadeKey 记录物品的物理标识符。艺术品的真实性由所有者和作者确认。JadeKey 不保证所提供信息的准确性，对用户或第三方声明的信息的准确性不承担任何责任。">JadeKey registers the physical identifier of an object. The authenticity of the artwork is confirmed by the owner and the author. JadeKey does not guarantee the accuracy of the information provided and bears no responsibility for the accuracy of information declared by users or third parties.</span></p></div><div class="footer-right">
    <div>© 2026 JadeKey</div>
    <div>Physical Authentication System</div>
    <div>jadekey.art</div>
  </div>
</footer>

<script>
const bioEn = ${JSON.stringify(w.artist_bio_en || '')};
const bioRu = ${JSON.stringify(w.artist_bio_ru || '')};
const agateEn = 'A unique agate specimen whose internal microstructure — formed over millions of years — serves as an unclonable physical identifier permanently linked to this artwork.';
const agateRu = 'Уникальный образец агата, внутренняя микроструктура которого — формировавшаяся миллионы лет — служит неклонируемым физическим идентификатором, навсегда связанным с этим произведением.';

function setLang(lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(lang === 'en' ? '.lang-btn:first-child' : '.lang-btn:last-child').classList.add('active');
  document.querySelectorAll('[data-' + lang + ']').forEach(el => {
    el.textContent = el.getAttribute('data-' + lang);
  });
  document.getElementById('artist-bio').textContent = lang === 'en' ? bioEn : bioRu;
  document.getElementById('agate-desc').textContent = lang === 'en' ? agateEn : agateRu;
  localStorage.setItem('jk-lang', lang);
}
const saved = localStorage.getItem('jk-lang');
if (saved && saved !== 'en') setLang(saved);
</script>

</body>
</html>`;
}
function privatePage(id) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>JadeKey — ${id}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e0e0c;color:#f5f0e8;font-family:'Space Mono',monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
.seal{width:80px;height:80px;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 32px}
.seal-in{width:60px;height:60px;background:#c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;line-height:1.3}
h1{font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:16px}
.id{font-size:24px;color:#f5f0e8;margin:24px 0 8px;letter-spacing:.1em}
p{font-size:13px;color:#666;line-height:1.8}
a{color:#c4a882;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-top:40px;display:block}
</style></head><body>
<div class="seal"><div class="seal-in">JK<br>✓</div></div>
<h1>Registered & Verified</h1>
<div class="id">${id}</div>
<p>This artwork is registered in the JadeKey system.<br>Access is restricted by the owner.</p>
<a href="/">← jadekey.art</a>
</body></html>`;
}

function notFoundPage(id) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>JadeKey — Not Found</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e0e0c;color:#f5f0e8;font-family:'Space Mono',monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
h1{font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:16px}
.id{font-size:24px;color:#555;margin:24px 0 8px;letter-spacing:.1em}
p{font-size:13px;color:#666;line-height:1.8}
a{color:#c4a882;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-top:40px;display:block}
</style></head><body>
<h1>Not Found</h1>
<div class="id">${id}</div>
<p>This identifier is not registered in the JadeKey system.</p>
<a href="/">← jadekey.art</a>
</body></html>`;
}
