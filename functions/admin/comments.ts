/**
 * Comment moderation page — GET + POST /admin/comments.
 *
 * Password-gated (ADMIN_PASSWORD) with an HMAC-signed, HttpOnly cookie
 * (ADMIN_SECRET). Lists every comment, pending first, with Approve / Unapprove
 * / Delete actions. State-changing actions are same-origin POSTs; the SameSite
 * =Lax auth cookie is not sent on cross-site POSTs, which blocks CSRF.
 *
 * Unlisted + noindex. Access it directly at /admin/comments.
 */

interface Env {
  COMMENTS_DB: D1Database;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
}

interface Row {
  id: number;
  post_slug: string;
  author: string;
  body: string;
  approved: number;
  created_at: string;
}

const COOKIE = 'msg_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours
const NOINDEX = 'noindex, nofollow, noarchive';

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, private',
      'x-robots-tag': NOINDEX,
      'referrer-policy': 'no-referrer',
    },
  });
}

const STYLE = `
  :root { color-scheme: light dark; --paper:#f0ead8; --ink:#1a1610; --faded:#6b6454;
    --rule:rgba(26,22,16,.18); --warn:#8b1a0a; --ok:#2b6a3f; }
  @media (prefers-color-scheme: dark) { :root { --paper:#1a1610; --ink:#ece3cf;
    --faded:#9a917c; --rule:rgba(236,227,207,.18); --warn:#e5765f; --ok:#6fcf97; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); padding:28px 18px 80px;
    font-family:'Anonymous Pro',ui-monospace,SFMono-Regular,Menlo,monospace; line-height:1.5; }
  .wrap { max-width:820px; margin:0 auto; }
  h1 { font-size:1.2rem; letter-spacing:.14em; text-transform:uppercase; margin:0 0 4px; }
  .pending-badge { font-size:.62rem; letter-spacing:.08em; padding:2px 8px; margin-left:8px;
    border-radius:2px; vertical-align:middle; background:var(--warn); color:var(--paper); }
  .sub { color:var(--faded); font-size:.8rem; margin:0 0 24px; }
  .count { color:var(--faded); font-size:.75rem; text-transform:uppercase; letter-spacing:.1em;
    margin:24px 0 10px; border-bottom:1px solid var(--rule); padding-bottom:6px; }
  .c { border:1px solid var(--rule); padding:12px 14px; margin:0 0 12px; }
  .c.pending { border-left:3px solid var(--warn); }
  .c.approved { border-left:3px solid var(--ok); }
  .meta { font-size:.72rem; color:var(--faded); display:flex; gap:10px; flex-wrap:wrap;
    text-transform:uppercase; letter-spacing:.06em; margin-bottom:6px; }
  .who { color:var(--ink); font-weight:700; }
  .slug { color:var(--faded); }
  .tag { font-size:.62rem; padding:1px 6px; border:1px solid currentColor; border-radius:2px; }
  .tag.pending { color:var(--warn); } .tag.approved { color:var(--ok); }
  .text { white-space:pre-wrap; word-wrap:break-word; font-size:.92rem; margin:0 0 10px; }
  form.row { display:inline; }
  button { font:inherit; font-size:.72rem; text-transform:uppercase; letter-spacing:.08em;
    padding:5px 12px; border:1px solid var(--ink); background:transparent; color:var(--ink);
    cursor:pointer; margin-right:6px; }
  button.approve { border-color:var(--ok); color:var(--ok); }
  button.del { border-color:var(--warn); color:var(--warn); }
  button:hover { background:var(--ink); color:var(--paper); }
  .empty { color:var(--faded); font-style:italic; }
  .login { max-width:360px; margin:12vh auto 0; text-align:center; }
  .login input { width:100%; font:inherit; padding:.7rem .9rem; margin:0 0 .7rem;
    background:transparent; color:var(--ink); border:1px solid var(--rule); }
  .login button { width:100%; border-color:var(--ink); }
  .err { color:var(--warn); font-size:.8rem; min-height:1.2em; }
  .logout { float:right; font-size:.7rem; }
`;

