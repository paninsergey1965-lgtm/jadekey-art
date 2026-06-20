(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // worker.js
  var GITHUB_RAW = "https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main";
  addEventListener("fetch", (e) => e.respondWith(handle(e.request)));
  async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const jkMatch = path.match(/^\/(JK-\d+)$/i);
    if (jkMatch)
      return servePassport(jkMatch[1].toUpperCase());
    const certMatch = path.match(/^\/cert\/(JK-\d+)$/i);
    if (certMatch)
      return serveFile("cert.html");
    if (path === "/api/payment/init" && req.method === "POST")
      return paymentInit(req);
    if (path === "/api/payment/webhook" && req.method === "POST")
      return paymentWebhook(req);
    if (path === "/clients")
      return serveClientsList();
    const clientMatch = path.match(/^\/clients\/([a-z0-9-]+)$/i);
    if (clientMatch)
      return serveClient(clientMatch[1]);
    if (path === "/admin")
      return serveFile("admin.html");
    if (path === "/uslugi")
      return new Response(USLUGI_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (path === "/oferta")
      return new Response(OFERTA_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (path === "/refund")
      return new Response(REFUND_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (path === "/privacy")
      return new Response(PRIVACY_HTML, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (path === "/en")
      return serveFile("index-en.html");
    if (path === "/")
      return serveFile("index.html");
    return new Response("Not found", { status: 404 });
  }
  __name(handle, "handle");
  async function loadDB() {
    const res = await fetch(`${GITHUB_RAW}/works.json?t=${Date.now()}`);
    return await res.json();
  }
  __name(loadDB, "loadDB");
  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  __name(sha256Hex, "sha256Hex");
  async function tkassaToken(params, password) {
    const data = Object.assign({}, params, { Password: password });
    const keys = Object.keys(data).filter((k) => typeof data[k] !== "object").sort();
    const concat = keys.map((k) => String(data[k])).join("");
    return await sha256Hex(concat);
  }
  __name(tkassaToken, "tkassaToken");
  async function sendTelegram(text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
      await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" })
      });
    } catch (e) {}
  }
  __name(sendTelegram, "sendTelegram");
  async function paymentInit(req) {
  try {
    const body = await req.json();
    const { name, email, phone } = body;
    const pkg = body.package || body.id || "Passport JadeKey";
    const prices = { "Passport JadeKey": 15000, "Passport + Certificate": 22000, "Full Package": 35000 };
    const customAmount = parseFloat(body.amount);
    const amount = (customAmount && customAmount > 0) ? customAmount : (prices[pkg] || 15000);
    const payment = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(YOOKASSA_SHOP_ID + ":" + YOOKASSA_SECRET_KEY),
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: "RUB" },
        confirmation: { type: "redirect", return_url: "https://jadekey.art/uslugi?status=success" },
        capture: true,
        description: "JadeKey: " + pkg + " | " + (name||"") + " " + (email||""),
        metadata: { name, email, phone, package: pkg },
        receipt: { customer: { email: email || "client@jadekey.art" }, items: [{ description: pkg, quantity: "1.00", amount: { value: amount.toFixed(2), currency: "RUB" }, vat_code: 1, payment_subject: "service", payment_mode: "full_payment" }] }
      })
    });
    const data = await payment.json();
    if (data.confirmation && data.confirmation.confirmation_url) {
      return new Response(JSON.stringify({ paymentUrl: data.confirmation.confirmation_url }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: data }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
  async function paymentWebhook(req) {
  try {
    const body = await req.json();
    const { event, object } = body;
    if (event === "payment.succeeded") {
      const { amount, metadata, id } = object;
      const msg = "OK YooKassa\n" + amount.value + " RUB\n" + (metadata.package||"") + "\n" + (metadata.name||"") + "\n" + (metadata.email||"") + "\n" + id;
      await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
      });
    }
    return new Response("ok", { status: 200 });
  } catch(e) {
    return new Response("error", { status: 500 });
  }
}
  async function servePassport(jkId) {
    const db = await loadDB();
    const works = db.works || db;
    const work = works[jkId];
    if (!work)
      return new Response(notFoundPage(jkId), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    if (!work.public)
      return new Response(privatePage(jkId), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    return new Response(passportPage(jkId, work), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
  __name(servePassport, "servePassport");
  async function serveClientsList() {
    const db = await loadDB();
    const clients = db.clients || {};
    const works = db.works || {};
    const cards = Object.entries(clients).map(([slug, c]) => {
      const clientWorks = (c.works || []).map((id) => works[id]).filter(Boolean);
      const firstPublic = clientWorks.find((w) => w.public);
      const thumb = firstPublic ? `${GITHUB_RAW}/${firstPublic.photo}` : "";
      const workCount = clientWorks.length;
      const publicCount = clientWorks.filter((w) => w.public).length;
      return `<a href="/clients/${slug}" class="cc">
      ${thumb ? `<img class="cc-img" src="${thumb}" alt="${c.name}">` : '<div class="cc-img cc-no-img"></div>'}
      <div class="cc-body">
        <div class="cc-type">${c.type}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-city">${c.city}</div>
        <div class="cc-footer">
          <span class="cc-count">${workCount} \u0440\u0430\u0431\u043E\u0442 \xB7 ${publicCount} \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0445</span>
          <span class="cc-arrow">\u2192</span>
        </div>
      </div>
    </a>`;
    }).join("");
    return new Response(`<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JadeKey \u2014 \u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u044B</title>
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
.cc-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;filter:grayscale(15%)}
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
</style><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script></head><body>
<nav>
  <a href="/" class="logo">JADE<em>KEY</em></a>
  <a href="/" class="back">\u2190 \u041D\u0430\u0437\u0430\u0434</a>
</nav>
<div class="content">
  <h1>\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u044B</h1>
  <div class="sub">${Object.keys(clients).length} \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E \xB7 JadeKey</div>
  <div class="grid">${cards || '<p style="font-family:Space Mono,monospace;font-size:11px;color:#b89a6e">\u041D\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432</p>'}</div>
</div>
</body></html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
  __name(serveClientsList, "serveClientsList");
  async function serveClient(slug) {
    const db = await loadDB();
    const clients = db.clients || {};
    const works = db.works || {};
    const client = clients[slug];
    if (!client)
      return new Response("Client not found", { status: 404 });
    const clientWorks = client.works || [];
    const cards = clientWorks.map((id) => {
      const w = works[id];
      if (!w)
        return "";
      if (!w.public)
        return `<div class="wc wc-private">
      <div class="wc-img-wrap"><div class="wc-private-icon">\u{1F512}</div></div>
      <div class="wc-body">
        <div class="wc-id">${id}</div>
        <div class="wc-title" style="font-style:italic;color:rgba(244,239,230,.3)">\u0417\u0430\u043A\u0440\u044B\u0442\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430</div>
        <div class="wc-meta">\u0414\u043E\u0441\u0442\u0443\u043F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u043C</div>
      </div>
    </div>`;
      const img = `${GITHUB_RAW}/${w.photo}`;
      return `<a href="/${id}" class="wc">
      <img class="wc-img" src="${img}" alt="${w.title}">
      <div class="wc-body">
        <div class="wc-id">${id}</div>
        <div class="wc-title">${w.title}</div>
        <div class="wc-meta">${w.artist} \xB7 ${w.year}</div>
        <div class="wc-footer">
          <span class="wc-badge pub">\u041F\u0423\u0411\u041B\u0418\u0427\u041D\u041E</span>
          <span class="wc-arrow">\u2192 \u043F\u0430\u0441\u043F\u043E\u0440\u0442</span>
        </div>
      </div>
    </a>`;
    }).join("");
    return new Response(`<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JadeKey \u2014 ${client.name}</title>
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
.wc-img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;filter:grayscale(15%)}
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
</style><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script></head><body>
<nav>
  <a href="/" class="logo">JADE<em>KEY</em></a>
  <a href="/clients" class="back">\u2190 \u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u044B</a>
</nav>
<div class="header">
  <div class="client-type">${client.type}</div>
  <div class="client-name">${client.name}</div>
  <div class="client-city">${client.city}</div>
</div>
<div class="content">
  <div class="works-label">${clientWorks.length} \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0440\u0430\u0431\u043E\u0442</div>
  <div class="grid">${cards}</div>
</div>
</body></html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
  __name(serveClient, "serveClient");
  async function serveFile(filename) {
    const r = await fetch(`${GITHUB_RAW}/${filename}?t=${Date.now()}`);
    const h = await r.text();
    return new Response(h, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
  __name(serveFile, "serveFile");
  function passportPage(id, w) {
    const tonBlock = w.ton_tx ? [
      '<div style="padding:32px 40px;border-bottom:1px solid rgba(154,125,78,0.2);background:rgba(26,23,20,0.02)">',
      '<div style="display:flex;align-items:center;gap:24px;max-width:800px">',
      '<div style="width:44px;height:44px;background:rgba(0,136,204,0.1);border:1px solid rgba(0,136,204,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;color:#29b6f6">&#x2B21;</div>',
      '<div style="flex:1">',
      '<div style="font-family:Space Mono,monospace;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#29b6f6;margin-bottom:6px">BLOCKCHAIN ANCHOR &middot; TON</div>',
      '<div style="font-family:Space Mono,monospace;font-size:11px;color:#1a1714;letter-spacing:.05em;margin-bottom:4px;word-break:break-all">' + (w.ton_agate_hash ? "JadeKey:" + id + ":" + w.ton_agate_hash.slice(0, 16) : "JadeKey:" + id) + "</div>",
      '<div style="font-family:Space Mono,monospace;font-size:9px;color:#6b5f4e">' + (w.ton_anchored_at || "2026-05-30") + " &middot; \u041D\u0435\u0438\u0437\u043C\u0435\u043D\u044F\u0435\u043C\u043E\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u0438</div>",
      "</div>",
      '<a href="' + (w.ton_explorer_agate || "https://tonviewer.com/UQCSHtvmlLI8uWI0SpP0Nuwbf5Yth4MrW9sPhwW7jnyBEKCu") + '" target="_blank" style="font-family:Space Mono,monospace;font-size:10px;color:#29b6f6;text-decoration:none;border:1px solid rgba(0,136,204,0.3);padding:6px 12px;white-space:nowrap">Verify &rarr;</a><br><a href="' + (w.ton_explorer || "https://tonviewer.com/UQCSHtvmlLI8uWI0SpP0Nuwbf5Yth4MrW9sPhwW7jnyBEKCu") + '" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 12px;border:1px solid rgba(154,125,78,0.4);font-family:monospace;font-size:10px;color:#9a7d4e;text-decoration:none">Verify Owner &rarr;</a>',
      "</div></div>"
    ].join("") : "";
    const paymentBlock = w.price_rub ? [
      '<div style="padding:32px 40px;border-bottom:1px solid rgba(154,125,78,0.2);background:rgba(139,34,24,0.04)">',
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:800px;flex-wrap:wrap">',
      '<div>',
      '<div style="font-family:Space Mono,monospace;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:#8b2218;margin-bottom:6px">\u041F\u0420\u041E\u0414\u0410\u0451\u0442\u0421\u0421\u042F</div>',
      '<div style="font-size:28px;font-style:italic">' + Number(w.price_rub).toLocaleString("ru-RU") + " \u20BD</div>",
      "</div>",
      '<button id="buyBtn" onclick="startPayment(\'' + id + '\')" style="font-family:Space Mono,monospace;font-size:11px;letter-spacing:.1em;color:#f2ece0;background:#8b2218;border:none;padding:14px 28px;cursor:pointer;text-transform:uppercase">\u041A\u0443\u043F\u0438\u0442\u044C</button>',
      "</div></div>"
    ].join("") : "";
    const RAW = "https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main";
    const photoUrl = `${RAW}/${w.photo}`;
    const agateUrl = `${RAW}/${w.agate}`;
    const artistPhotoUrl = w.artist_photo ? `${RAW}/${w.artist_photo}` : "";
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JadeKey \u2014 ${id} \xB7 ${w.title}</title>
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

body::after {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 999;
}

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
.artwork-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 60vh;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.artwork-photo { overflow: hidden; background: #1a1714; }
.artwork-photo img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.95; }
.artwork-info {
  padding: 56px 48px;
  display: flex; flex-direction: column; justify-content: center;
  border-left: 1px solid rgba(154,125,78,0.15);
}
.section-tag {
  font-family: 'Space Mono', monospace;
  font-size: 9px; letter-spacing: 0.35em;
  text-transform: uppercase; color: var(--red); margin-bottom: 28px;
}
.artwork-title {
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 400; font-style: italic; line-height: 1.1; margin-bottom: 10px;
}
.artwork-title-zh { font-size: 20px; color: var(--gold); margin-bottom: 40px; font-style: normal; }
.divider { width: 40px; height: 1px; background: var(--gold); margin-bottom: 36px; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 32px; }
.meta-item label {
  font-family: 'Space Mono', monospace;
  font-size: 8px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--gold);
  display: block; margin-bottom: 5px;
}
.meta-item .val { font-size: 16px; color: var(--ink); line-height: 1.4; }
.meta-item .val-sub { font-size: 12px; color: var(--mid); margin-top: 2px; }
.artist-section {
  display: grid; grid-template-columns: 360px 1fr;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.artist-photo-wrap { position: relative; overflow: hidden; background: #1a1714; min-height: 400px; }
.artist-photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; filter: sepia(15%) contrast(1.05); }
.artist-photo-caption {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 24px;
  background: linear-gradient(transparent, rgba(26,23,20,0.8));
  font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.2em;
  color: rgba(242,236,224,0.7);
}
.artist-info { padding: 56px 56px; border-left: 1px solid rgba(154,125,78,0.15); }
.artist-name { font-family: 'Cinzel', serif; font-size: 32px; font-weight: 500; margin-bottom: 6px; letter-spacing: 0.05em; }
.artist-name-zh { font-size: 18px; color: var(--gold); margin-bottom: 8px; }
.artist-dates { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.2em; color: var(--mid); margin-bottom: 32px; }
.artist-bio { font-size: 17px; line-height: 1.75; color: rgba(26,23,20,0.75); max-width: 520px; }
.agate-section {
  display: grid; grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid rgba(154,125,78,0.2);
}
.agate-photo {
  background: #0e0c0a; display: flex; align-items: center;
  justify-content: center; padding: 60px; min-height: 360px;
}
.agate-photo img {
  max-width: 280px; max-height: 280px; object-fit: contain; display: block;
  filter: drop-shadow(0 8px 32px rgba(0,0,0,0.6));
}
.agate-info {
  padding: 56px 56px; border-left: 1px solid rgba(154,125,78,0.15);
  display: flex; flex-direction: column; justify-content: center;
}
.agate-title { font-size: 28px; font-style: italic; margin-bottom: 8px; }
.agate-subtitle { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.2em; color: var(--gold); margin-bottom: 32px; }
.agate-desc { font-size: 16px; line-height: 1.7; color: rgba(26,23,20,0.7); margin-bottom: 32px; }
.hash-block { background: rgba(26,23,20,0.05); border: 1px solid rgba(154,125,78,0.2); padding: 16px 20px; }
.hash-block label {
  font-family: 'Space Mono', monospace; font-size: 8px; letter-spacing: 0.25em;
  text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 6px;
}
.hash-val { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--mid); letter-spacing: 0.05em; word-break: break-all; }
.passport-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 40px 40px; background: var(--ink); color: var(--bg);
}
.seal-group { display: flex; align-items: center; gap: 20px; }
.seal-circle {
  width: 56px; height: 56px; border: 2px solid var(--red); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.seal-inner {
  width: 40px; height: 40px; background: var(--red); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Mono', monospace; font-size: 7px; color: var(--bg);
  text-align: center; line-height: 1.4;
}
.seal-text strong { display: block; font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 0.1em; color: var(--bg); }
.seal-text span { font-family: 'Space Mono', monospace; font-size: 10px; color: rgba(242,236,224,0.4); letter-spacing: 0.1em; }
.footer-right { font-family: 'Space Mono', monospace; font-size: 10px; color: rgba(242,236,224,0.3); text-align: right; letter-spacing: 0.1em; line-height: 1.7; }
.owner-strip {
  display: flex; justify-content: space-between; align-items: center;
  padding: 28px 40px; border-bottom: 1px solid rgba(154,125,78,0.2); background: var(--pale);
}
.owner-label { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); margin-bottom: 4px; }
.owner-name { font-size: 18px; }
.owner-city { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--mid); letter-spacing: 0.1em; }
.reg-date { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--mid); letter-spacing: 0.1em; text-align: right; }
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
@media print {
  .passport-header .lang-toggle, .passport-header .back-link, .print-btn { display: none !important; }
  body::after { display: none; }
  .passport-header { border-bottom: 1px solid #9a7d4e; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm; }
}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script></head>
<body>

<header class="passport-header">
  <a href="/" class="header-logo">JADE<em>KEY</em></a>
  <div class="header-right">
    ${w.client ? `<a href="/clients/${w.client}" class="back-link">\u2190 \u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F</a>` : ""}
    <span class="passport-id">${id}</span>
    <a href="/cert/${id}" style="font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.15em;color:#b89a6e;text-decoration:none;padding:5px 10px;border:1px solid rgba(184,154,110,.3)">CERT</a>
  </div>
</header>

<div class="artwork-section">
  <div class="artwork-photo">
    <img src="${photoUrl}" alt="${w.title}">
  </div>
  <div class="artwork-info">
    <div class="section-tag" data-en="Certificate of Authenticity" data-ru="\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u0438">\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u0438</div>
    <div class="artwork-title">${w.title}</div>
    <div class="artwork-title-zh"></div>
    <div class="divider"></div>
    <div class="meta-grid">
      <div class="meta-item">
        <label data-en="Medium" data-ru="\u0422\u0435\u0445\u043D\u0438\u043A\u0430">\u0422\u0435\u0445\u043D\u0438\u043A\u0430</label>
        <div class="val">${w.medium_ru || w.medium}</div>
        <div class="val-sub">${w.medium_en || ""}</div>
      </div>
      <div class="meta-item">
        <label data-en="Year" data-ru="\u0413\u043E\u0434">\u0413\u043E\u0434</label>
        <div class="val">${w.year}</div>
      </div>
      <div class="meta-item">
        <label data-en="Tradition" data-ru="\u0422\u0440\u0430\u0434\u0438\u0446\u0438\u044F">\u0422\u0440\u0430\u0434\u0438\u0446\u0438\u044F</label>
        <div class="val">${w.tradition}</div>
      </div>
      <div class="meta-item">
        <label data-en="Registered" data-ru="\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E">\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E</label>
        <div class="val">${w.registered}</div>
      </div>
    </div>
  </div>
</div>

<div class="artist-section">
  ${artistPhotoUrl ? `
  <div class="artist-photo-wrap">
    <img src="${artistPhotoUrl}" alt="${w.artist_full}">
    <div class="artist-photo-caption">${w.artist_full}${w.artist_born ? " \xB7 " + w.artist_born : ""}${w.artist_died ? " \u2013 " + w.artist_died : ""}</div>
  </div>` : ""}
  <div class="artist-info" ${!artistPhotoUrl ? 'style="grid-column:1/3"' : ""}>
    <div class="section-tag" data-en="About the Artist" data-ru="\u041E \u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A\u0435">\u041E \u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A\u0435</div>
    <div class="artist-name" data-ru="${w.artist_full_ru || w.artist_full || w.artist}" data-en="${w.artist_full || w.artist}">${w.artist_full_ru || w.artist_full || w.artist}</div>
    ${w.artist_zh ? `<div class="artist-name-zh">${w.artist_zh}</div>` : ""}
    <div class="artist-dates">${w.artist_born ? w.artist_born + " \u2014 " : ""}${w.artist_died_ru || w.artist_died || ""}</div>
    <div class="artist-bio" id="artist-bio">${w.artist_bio_ru || w.artist_bio_en || ""}</div>
  </div>
</div>

<div class="owner-strip">
  <div>
    <div class="owner-label" data-en="Collector" data-ru="\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440">\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440</div>
    <div class="owner-name">${w.owner}</div>
    <div class="owner-city">${w.owner_city}</div>
  </div>
  <div class="reg-date">
    <div class="owner-label" data-en="Registered" data-ru="\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438">\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438</div>
    <div>${w.registered}</div>
    <div style="margin-top:2px;font-size:9px;letter-spacing:.1em">jadekey.art</div>
  </div>
</div>


<div class="agate-section">
  <div class="agate-photo">
    <img src="${agateUrl}" alt="JadeKey Mineral PUF ${id}">
  </div>
  <div class="agate-info">
    <div class="section-tag" data-en="Physical Authentication Key" data-ru="\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u043B\u044E\u0447 \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438">\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u043B\u044E\u0447 \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438</div>
    <div class="agate-title" data-en="Mineral PUF" data-ru="\u041C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 PUF">\u041C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 PUF</div>
    <div class="agate-subtitle">\u0421\u0420\u0415\u0417 \u0410\u0413\u0410\u0422\u0410 \xB7 \u0424\u0418\u0417\u0418\u0427\u0415\u0421\u041A\u0418 \u041D\u0415\u041A\u041B\u041E\u041D\u0418\u0420\u0423\u0415\u041C\u0410\u042F \u0424\u0423\u041D\u041A\u0426\u0418\u042F</div>
    <div class="agate-desc" id="agate-desc">\u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0431\u0440\u0430\u0437\u0435\u0446 \u0430\u0433\u0430\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043C\u0438\u043A\u0440\u043E\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u2014 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0432\u0448\u0430\u044F\u0441\u044F \u043C\u0438\u043B\u043B\u0438\u043E\u043D\u044B \u043B\u0435\u0442 \u2014 \u0441\u043B\u0443\u0436\u0438\u0442 \u043D\u0435\u043A\u043B\u043E\u043D\u0438\u0440\u0443\u0435\u043C\u044B\u043C \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u043E\u043C, \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u043C \u0441 \u044D\u0442\u0438\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435\u043C.</div>
    <div class="hash-block">
      <label>JadeKey ID</label>
      <div class="hash-val">${id} \xB7 \u0412\u0435\u0440\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0438 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E \xB7 jadekey.art</div>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fjadekey.art%2F${id}" style="display:block;margin-top:12px;width:80px;height:80px" alt="QR">
    </div>
  </div>
</div>

${paymentBlock}

${tonBlock}

<footer class="passport-footer">
  <div class="seal-group">
    <div class="seal-circle">
      <div class="seal-inner">JK<br>\u2713</div>
    </div>
    <div class="seal-text">
      <strong>${id}</strong>
      <span data-en="Authenticated by JadeKey" data-ru="\u0412\u0435\u0440\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E JadeKey">\u0412\u0435\u0440\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E JadeKey</span>
    </div>
  </div>
  <div class="disclaimer" id="disc" style="padding:24px 40px;background:var(--ink);border-top:1px solid rgba(154,125,78,0.2);text-align:center"><p id="disc-text" style="font-family:Space Mono,monospace;font-size:9px;color:rgba(242,236,224,0.35);letter-spacing:0.08em;line-height:1.8;max-width:700px;margin:0 auto"><span data-en="JadeKey registers the physical identifier of an object. The authenticity of the artwork is confirmed by the owner and the author. JadeKey does not guarantee the accuracy of the information provided and bears no responsibility for the accuracy of information declared by users or third parties." data-ru="JadeKey \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0435\u0442 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043E\u0431\u044A\u0435\u043A\u0442\u0430. \u041F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442\u0441\u044F \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u043C \u0438 \u0430\u0432\u0442\u043E\u0440\u043E\u043C. JadeKey \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u0438 \u043D\u0435 \u043D\u0435\u0441\u0451\u0442 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438, \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F\u043C\u0438 \u0438\u043B\u0438 \u0442\u0440\u0435\u0442\u044C\u0438\u043C\u0438 \u043B\u0438\u0446\u0430\u043C\u0438.">JadeKey \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0435\u0442 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043E\u0431\u044A\u0435\u043A\u0442\u0430. \u041F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442\u0441\u044F \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u043C \u0438 \u0430\u0432\u0442\u043E\u0440\u043E\u043C. JadeKey \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u0438 \u043D\u0435 \u043D\u0435\u0441\u0451\u0442 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438, \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F\u043C\u0438 \u0438\u043B\u0438 \u0442\u0440\u0435\u0442\u044C\u0438\u043C\u0438 \u043B\u0438\u0446\u0430\u043C\u0438.</span></p></div>
  <div class="footer-right">
    <div>\xA9 2026 JadeKey</div>
    <div>Physical Authentication System</div>
    <div>jadekey.art</div>
  </div>
</footer>

<script>
const bioEn = ${JSON.stringify(w.artist_bio_en || "")};
const bioRu = ${JSON.stringify(w.artist_bio_ru || "")};
const artistNameRu = ${JSON.stringify(w.artist_full_ru || "")};
const agateEn = 'A unique agate specimen whose internal microstructure \u2014 formed over millions of years \u2014 serves as an unclonable physical identifier permanently linked to this artwork.';
const agateRu = '\u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0431\u0440\u0430\u0437\u0435\u0446 \u0430\u0433\u0430\u0442\u0430, \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043C\u0438\u043A\u0440\u043E\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u2014 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0432\u0448\u0430\u044F\u0441\u044F \u043C\u0438\u043B\u043B\u0438\u043E\u043D\u044B \u043B\u0435\u0442 \u2014 \u0441\u043B\u0443\u0436\u0438\u0442 \u043D\u0435\u043A\u043B\u043E\u043D\u0438\u0440\u0443\u0435\u043C\u044B\u043C \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u043E\u043C, \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u043C \u0441 \u044D\u0442\u0438\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435\u043C.';

function setLang(lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.lang-btn').forEach(b => { if(b.textContent.trim()===lang.toUpperCase()) b.classList.add('active'); });
  document.querySelectorAll('[data-' + lang + ']').forEach(el => {
    el.textContent = el.getAttribute('data-' + lang);
  });
  document.getElementById('artist-bio').textContent = lang === 'en' ? bioEn : bioRu;
  const nameEl = document.querySelector('.artist-name');
  if(nameEl && lang === 'ru' && artistNameRu) nameEl.textContent = artistNameRu;
  else if(nameEl && lang === 'en') nameEl.textContent = ${JSON.stringify(w.artist_full || w.artist)};
  document.getElementById('agate-desc').textContent = lang === 'en' ? agateEn : agateRu;
  localStorage.setItem('jk-lang', lang);
}
function startPayment(id) {
  const email = prompt('Email \u0434\u043B\u044F \u043A\u0432\u0438\u0442\u0430\u043D\u0446\u0438\u0438:');
  if (!email) return;
  const btn = document.getElementById('buyBtn');
  if (btn) { btn.disabled = true; btn.textContent = '\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430...'; }
  fetch('/api/payment/init', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id: id, email: email })
  }).then(r => r.json()).then(data => {
    if (data.paymentUrl) { location.href = data.paymentUrl; }
    else { alert('\u041E\u0448\u0438\u0431\u043A\u0430: ' + (data.error || '\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F')); if (btn) { btn.disabled = false; btn.textContent = '\u041A\u0443\u043F\u0438\u0442\u044C'; } }
  }).catch(e => { alert('\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438'); if (btn) { btn.disabled = false; btn.textContent = '\u041A\u0443\u043F\u0438\u0442\u044C'; } });
}
const saved = localStorage.getItem('jk-lang') || 'ru';
if (saved === 'en') setLang('en');
<\/script>

</body>
</html>`;
  }
  __name(passportPage, "passportPage");
  function privatePage(id) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>JadeKey \u2014 ${id}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e0e0c;color:#f5f0e8;font-family:'Space Mono',monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
.seal{width:80px;height:80px;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 32px}
.seal-in{width:60px;height:60px;background:#c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;line-height:1.3}
h1{font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:16px}
.id{font-size:24px;color:#f5f0e8;margin:24px 0 8px;letter-spacing:.1em}
p{font-size:13px;color:#666;line-height:1.8}
a{color:#c4a882;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-top:40px;display:block}
</style><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script></head><body>
<div class="seal"><div class="seal-in">JK<br>\u2713</div></div>
<h1>\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0438 \u0432\u0435\u0440\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E</h1>
<div class="id">${id}</div>
<p>\u042D\u0442\u043E \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 JadeKey.<br>\u0414\u043E\u0441\u0442\u0443\u043F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u043C.</p>
<a href="/">\u2190 jadekey.art</a>
</body></html>`;
  }
  __name(privatePage, "privatePage");
  function notFoundPage(id) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>JadeKey \u2014 Not Found</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e0e0c;color:#f5f0e8;font-family:'Space Mono',monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px}
h1{font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:#c4a882;margin-bottom:16px}
.id{font-size:24px;color:#555;margin:24px 0 8px;letter-spacing:.1em}
p{font-size:13px;color:#666;line-height:1.8}
a{color:#c4a882;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-top:40px;display:block}
</style><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script><script async src="https://www.googletagmanager.com/gtag/js?id=G-PBJZ1WQNN8"><\/script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-PBJZ1WQNN8");<\/script></head><body>
<h1>\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</h1>
<div class="id">${id}</div>
<p>\u042D\u0442\u043E\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043D\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 JadeKey.</p>
<a href="/">\u2190 jadekey.art</a>
</body></html>`;
  }
  __name(notFoundPage, "notFoundPage");
  var LEGAL_STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0e0d0b;color:#f5f0e8;font-family:'Cormorant Garamond',serif;line-height:1.7;min-height:100vh}
.wrap{max-width:760px;margin:0 auto;padding:64px 32px 96px}
nav{display:flex;justify-content:space-between;align-items:center;padding:24px 32px;border-bottom:1px solid rgba(154,125,78,0.12)}
.logo{font-family:monospace;font-size:12px;letter-spacing:.3em;text-transform:uppercase;text-decoration:none;color:#f5f0e8}
.logo em{color:#8b2218;font-style:normal}
.back{font-family:monospace;font-size:10px;color:#9a7d4e;text-decoration:none;letter-spacing:.15em}
.back:hover{color:#f5f0e8}
h1{font-size:clamp(28px,4vw,40px);font-weight:300;margin-bottom:8px}
.meta{font-family:monospace;font-size:10px;color:#9a7d4e;letter-spacing:.1em;margin-bottom:40px}
h2{font-size:20px;font-weight:400;margin-top:36px;margin-bottom:12px;color:#9a7d4e}
p{font-size:16px;color:rgba(245,240,232,0.75);margin-bottom:8px}
a{color:#9a7d4e}
a:hover{color:#f5f0e8}
.req{background:rgba(154,125,78,0.06);border:1px solid rgba(154,125,78,0.15);padding:20px;border-radius:4px;margin-top:40px;font-family:monospace;font-size:13px;line-height:1.8;color:rgba(245,240,232,0.6)}
`;
  function legalNav() {
    return `<nav>
    <a href="/" class="logo">JADE<em>KEY</em></a>
    <a href="/" class="back">\u2190 jadekey.art</a>
  </nav>`;
  }
  __name(legalNav, "legalNav");
  var USLUGI_HTML = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>\u0423\u0441\u043B\u0443\u0433\u0438 \u0438 \u0446\u0435\u043D\u044B \u2014 JadeKey</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>${LEGAL_STYLE}
.price-card{border:1px solid rgba(154,125,78,0.25);background:rgba(154,125,78,0.05);padding:32px;margin-top:32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px}
.price-name{font-size:20px;font-weight:400;margin-bottom:6px}
.price-desc{font-family:'Space Mono',monospace;font-size:12px;color:rgba(245,240,232,0.5);max-width:420px}
.price-amount{font-size:28px;font-style:italic;white-space:nowrap}
.order-btn{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.1em;color:#f2ece0;background:#8b2218;border:none;padding:14px 28px;cursor:pointer;text-transform:uppercase;white-space:nowrap}
</style></head><body>
${legalNav()}
<div class="wrap">
<h1>\u0423\u0441\u043B\u0443\u0433\u0438 \u0438 \u0446\u0435\u043D\u044B</h1>
<p class="meta">\u0418\u041F \u041F\u0430\u043D\u0438\u043D \u0421.\u041D. \u00B7 \u0410\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430</p>
<p>JadeKey \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442 \u0444\u0438\u0437\u0438\u043A\u043E-\u0446\u0438\u0444\u0440\u043E\u0432\u0443\u044E \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044E \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430: \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0443 \u0440\u0430\u0431\u043E\u0442\u044B \u043A \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u0438\u043A\u0440\u043E\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0435 (\u0430\u0433\u0430\u0442 \u0438\u043B\u0438 \u043D\u0435\u0444\u0440\u0438\u0442), \u0444\u043E\u0442\u043E\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E, \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 jadekey.art \u0438 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0432 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0435\u0441\u0442\u0440. \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0440\u0443\u0431\u043B\u044F\u0445, \u0431\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0439, \u0447\u0435\u0440\u0435\u0437 \u0441\u0430\u0439\u0442. \u0423\u0441\u043B\u043E\u0432\u0438\u044F \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438 \u2014 \u0432 <a href="/oferta">\u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0439 \u043E\u0444\u0435\u0440\u0442\u0435</a>.</p>

<div class="price-card">
  <div>
    <div class="price-name">\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043F\u0430\u0440\u0442\u0438\u0438 \u0440\u0430\u0431\u043E\u0442 (\u0434\u043E 10 \u0448\u0442.)</div>
    <div class="price-desc">\u041F\u0440\u0438\u0432\u044F\u0437\u043A\u0430 \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u0438 \u0440\u0435\u0435\u0441\u0442\u0440\u043E\u0432\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0440\u0430\u0431\u043E\u0442\u044B \u0432 \u043F\u0430\u0440\u0442\u0438\u0438</div>
  </div>
  <div style="text-align:right">
    <div class="price-amount">20\u00A0000\u00A0\u20BD</div>
    <button class="order-btn" onclick="orderUslugi()" id="orderBtn" style="margin-top:12px">\u0437\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0430\u0441\u043F\u043E\u0440\u0442 jadekey</button>
  </div>
</div>

<p style="margin-top:32px;font-size:14px;color:rgba(245,240,232,0.5)">\u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u043E\u0431\u044A\u0451\u043C\u044B \u0438 \u0440\u0430\u0437\u043E\u0432\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B \u2014 <a href="mailto:JadeKey1965@gmail.com">\u043D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043D\u0430\u043C</a>.</p>
</div>
<script>
function orderUslugi() {
  var email = prompt('Email \u0434\u043B\u044F \u0437\u0430\u043A\u0430\u0437\u0430:');
  if (!email) return;
  var btn = document.getElementById('orderBtn');
  btn.disabled = true; btn.textContent = '\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430...';
  fetch('/api/payment/init', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id: 'USLUGI-PAKET10', email: email })
  }).then(function(r){ return r.json(); }).then(function(data){
    if (data.paymentUrl) { location.href = data.paymentUrl; }
    else { alert('\u041E\u0448\u0438\u0431\u043A\u0430: ' + (data.error || '\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F')); btn.disabled = false; btn.textContent = '\u0437\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0430\u0441\u043F\u043E\u0440\u0442 jadekey'; }
  }).catch(function(){ alert('\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438'); btn.disabled = false; btn.textContent = '\u0437\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0430\u0441\u043F\u043E\u0440\u0442 jadekey'; });
}
</script>
</body></html>`;
  var OFERTA_HTML = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>\u041F\u0443\u0431\u043B\u0438\u0447\u043D\u0430\u044F \u043E\u0444\u0435\u0440\u0442\u0430 \u2014 JadeKey</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>${LEGAL_STYLE}</style></head><body>
${legalNav()}
<div class="wrap">
<h1>\u041F\u0443\u0431\u043B\u0438\u0447\u043D\u0430\u044F \u043E\u0444\u0435\u0440\u0442\u0430 \u043D\u0430 \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0443\u0441\u043B\u0443\u0433 JadeKey</h1>
<p class="meta">\u0420\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441 16 \u0438\u044E\u043D\u044F 2026 \u0433\u043E\u0434\u0430</p>

<p>\u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C \u041F\u0430\u043D\u0438\u043D \u0421\u0435\u0440\u0433\u0435\u0439 \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447 (\u0418\u041D\u041D 771501067019, \u041E\u0413\u0420\u041D\u0418\u041F 324774600501998), \u0434\u0430\u043B\u0435\u0435 \u2014 \xAB\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\xBB, \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442, \u044F\u0432\u043B\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0439 \u043E\u0444\u0435\u0440\u0442\u043E\u0439 (\u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C) \u0432 \u0430\u0434\u0440\u0435\u0441 \u043B\u044E\u0431\u043E\u0433\u043E \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0438\u043B\u0438 \u044E\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043B\u0438\u0446\u0430, \u0434\u0430\u043B\u0435\u0435 \u2014 \xAB\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\xBB, \u0437\u0430\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0434\u043E\u0433\u043E\u0432\u043E\u0440 \u043D\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445, \u0438\u0437\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u043D\u0438\u0436\u0435.</p>
<p>\u0410\u043A\u0446\u0435\u043F\u0442\u043E\u043C \u043E\u0444\u0435\u0440\u0442\u044B (\u043F\u043E\u043B\u043D\u044B\u043C \u0438 \u0431\u0435\u0437\u0443\u0441\u043B\u043E\u0432\u043D\u044B\u043C \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435\u043C \u043D\u0430 \u0435\u0451 \u0443\u0441\u043B\u043E\u0432\u0438\u044F) \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043E\u043F\u043B\u0430\u0442\u0430 \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C \u0443\u0441\u043B\u0443\u0433\u0438 \u0447\u0435\u0440\u0435\u0437 \u0444\u043E\u0440\u043C\u0443 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 jadekey.art, \u043B\u0438\u0431\u043E \u043F\u043E\u0434\u0430\u0447\u0430 \u0437\u0430\u044F\u0432\u043A\u0438 \u043D\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044E \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u043F\u043E\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043E\u043F\u043B\u0430\u0442\u043E\u0439.</p>

<h2>1. \u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430</h2>
<p>\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0443 \u0443\u0441\u043B\u0443\u0433\u0443 \u043F\u043E \u0444\u0438\u0437\u0438\u043A\u043E-\u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430 \u0438\u043B\u0438 \u0438\u043D\u043E\u0433\u043E \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 (\u0434\u0430\u043B\u0435\u0435 \u2014 \xAB\u0420\u0430\u0431\u043E\u0442\u0430\xBB), \u0432\u043A\u043B\u044E\u0447\u0430\u044E\u0449\u0443\u044E: \u043F\u0440\u0438\u0441\u0432\u043E\u0435\u043D\u0438\u0435 \u0420\u0430\u0431\u043E\u0442\u0435 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430 (\u0441\u0440\u0435\u0437 \u043F\u0440\u0438\u0440\u043E\u0434\u043D\u043E\u0433\u043E \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u0430, \u0430\u0433\u0430\u0442 \u0438\u043B\u0438 \u043D\u0435\u0444\u0440\u0438\u0442), \u0444\u043E\u0442\u043E\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E \u0420\u0430\u0431\u043E\u0442\u044B \u0438 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u0420\u0430\u0431\u043E\u0442\u044B \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 jadekey.art, \u0437\u0430\u043F\u0438\u0441\u044C \u0445\u044D\u0448\u0430 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u0438 \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u043E\u0432 \u0420\u0430\u0431\u043E\u0442\u044B \u0432 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0435\u0441\u0442\u0440 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0441\u0435\u0442\u0438 TON.</p>

<h2>2. \u041F\u043E\u0440\u044F\u0434\u043E\u043A \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438</h2>
<p>\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442 \u0420\u0430\u0431\u043E\u0442\u0443 \u0438 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043D\u0435\u0439 (\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0430\u0432\u0442\u043E\u0440, \u0433\u043E\u0434 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F, \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446) \u0447\u0435\u0440\u0435\u0437 \u0444\u043E\u0440\u043C\u0443 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u0438\u043B\u0438 \u043F\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044E \u0441 \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0435\u043C \u043D\u0430\u043F\u0440\u044F\u043C\u0443\u044E. \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442 \u0444\u043E\u0442\u043E\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E, \u043F\u043E\u0434\u0431\u043E\u0440 \u0438 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u0435 \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u0438 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u044C. \u0421\u0440\u043E\u043A \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u043E \u0438 \u043E\u0431\u044B\u0447\u043D\u043E \u043D\u0435 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 14 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u0420\u0430\u0431\u043E\u0442\u044B \u0438 \u043F\u043E\u043B\u043D\u043E\u0439 \u043E\u043F\u043B\u0430\u0442\u044B.</p>

<h2>3. \u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0443\u0441\u043B\u0443\u0433\u0438</h2>
<p>\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0443\u0441\u043B\u0443\u0433\u0438 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u043E \u0432 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u0442\u0438\u043F\u0430 \u0420\u0430\u0431\u043E\u0442\u044B, \u0435\u0451 \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0441 \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C \u0434\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043E\u043F\u043B\u0430\u0442\u044B. \u0410\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0435\u043C \u043F\u0440\u0438 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0438 \u0437\u0430\u044F\u0432\u043A\u0438 \u0438\u043B\u0438 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0443 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u0435\u0442\u0430\u043B\u0435\u0439.</p>

<h2>4. \u041F\u043E\u0440\u044F\u0434\u043E\u043A \u043E\u043F\u043B\u0430\u0442\u044B</h2>
<p>\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0440\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u0438\u0445 \u0440\u0443\u0431\u043B\u044F\u0445 \u0431\u0435\u0437\u043D\u0430\u043B\u0438\u0447\u043D\u044B\u043C \u0441\u043F\u043E\u0441\u043E\u0431\u043E\u043C \u0447\u0435\u0440\u0435\u0437 \u043F\u043B\u0430\u0442\u0451\u0436\u043D\u0443\u044E \u0444\u043E\u0440\u043C\u0443 \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 jadekey.art \u0441 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0431\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u0438\u043B\u0438 \u0421\u0438\u0441\u0442\u0435\u043C\u044B \u0431\u044B\u0441\u0442\u0440\u044B\u0445 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439. \u0423\u0441\u043B\u0443\u0433\u0430 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043E\u043F\u043B\u0430\u0447\u0435\u043D\u043D\u043E\u0439 \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u0441\u0447\u0451\u0442 \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044F.</p>

<h2>5. \u041F\u0440\u0430\u0432\u0430 \u0438 \u043E\u0431\u044F\u0437\u0430\u043D\u043D\u043E\u0441\u0442\u0438 \u0441\u0442\u043E\u0440\u043E\u043D</h2>
<p>\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043E\u0431\u044F\u0437\u0443\u0435\u0442\u0441\u044F \u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0443\u0441\u043B\u0443\u0433\u0443 \u0434\u043E\u0431\u0440\u043E\u0441\u043E\u0432\u0435\u0441\u0442\u043D\u043E \u0438 \u0432 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0441\u0440\u043E\u043A\u0438, \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u043D\u043E\u0441\u0442\u044C \u0420\u0430\u0431\u043E\u0442\u044B \u043D\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438, \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0443 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u043C\u0443 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0443 \u0420\u0430\u0431\u043E\u0442\u044B \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u0438. \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A \u043E\u0431\u044F\u0437\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0420\u0430\u0431\u043E\u0442\u0435 \u0438 \u0441\u0432\u043E\u0435\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0441\u0442\u0438 \u043E\u043F\u043B\u0430\u0442\u0443.</p>

<h2>6. \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432</h2>
<p>\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438\u0437\u043B\u043E\u0436\u0435\u043D\u044B \u0432 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u043C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0435 \u2014 <a href="/refund">\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0435 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430</a>, \u044F\u0432\u043B\u044F\u044E\u0449\u0435\u0439\u0441\u044F \u043D\u0435\u043E\u0442\u044A\u0435\u043C\u043B\u0435\u043C\u043E\u0439 \u0447\u0430\u0441\u0442\u044C\u044E \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0439 \u043E\u0444\u0435\u0440\u0442\u044B.</p>

<h2>7. \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445</h2>
<p>\u041E\u0444\u043E\u0440\u043C\u043B\u044F\u044F \u0437\u0430\u044F\u0432\u043A\u0443 \u0438\u043B\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u044F \u043E\u043F\u043B\u0430\u0442\u0443, \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A \u0441\u043E\u0433\u043B\u0430\u0448\u0430\u0435\u0442\u0441\u044F \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445, \u0438\u0437\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u043C\u0438 \u0432 <a href="/privacy">\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445</a>.</p>

<h2>8. \u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0441\u0442\u043E\u0440\u043E\u043D</h2>
<p>\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0435\u0441\u0451\u0442 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u043E\u0431\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430, \u0432\u043E\u0437\u043D\u0438\u043A\u0448\u0438\u0435 \u0432\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C \u043D\u0435\u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u043E \u0420\u0430\u0431\u043E\u0442\u0435. \u041C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u0441\u0432\u044F\u0437\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430 \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u0430 \u0441 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u0432 \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u043C \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0435 \u0438 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0440\u0435\u0435\u0441\u0442\u0440\u0435; \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u0432\u044B\u0441\u0442\u0443\u043F\u0430\u0435\u0442 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043E\u043C \u043F\u043E \u0430\u0442\u0440\u0438\u0431\u0443\u0446\u0438\u0438 \u0430\u0432\u0442\u043E\u0440\u0441\u0442\u0432\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438 \u043D\u0435 \u043D\u0435\u0441\u0451\u0442 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u0437\u0430 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u043E\u0441\u0442\u044C \u0430\u0432\u0442\u043E\u0440\u0441\u0442\u0432\u0430, \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C.</p>

<h2>9. \u0421\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043E\u0444\u0435\u0440\u0442\u044B</h2>
<p>\u041E\u0444\u0435\u0440\u0442\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0435\u0451 \u043E\u0442\u0437\u044B\u0432\u0430 \u0438\u043B\u0438 \u0437\u0430\u043C\u0435\u043D\u044B \u043D\u043E\u0432\u043E\u0439 \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u0435\u0439. \u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u0432\u0441\u0435\u0433\u0434\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 jadekey.art/oferta.</p>

<h2>10. \u0420\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044F</h2>
<div class="req">
  \u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C \u041F\u0430\u043D\u0438\u043D \u0421\u0435\u0440\u0433\u0435\u0439 \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447<br>
  \u0418\u041D\u041D: 771501067019<br>
  \u041E\u0413\u0420\u041D\u0418\u041F: 324774600501998<br>
  \u0410\u0434\u0440\u0435\u0441 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438: 121170, \u0433. \u041C\u043E\u0441\u043A\u0432\u0430, \u041A\u0443\u0442\u0443\u0437\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0441\u043F\u0435\u043A\u0442, \u0434. 41, \u043A\u0432. 55<br>
  \u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430: <a href="mailto:JadeKey1965@gmail.com">JadeKey1965@gmail.com</a>
</div>
</div>
</body></html>`;
  var REFUND_HTML = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u2014 JadeKey</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>${LEGAL_STYLE}</style></head><body>
${legalNav()}
<div class="wrap">
<h1>\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432</h1>
<p class="meta">\u0420\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441 16 \u0438\u044E\u043D\u044F 2026 \u0433\u043E\u0434\u0430</p>

<p>\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0430\u044F \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432, \u0443\u043F\u043B\u0430\u0447\u0435\u043D\u043D\u044B\u0445 \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C \u0437\u0430 \u0443\u0441\u043B\u0443\u0433\u0438 \u0418\u041F \u041F\u0430\u043D\u0438\u043D\u0430 \u0421\u0435\u0440\u0433\u0435\u044F \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447\u0430 (\u0434\u0430\u043B\u0435\u0435 \u2014 \xAB\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\xBB) \u0447\u0435\u0440\u0435\u0437 \u0441\u0430\u0439\u0442 jadekey.art, \u0438 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043D\u0435\u043E\u0442\u044A\u0435\u043C\u043B\u0435\u043C\u043E\u0439 \u0447\u0430\u0441\u0442\u044C\u044E <a href="/oferta">\u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0439 \u043E\u0444\u0435\u0440\u0442\u044B</a>.</p>

<h2>1. \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438</h2>
<p>\u0415\u0441\u043B\u0438 \u043E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0430, \u043D\u043E \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0440\u0438\u0441\u0442\u0443\u043F\u0438\u043B \u043A \u0444\u043E\u0442\u043E\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u0438 \u0420\u0430\u0431\u043E\u0442\u044B \u0438 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u0438\u044E \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430, \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A \u0432\u043F\u0440\u0430\u0432\u0435 \u043E\u0442\u043A\u0430\u0437\u0430\u0442\u044C\u0441\u044F \u043E\u0442 \u0443\u0441\u043B\u0443\u0433\u0438 \u0438 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u0443\u043F\u043B\u0430\u0447\u0435\u043D\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B.</p>

<h2>2. \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438</h2>
<p>\u0415\u0441\u043B\u0438 \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u0443\u0436\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0451\u043B \u0444\u043E\u0442\u043E\u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044E \u0420\u0430\u0431\u043E\u0442\u044B, \u043F\u043E\u0434\u0431\u043E\u0440 \u043C\u0438\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u0438\u043B\u0438 \u0438\u043D\u044B\u0435 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043D\u043E \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u0438 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u044C \u0435\u0449\u0451 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u044B, \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0437\u0430 \u0432\u044B\u0447\u0435\u0442\u043E\u043C \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u043D\u0435\u0441\u0451\u043D\u043D\u044B\u0445 \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0435\u043C \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u0438 \u0442\u0440\u0443\u0434\u043E\u0437\u0430\u0442\u0440\u0430\u0442.</p>

<h2>3. \u041D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438</h2>
<p>\u041F\u043E\u0441\u043B\u0435 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u0420\u0430\u0431\u043E\u0442\u044B \u0438 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0440\u0435\u0435\u0441\u0442\u0440 TON \u0443\u0441\u043B\u0443\u0433\u0430 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043E\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u0432 \u043F\u043E\u043B\u043D\u043E\u043C \u043E\u0431\u044A\u0451\u043C\u0435. \u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u0442\u0430\u043F\u0435 \u043D\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0441\u044F, \u0437\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u0441\u043B\u0443\u0447\u0430\u0435\u0432, \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438.</p>

<h2>4. \u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0431\u043E\u0439 \u043F\u043B\u0430\u0442\u0435\u0436\u0430</h2>
<p>\u0412 \u0441\u043B\u0443\u0447\u0430\u0435 \u043E\u0448\u0438\u0431\u043E\u0447\u043D\u043E\u0433\u043E \u0438\u043B\u0438 \u0437\u0430\u0434\u0432\u043E\u0435\u043D\u043D\u043E\u0433\u043E \u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0441\u0431\u043E\u044F \u043F\u043B\u0430\u0442\u0451\u0436\u043D\u043E\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442 \u043F\u043E\u043B\u043D\u044B\u0439 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u0438\u0437\u043B\u0438\u0448\u043D\u0435 \u0443\u043F\u043B\u0430\u0447\u0435\u043D\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 10 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0430.</p>

<h2>5. \u041F\u043E\u0440\u044F\u0434\u043E\u043A \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0437\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u043C</h2>
<p>\u0414\u043B\u044F \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0443 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u043D\u0430\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u043D\u0430 \u0430\u0434\u0440\u0435\u0441 <a href="mailto:JadeKey1965@gmail.com">JadeKey1965@gmail.com</a> \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u0435\u043C \u043D\u043E\u043C\u0435\u0440\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0430, \u0434\u0430\u0442\u044B \u043E\u043F\u043B\u0430\u0442\u044B \u0438 \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u044F. \u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u0440\u0430\u0441\u0441\u043C\u0430\u0442\u0440\u0438\u0432\u0430\u0435\u0442 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 5 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439.</p>

<h2>6. \u0421\u0440\u043E\u043A \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430</h2>
<p>\u041F\u0440\u0438 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u043C \u0440\u0435\u0448\u0435\u043D\u0438\u0438 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u044E\u0442\u0441\u044F \u043D\u0430 \u0442\u043E\u0442 \u0436\u0435 \u043F\u043B\u0430\u0442\u0451\u0436\u043D\u044B\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442, \u0441 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u0431\u044B\u043B\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0430 \u043E\u043F\u043B\u0430\u0442\u0430, \u0432 \u0441\u0440\u043E\u043A \u0434\u043E 10 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u043E \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0435.</p>

<div class="req">
  \u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C \u041F\u0430\u043D\u0438\u043D \u0421\u0435\u0440\u0433\u0435\u0439 \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447<br>
  \u0418\u041D\u041D: 771501067019<br>
  \u041E\u0413\u0420\u041D\u0418\u041F: 324774600501998<br>
  \u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430: <a href="mailto:JadeKey1965@gmail.com">JadeKey1965@gmail.com</a>
</div>
</div>
</body></html>`;
  var PRIVACY_HTML = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u2014 JadeKey</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono&display=swap" rel="stylesheet">
<style>${LEGAL_STYLE}</style></head><body>
${legalNav()}
<div class="wrap">
<h1>\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445</h1>
<p class="meta">\u0420\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441 16 \u0438\u044E\u043D\u044F 2026 \u0433\u043E\u0434\u0430</p>

<p>\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0430\u044F \u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u043C\u0435\u0440\u044B \u043F\u043E \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u044E \u0438\u0445 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438, \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u043C\u044B\u0435 \u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u043C \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u0435\u043C \u041F\u0430\u043D\u0438\u043D\u044B\u043C \u0421\u0435\u0440\u0433\u0435\u0435\u043C \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447\u0435\u043C (\u0434\u0430\u043B\u0435\u0435 \u2014 \xAB\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\xBB) \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 \u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u0430 \u043E\u0442 27.07.2006 \u2116 152-\u0424\u0417 \xAB\u041E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445\xBB.</p>

<h2>1. \u0421\u043E\u0441\u0442\u0430\u0432 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445</h2>
<p>\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435, \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0441\u0430\u0439\u0442\u0430 jadekey.art \u043F\u0440\u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438 \u0444\u043E\u0440\u043C\u044B \u0437\u0430\u044F\u0432\u043A\u0438 \u0438\u043B\u0438 \u043E\u043F\u043B\u0430\u0442\u044B \u0443\u0441\u043B\u0443\u0433\u0438: \u0438\u043C\u044F, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u044B\u0439 \u0442\u0435\u043B\u0435\u0444\u043E\u043D \u0438/\u0438\u043B\u0438 \u0430\u0434\u0440\u0435\u0441 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0447\u0442\u044B, \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0420\u0430\u0431\u043E\u0442\u0435 \u0438 \u0440\u043E\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F (\u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u043E\u043D\u0435\u0440, \u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A, \u0433\u0430\u043B\u0435\u0440\u0435\u044F, \u0430\u0443\u043A\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0434\u043E\u043C).</p>

<h2>2. \u0426\u0435\u043B\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438</h2>
<p>\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u0446\u0435\u043B\u044F\u0445: \u0441\u0432\u044F\u0437\u0438 \u0441 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u0434\u043B\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438, \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0433\u043E \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u0420\u0430\u0431\u043E\u0442\u044B, \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u043B\u0430\u0442\u0435\u0436\u0430 \u0447\u0435\u0440\u0435\u0437 \u043F\u043B\u0430\u0442\u0451\u0436\u043D\u0443\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u0443, \u0438\u0441\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432 \u043F\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0439 \u043E\u0444\u0435\u0440\u0442\u044B.</p>

<h2>3. \u041F\u0440\u0430\u0432\u043E\u0432\u044B\u0435 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438</h2>
<p>\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u043E\u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441 \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F, \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u043D\u043E\u0433\u043E \u043F\u0443\u0442\u0451\u043C \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0444\u043E\u0440\u043C\u044B \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u0438/\u0438\u043B\u0438 \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u043E\u043F\u043B\u0430\u0442\u044B, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0432 \u0446\u0435\u043B\u044F\u0445 \u0438\u0441\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0430, \u0441\u0442\u043E\u0440\u043E\u043D\u043E\u0439 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C.</p>

<h2>4. \u041F\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 \u0442\u0440\u0435\u0442\u044C\u0438\u043C \u043B\u0438\u0446\u0430\u043C</h2>
<p>\u0414\u043B\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439 \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u0435\u0440\u0435\u0434\u0430\u0451\u0442 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u044B\u0439 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u043B\u0430\u0442\u0451\u0436\u043D\u044B\u043C \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u043C \u0432 \u043E\u0431\u044A\u0451\u043C\u0435, \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u043C \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0430. \u0418\u043D\u044B\u043C \u0442\u0440\u0435\u0442\u044C\u0438\u043C \u043B\u0438\u0446\u0430\u043C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F, \u0437\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u0441\u043B\u0443\u0447\u0430\u0435\u0432, \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438.</p>

<h2>5. \u0421\u0440\u043E\u043A \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F</h2>
<p>\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0441\u0440\u043E\u043A\u0430, \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0433\u043E \u0434\u043B\u044F \u043E\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u0443\u0441\u043B\u0443\u0433\u0438 \u0438 \u0438\u0441\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432 \u0441\u0442\u043E\u0440\u043E\u043D, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0441\u0440\u043E\u043A\u043E\u0432, \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u0431\u0443\u0445\u0433\u0430\u043B\u0442\u0435\u0440\u0441\u043A\u043E\u0433\u043E \u0438 \u043D\u0430\u043B\u043E\u0433\u043E\u0432\u043E\u0433\u043E \u0443\u0447\u0451\u0442\u0430.</p>

<h2>6. \u041F\u0440\u0430\u0432\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F</h2>
<p>\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0432\u043F\u0440\u0430\u0432\u0435 \u0432 \u043B\u044E\u0431\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u043E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u043D\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445, \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445, \u043F\u043E\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u0442\u044C \u0438\u0445 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F, \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u043B\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u044F, \u043D\u0430\u043F\u0440\u0430\u0432\u0438\u0432 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u043D\u0430 \u0430\u0434\u0440\u0435\u0441 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u043E\u0447\u0442\u044B \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430.</p>

<h2>7. \u041C\u0435\u0440\u044B \u0437\u0430\u0449\u0438\u0442\u044B \u0434\u0430\u043D\u043D\u044B\u0445</h2>
<p>\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0438 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043C\u0435\u0440\u044B \u0434\u043B\u044F \u0437\u0430\u0449\u0438\u0442\u044B \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E\u0442 \u043D\u0435\u043F\u0440\u0430\u0432\u043E\u043C\u0435\u0440\u043D\u043E\u0433\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u0430, \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F, \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0438\u044F \u0438\u043B\u0438 \u0443\u043D\u0438\u0447\u0442\u043E\u0436\u0435\u043D\u0438\u044F, \u0432\u043A\u043B\u044E\u0447\u0430\u044F \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u0434\u0430\u043D\u043D\u044B\u043C \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u0445 \u043A\u0430\u043D\u0430\u043B\u043E\u0432 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0438 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438 (HTTPS).</p>

<h2>8. \u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B \u043F\u043E \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u043C \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445</h2>
<div class="req">
  \u0418\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C \u041F\u0430\u043D\u0438\u043D \u0421\u0435\u0440\u0433\u0435\u0439 \u041D\u0438\u043A\u043E\u043B\u0430\u0435\u0432\u0438\u0447<br>
  \u0418\u041D\u041D: 771501067019<br>
  \u041E\u0413\u0420\u041D\u0418\u041F: 324774600501998<br>
  \u0410\u0434\u0440\u0435\u0441 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438: 121170, \u0433. \u041C\u043E\u0441\u043A\u0432\u0430, \u041A\u0443\u0442\u0443\u0437\u043E\u0432\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0441\u043F\u0435\u043A\u0442, \u0434. 41, \u043A\u0432. 55<br>
  \u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430: <a href="mailto:JadeKey1965@gmail.com">JadeKey1965@gmail.com</a>
</div>
</div>
</body></html>`;
})();
//# sourceMappingURL=worker.js.map
