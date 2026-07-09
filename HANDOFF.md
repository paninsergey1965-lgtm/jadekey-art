# HANDOFF: jadekey.art — Security & UX session

## Context
Repo: paninsergey1965-lgtm/jadekey-art (public GitHub repo).
Site: jadekey.art, served by Cloudflare Worker "square-lake-912d"
(account b79231ac82b621b60a6a682b29cfcbe7). worker.js in the repo
IS the Worker code — pushing to GitHub main auto-deploys it
(observed ~46s after push, no manual wrangler needed).
Working dir in iSH: ~/jadekey-art (git repo already cloned).
Push pattern:
git push https://$(cat ~/.git_token)@github.com/paninsergey1965-lgtm/jadekey-art.git main

## Original task
Owner (Sergei) noticed /cert/JK-XXXXXX (printable certificate) and
/admin (works registry admin panel) were public with zero auth —
anyone could print a certificate for any registered artwork. Also
wanted a "Scan a Stone" button on the homepage linking to the
crystal scanner app (jadekeytech.com), with a QR-code fallback on
desktop (scanning needs a phone's rear macro camera, doesn't work
on a laptop webcam).

## Done this session (all committed, pushed, verified live in browser)
1. worker.js — added handleCertGate(req, target): password-gates
   both /admin and /cert/:id via Set-Cookie jk_admin=1 (HttpOnly,
   Secure, Max-Age=86400). Password checked against CERT_PASSWORD,
   set as a Cloudflare Worker Secret (Settings > Variables and
   Secrets, type=Secret). Value = JadeKey2024. Commit 84766f4.
2. admin.html — removed old client-side-only login (email+password
   in localStorage), redundant now that the Worker gate exists.
   Changed `if (localStorage.getItem(SESSION_KEY)) enterPanel();`
   to just `enterPanel();`. Commit 18cb171.
3. admin.html — fixed UTF-8 double-encoding bug in loadWorks():
   GitHub API returns base64; atob() alone corrupts Cyrillic
   (mojibake like "Ð¡Ð²Ð¸..."). Fixed by wrapping in
   decodeURIComponent(escape(atob(...))). Commit 3579cda.
4. index.html — added "Сканировать камень" button in nav
   (id="scanBtn") + QR-code modal fallback for desktop. Detects
   mobile via /Mobi|Android|iPhone/i on navigator.userAgent plus
   navigator.maxTouchPoints > 0; redirects to jadekeytech.com on
   mobile, shows QR pointing there in a modal on desktop.
   Commit 600735b.

All 4 changes confirmed live on jadekey.art via screenshots from
the user (password gate works, admin loads without double login,
Cyrillic renders correctly, scan button redirects on mobile).

## Where we left off / unresolved
- User created a GitHub CLASSIC Personal Access Token (scope: repo,
  full access to ALL their repos) to let admin.html save works.json
  changes. The user PASTED THE RAW TOKEN VALUE INTO THIS CHAT
  (starts with ghp_SVr...). It must be treated as leaked/compromised.
  User was advised to revoke it at github.com/settings/tokens and
  create a fine-grained replacement scoped only to jadekey-art, but
  explicitly declined for now ("делай потом будем работать над
  безопасностью"). AS OF THIS HANDOFF THE TOKEN IS STILL LIVE AND
  UNREVOKED. Next session: remind once, gently, don't be pushy —
  they already said no once.
- No other open threads. All requested features are live.

## Gotchas — do not relearn these the hard way
- iSH on iPhone + copy-pasting a long single-line command from a
  chat code block is UNRELIABLE: Safari inserts real newlines at
  the visual wrap point on copy, silently breaking the command
  (the trailing `> file` redirect gets lost; echo just prints to
  stdout, nothing gets written, no error shown). NEVER send a
  giant one-line command expecting it to paste correctly.
- Reliable pattern for transferring code/data into iSH: wrap payload
  to ~60 chars/line (`fold -w60`), split into ~25-line chunks
  (`split -l 25`), and paste each chunk as its own
  `cat > file << 'EOF' ... EOF` heredoc (real short lines, not one
  giant line). Verify each chunk with `wc -l` before moving on.
  Concatenate with `cat part1 part2 | base64 -d > out` for
  base64-encoded payloads (JS/python with tricky quotes), or just
  write plain text directly via heredoc (this file was written
  that way).
- Quote the heredoc delimiter: `<< 'EOF'` (not `<< EOF`) — prevents
  the shell from expanding `$vars` or executing backticks inside
  the pasted content.
- Before sending any patch script to the user, TEST IT LOCALLY
  first against a reconstructed copy of the real target file
  (sandbox bash_tool is available for this) — catches quoting bugs
  (e.g. doubled backslashes before JS single-quotes) before
  wasting the user's round-trips typing into iSH.
- The repo is PUBLIC: fetch the real current file with
  `curl https://raw.githubusercontent.com/paninsergey1965-lgtm/jadekey-art/main/<file>`
  (raw.githubusercontent.com is allowed for bash_tool network
  access) rather than trusting a possibly-truncated paste from the
  user — earlier pastes of index.html/worker.js got visually cut
  off at the end when copied from iSH's terminal screenshots.
- worker.js uses the OLDER Cloudflare "service worker" syntax
  (`addEventListener('fetch', ...)`), NOT the ES-module format.
  Secrets/env vars (TELEGRAM_BOT_TOKEN, CERT_PASSWORD, YOOKASSA_*,
  etc.) are referenced as bare global identifiers, NOT `env.X`.
  Keep this pattern when adding new secrets.
- `public: true/false` in works.json controls ONLY the
  /JK-XXXXXX passport page (privatePage vs passportPage branch in
  servePassport()). It has ZERO effect on /cert/:id — that route
  is gated entirely and only by the Worker-level password now.
  Don't conflate the two if the user asks about certificate
  visibility again.

## Next-step plan if the user returns to this project
1. Gently remind about revoking the leaked ghp_ token (once, not
   repeatedly — see above).
2. Otherwise: no pending work. All 4 features from this session
   are live and the user has confirmed each one via screenshots.

## Infra reference
- GitHub repo: paninsergey1965-lgtm/jadekey-art (public)
- Cloudflare Worker: square-lake-912d
  (account b79231ac82b621b60a6a682b29cfcbe7)
- Domain: jadekey.art
- Scanner app (separate system): jadekeytech.com, hosted on Render,
  backend repo paninsergey1965-lgtm/Jadekey (private)
- Cloudflare Secrets already set (Settings > Variables and Secrets,
  all type=Secret): CERT_PASSWORD (=JadeKey2024, added this
  session), YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID, TBANK_TEST_*/TBANK_PROD_* (several)
- iSH working directory: ~/jadekey-art