function loginPage(error = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="${NOINDEX}" /><title>Moderation</title>
<style>${STYLE}</style></head><body><div class="wrap"><form class="login" method="POST" action="/admin/comments">
<h1>Moderation</h1><p class="sub">Comment moderation — authorized access only.</p>
<p class="err">${esc(error)}</p>
<input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" aria-label="Password" />
<button type="submit">Sign in</button></form></div></body></html>`;
}

function commentCard(r: Row): string {
  const pending = r.approved === 0;
  const cls = pending ? 'pending' : 'approved';
  const tag = pending ? 'Pending' : 'Live';
  const toggle = pending
    ? `<button class="approve" name="action" value="approve">Approve</button>`
    : `<button name="action" value="unapprove">Unapprove</button>`;
  return `<div class="c ${cls}">
  <div class="meta"><span class="tag ${cls}">${tag}</span>
    <span class="who">${esc(r.author)}</span>
    <span class="slug">/${esc(r.post_slug)}/</span>
    <span>${esc(r.created_at)} UTC</span></div>
  <p class="text">${esc(r.body)}</p>
  <form class="row" method="POST" action="/admin/comments">
    <input type="hidden" name="id" value="${r.id}" />${toggle}</form>
  <form class="row" method="POST" action="/admin/comments" onsubmit="return confirm('Delete this comment permanently?')">
    <input type="hidden" name="id" value="${r.id}" />
    <button class="del" name="action" value="delete">Delete</button></form>
</div>`;
}

async function listPage(env: Env): Promise<string> {
  const res = await env.COMMENTS_DB.prepare(
    `SELECT id, post_slug, author, body, approved, created_at
       FROM comments ORDER BY approved ASC, created_at DESC LIMIT 1000`,
  ).all<Row>();
  const rows = res.results ?? [];
  const pending = rows.filter((r) => r.approved === 0);
  const live = rows.filter((r) => r.approved !== 0);
  const section = (title: string, list: Row[]) =>
    `<p class="count">${title} — ${list.length}</p>` +
    (list.length ? list.map(commentCard).join('') : `<p class="empty">None.</p>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="${NOINDEX}" /><title>Moderation (${pending.length} pending)</title>
<style>${STYLE}</style></head><body><div class="wrap">
<form method="POST" action="/admin/comments" class="logout"><button name="action" value="logout">Sign out</button></form>
<h1>Moderation${pending.length ? ` <span class="pending-badge">${pending.length} pending</span>` : ''}</h1><p class="sub">Approve, unapprove, or delete comments. Pending comments are hidden from the site until approved.</p>
${section('Pending', pending)}
${section('Live', live)}
</div></body></html>`;
}

function authed(request: Request, token: string): boolean {
  const c = readCookie(request, COOKIE);
  return c !== null && timingSafeEqual(c, token);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return htmlResponse(loginPage('Moderation is not configured.'), 503);
  }
  const token = await hmacHex(env.ADMIN_SECRET, 'admin-v1');
  if (!authed(request, token)) return htmlResponse(loginPage(), 401);
  return htmlResponse(await listPage(env));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return htmlResponse(loginPage('Moderation is not configured.'), 503);
  }
  const token = await hmacHex(env.ADMIN_SECRET, 'admin-v1');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return htmlResponse(loginPage('Bad request.'), 400);
  }

  // Login attempt.
  const password = form.get('password');
  if (typeof password === 'string') {
    const [a, b] = await Promise.all([
      hmacHex(env.ADMIN_SECRET, password),
      hmacHex(env.ADMIN_SECRET, env.ADMIN_PASSWORD),
    ]);
    if (timingSafeEqual(a, b)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: '/admin/comments',
          'cache-control': 'no-store, private',
          'set-cookie': `${COOKIE}=${token}; Path=/admin; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return htmlResponse(loginPage('Incorrect password.'), 401);
  }

  // Everything else requires a valid session.
  if (!authed(request, token)) return htmlResponse(loginPage(), 401);

  const action = String(form.get('action') ?? '');

  if (action === 'logout') {
    return new Response(null, {
      status: 303,
      headers: {
        location: '/admin/comments',
        'cache-control': 'no-store, private',
        'set-cookie': `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const id = Number(form.get('id'));
  if (Number.isInteger(id) && id > 0) {
    if (action === 'approve') {
      await env.COMMENTS_DB.prepare(`UPDATE comments SET approved = 1 WHERE id = ?`).bind(id).run();
    } else if (action === 'unapprove') {
      await env.COMMENTS_DB.prepare(`UPDATE comments SET approved = 0 WHERE id = ?`).bind(id).run();
    } else if (action === 'delete') {
      await env.COMMENTS_DB.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
    }
  }

  return new Response(null, {
    status: 303,
    headers: { location: '/admin/comments', 'cache-control': 'no-store, private' },
  });
};
