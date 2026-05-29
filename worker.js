const GITHUB_RAW = "https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main";

addEventListener("fetch", e => e.respondWith(handle(e.request)));

async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  // Route: /JK-XXXXXX
  const jkMatch = path.match(/^\/(JK-\d+)$/i);
  if (jkMatch) {
    return servePassport(jkMatch[1].toUpperCase());
  }

  // Route: /admin
  if (path === '/admin') {
    return serveFile('admin.html');
  }

  // Route: / — main page
  if (path === "/") {
    return serveMain();
  }

  return new Response("Not found", { status: 404 });
}

async function servePassport(jkId) {
  // Load works database
  const dbRes = await fetch(`${GITHUB_RAW}/works.json`);
  if (!dbRes.ok) return new Response("Database unavailable", { status: 503 });
  const works = await dbRes.json();

  const work = works[jkId];

  // Not found
  if (!work) {
    return new Response(notFoundPage(jkId), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }

  // Private
  if (!work.public) {
    return new Response(privatePage(jkId), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }

  // Public passport
  return new Response(passportPage(jkId, work), {
    headers: { "Content-Type": "text/html;charset=UTF-8" }
  });
}

async function serveMain() {
  const r = await fetch(`${GITHUB_RAW}/index.html`);
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
.logo{font-size:13px;font-weight:300;letter-spacing:.25em;text-transform:uppercase}
.logo a{color:inherit;text-decoration:none}
.logo span{color:#c0392b}
.nav-id{font-family:'Space Mono',monospace;font-size:11px;color:#c4a882}
.pic img{width:100%;max-height:70vw;object-fit:cover;display:block}
.cert{padding:40px 24px}
.lbl{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:20px}
.t{font-size:44px;font-weight:300;font-style:italic;margin-bottom:6px}
.zh{font-size:22px;color:#c4a882;margin-bottom:32px}
.hr{width:48px;height:1px;background:#c4a882;margin-bottom:28px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
.item label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#c4a882;display:block;margin-bottom:4px}
.item .v{font-size:15px}
.item .s{font-size:12px;color:#c4a882}
.agate{display:flex;gap:20px;padding:24px;background:#e8e3d9;margin-bottom:28px;align-items:center}
.agate img{width:64px;height:64px;object-fit:cover;border-radius:50%;flex-shrink:0}
.agate label{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#c4a882;display:block;margin-bottom:6px}
.agate p{font-size:13px;line-height:1.6}
.seal{display:flex;gap:16px;align-items:center}
.sc{width:48px;height:48px;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.si{width:34px;height:34px;background:#c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Space Mono',monospace;font-size:7px;text-align:center;line-height:1.3}
.sc2{font-size:13px;color:#c4a882}
.sc2 strong{display:block;font-family:'Space Mono',monospace;font-size:14px;color:#0e0e0c}
.foot{border-top:1px solid rgba(0,0,0,.1);padding:16px 24px;background:#e8e3d9;font-family:'Space Mono',monospace;font-size:10px;color:#c4a882;text-align:center}
</style></head><body>
<nav>
  <div class="logo"><a href="/">JADE<span>KEY</span></a> &nbsp;·&nbsp; Physical Authentication</div>
  <div class="nav-id">${id}</div>
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
    <div>
      <label>JadeKey Mineral PUF / Минеральный ключ</label>
      <p>Agate slice — unique microstructure linked as physical identifier.<br><em>Агат · неклонируемая физическая подпись</em></p>
    </div>
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
p{font-size:13px;color:#666;line-height:1.8}
.id{font-size:24px;color:#f5f0e8;margin:24px 0 8px;letter-spacing:.1em}
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

async function serveFile(filename) {
  const r = await fetch(`${GITHUB_RAW}/${filename}`);
  const h = await r.text();
  return new Response(h, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
}
