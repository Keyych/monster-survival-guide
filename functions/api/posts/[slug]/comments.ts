/**
 * Comments API — GET + POST /api/posts/<slug>/comments.
 *
 * Backed by a Cloudflare D1 SQLite database (binding name: COMMENTS_DB).
 * Lives as a Pages Function so it deploys with the rest of the site —
 * no separate Worker project to manage.
 *
 * Honest limits: this is the v1 schema, no auth, no email notifications,
 * no reactions yet. Approve-on-post by default; flip COMMENTS_REQUIRE_APPROVAL
 * to "1" in the Pages env to switch to a moderation queue.
 */

interface Env {
  COMMENTS_DB: D1Database;
  COMMENTS_REQUIRE_APPROVAL?: string;
  /** Server secret for keyed IP hashing. When unset, falls back to plain
   *  SHA-256 so the endpoint keeps working, but set it: an unsalted hash of an
   *  IP is trivially reversible. */
  IP_HASH_SECRET?: string;
  /** Cloudflare Turnstile secret. When set, every POST must carry a valid
   *  Turnstile token; when unset, the check is skipped. */
  TURNSTILE_SECRET?: string;
}

interface CommentRow {
  id: number;
  author: string;
  body: string;
  created_at: string;
}

interface PostBody {
  author?: string;
  body?: string;
  /** Honeypot: bots fill this; humans never see it. */
  website?: string;
  /** Cloudflare Turnstile token from the widget (when enabled). */
  turnstileToken?: string;
}

const MIN_BODY = 1;
const MAX_BODY = 5000;
const MIN_AUTHOR = 1;
const MAX_AUTHOR = 80;
/** Per-IP rate limit: at most this many comments in WINDOW_MS. */
const RATE_LIMIT = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
// Published entry slugs — comments only attach to real posts. Keep in sync
// with src/content/monsters/*.mdx (regenerate when entries are added):
//   for f in src/content/monsters/*.mdx; do basename "$f" .mdx; done | sort
const ALLOWED_SLUGS = new Set([
  'aswang',
  'banshee',
  'beast-of-bray-road',
  'bigfoot-sasquatch',
  'black-eyed-children',
  'bunyip',
  'chupacabra',
  'dover-demon',
  'el-coco',
  'flatwoods-monster',
  'jersey-devil',
  'jiangshi',
  'kappa',
  'krampus',
  'loch-ness-monster',
  'mokele-mbembe',
  'mongolian-death-worm',
  'mothman',
  'owlman-of-mawnan',
  'rougarou',
  'skinwalker',
  'slenderman',
  'spring-heeled-jack',
  'the-rake',
  'wendigo',
  'yeti',
  'yowie',
  'yuki-onna',
]);

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

/** Keyed hash of the submitter IP — HMAC when a secret is configured, else a
 *  plain digest. Used only for rate limiting; never stored in cleartext. */
async function hashIp(ip: string, env: Env): Promise<string> {
  return env.IP_HASH_SECRET ? hmacHex(env.IP_HASH_SECRET, ip) : sha256(ip);
}

/** Verify a Cloudflare Turnstile token. Returns true when verification is not
 *  enabled (no secret) so the endpoint degrades gracefully. */
async function verifyTurnstile(token: string | undefined, env: Env, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip && ip !== '0.0.0.0') form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

function isValidSlug(slug: string): boolean {
  if (!SLUG_RE.test(slug)) return false;
  return ALLOWED_SLUGS.has(slug);
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const slug = String(params.slug ?? '');
  if (!isValidSlug(slug)) return json({ error: 'invalid slug' }, { status: 400 });

  const result = await env.COMMENTS_DB.prepare(
    `SELECT id, author, body, created_at
       FROM comments
      WHERE post_slug = ? AND approved = 1
      ORDER BY created_at ASC
      LIMIT 500`,
  )
    .bind(slug)
    .all<CommentRow>();

  return json({ comments: result.results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ params, env, request }) => {
  const slug = String(params.slug ?? '');
  if (!isValidSlug(slug)) return json({ error: 'invalid slug' }, { status: 400 });

  let payload: PostBody;
  try {
    payload = (await request.json()) as PostBody;
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  // Honeypot — silently 200 if filled, like a successful post.
  if (payload.website && payload.website.length > 0) {
    return json({ ok: true, spam: true });
  }

  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  // Bot check (no-op unless TURNSTILE_SECRET is configured).
  if (!(await verifyTurnstile(payload.turnstileToken, env, ip))) {
    return json({ error: 'verification failed — please try again' }, { status: 403 });
  }

  const author = (payload.author ?? '').trim();
  const body = (payload.body ?? '').trim();

  if (author.length < MIN_AUTHOR || author.length > MAX_AUTHOR) {
    return json({ error: 'author must be 1–80 characters' }, { status: 400 });
  }
  if (body.length < MIN_BODY || body.length > MAX_BODY) {
    return json({ error: 'body must be 1–5000 characters' }, { status: 400 });
  }

  // Hash the submitter's IP for rate limiting.
  const ipHash = await hashIp(ip, env);

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19);
  const recent = await env.COMMENTS_DB.prepare(
    `SELECT COUNT(*) as n FROM comments WHERE ip_hash = ? AND created_at >= ?`,
  )
    .bind(ipHash, windowStart)
    .first<{ n: number }>();

  if ((recent?.n ?? 0) >= RATE_LIMIT) {
    return json({ error: 'rate limited — try again in a few minutes' }, { status: 429 });
  }

  const approved = env.COMMENTS_REQUIRE_APPROVAL === '1' ? 0 : 1;

  const insert = await env.COMMENTS_DB.prepare(
    `INSERT INTO comments (post_slug, author, body, approved, ip_hash)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, author, body, created_at`,
  )
    .bind(slug, author, body, approved, ipHash)
    .first<CommentRow>();

  return json({ ok: true, pending: approved === 0, comment: insert ?? null }, { status: 201 });
};
