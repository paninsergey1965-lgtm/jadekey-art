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

function passportPage(id, w) {
  const photoUrl = `${GITHUB_RAW}/${w.photo}`;
  const agateUrl = `${GITHUB_RAW}/${w.agate}`;
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JadeKey — ${id}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Space+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f5f0e8;color:#0e0e0c;font-family:'Cormorant Garamond',serif}
nav{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid rgba(0,0,0,.1)}
.logo{font-size:13px;font-weight:300;letter-spacing:.25em;text-transform:uppercase;text-decoration:none;color:#0e0e0c}
.logo span{color:#c0392b}.logo em{font-style:normal;color:#c0392b}
.nav-id{font-family:'Space Mono',monospace;font-size:11px;color:#c4a882}
.pic img{width:100%;max-height:70vw;object-fit:cover;display:block}
.cert{padding:40px 24px}
.lbl{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:20px}
.t{font-size:44px;font-weight:300;font-style:italic;margin-bottom:6px}
.zh{font-size:22px;color:#c4a882;margin-bottom:32px}
.hr{width:48px;height:1px;background:#c4a882;margin-bottom:28px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
.item label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#c4a882;display:block;margin-bottom:4px}
.item .v{font-size:15px}.item .s{font-size:12px;color:#c4a882}
.agate{display:flex;gap:20px;padding:24px;background:#e8e3d9;margin-bottom:28px;align-items:center}
.agate img{width:64px;height:64px;object-fit:cover;border-radius:50%;flex-shrink:0}
.agate label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#c4a882;display:block;margin-bottom:6px}
.agate p{font-size:13px;line-height:1.6}
.seal{display:flex;gap:16px;align-items:center}
.sc{width:48px;height:48px;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.si{width:34px;height:34px;background:#c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Space Mono',monospace;font-size:7px;text-align:center;line-height:1.3}
.sc2{font-size:13px;color:#c4a882}.sc2 strong{display:block;font-family:'Space Mono',monospace;font-size:14px;color:#0e0e0c}
.foot{border-top:1px solid rgba(0,0,0,.1);padding:16px 24px;background:#e8e3d9;font-family:'Space Mono',monospace;font-size:10px;color:#c4a882;text-align:center}
.back-link{font-family:'Space Mono',monospace;font-size:10px;color:#c4a882;text-decoration:none;letter-spacing:.15em}
.back-link:hover{color:#0e0e0c}
</style></head><body>
<nav>
  <a href="/" class="logo">JADE<em>KEY</em></a>
  <div style="display:flex;gap:20px;align-items:center">
    ${w.client ? `<a href="/clients/${w.client}" class="back-link">← Collection</a>` : ''}
    <span class="nav-id">${id}</span>
  </div>
</nav>
<div class="pic"><img src="${photoUrl}" alt="${w.title}"></div>
<div class="cert">
  <div class="lbl">Certificate of Authenticity</div>
  <div class="t">${w.title}</div>
  <div class="zh">${w.title_zh}</div>
  <div class="hr"></div>
  <div class="grid">
    <div class="item"><label>Artist</label><div class="v">${w.artist}</div><div class="s">${w.artist_zh}</div></div>
    <div class="item"><label>Year</label><div class="v">${w.year}</div></div>
    <div class="item"><label>Medium</label><div class="v">${w.medium}</div><div class="s">${w.medium_zh}</div></div>
    <div class="item"><label>Owner</label><div class="v">${w.owner}</div><div class="s">${w.owner_city} · ${w.registered}</div></div>
  </div>
  <div class="agate">
    <img src="${agateUrl}" alt="Agate">
    <div><label>JadeKey Mineral PUF / Минеральный ключ</label>
    <p>Agate slice — unique microstructure linked as physical identifier.<br><em>Агат · неклонируемая физическая подпись</em></p></div>
  </div>
  <div class="seal">
    <div class="sc"><div class="si">JK<br>✓</div></div>
    <div class="sc2"><strong>${id}</strong>Authenticated · jadekey.art</div>
  </div>
</div>
<div class="foot">© 2026 JadeKey — Physical Authentication System · jadekey.art</div>
</body></html>`;
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
