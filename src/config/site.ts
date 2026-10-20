/**
 * Single source of truth for site-wide values.
 * Update the URLs here once and they propagate to layout, sitemap,
 * RSS, social cards, and footer.
 */
export const site = {
  name: 'Monster Survival Guide',
  shortName: 'Field Manual',
  signature: 'Stallbaumers',
  tagline: 'Identification · Survival · Documented Accounts',
  description:
    'A field manual for the things that should not exist — researched, verified where possible, and written so you have the information before you need it.',
  /**
   * Public production URL. Used by canonical, og:url, sitemap.
   * Replace once the site has a real domain.
   */
  url: 'https://monster-survival-guide.pages.dev',
  defaultOgImage: '/og-default.png',
  season: 'Season One',
} as const;

/**
 * Cloudflare Web Analytics beacon token. When set, the layout injects the
 * privacy-respecting beacon script on every page. Get a token from
 * Cloudflare Dashboard → Analytics & Logs → Web Analytics → Add a site.
 * Leave as `null` to disable analytics entirely.
 */
export const cloudflareAnalyticsToken: string | null = null;

/**
 * Cloudflare Turnstile site key (public) for the comment form's bot check.
 * When non-null, the comment form renders the Turnstile widget and the
 * comments Pages Function enforces it (requires TURNSTILE_SECRET in the Pages
 * env). Leave `null` to disable. Create a widget at Cloudflare Dashboard →
 * Turnstile. The site key is public; the secret is an env var, never here.
 */
export const turnstileSiteKey: string | null = '0x4AAAAAAFd2Hd_0DSsg1JdH';

/**
 * Contact details surfaced on the About page (and used as `mailto:` links).
 */
export const contact: {
  email: string | null;
  correctionsEmail: string | null;
} = {
  email: 'hello@monstersurvivalguide.show',
  correctionsEmail: 'corrections@monstersurvivalguide.show',
};

/**
 * Newsletter sign-up. Set `provider` and the matching identifier to wire up
 * the signup form in the sign-off block. Both providers expose simple POST
 * embed endpoints — no JavaScript bundle required.
 *
 *   { provider: 'buttondown', handle: 'your-buttondown-username' }
 *   { provider: 'beehiiv',    publicationId: 'pub_xxxxxxxx' }
 *
 * Leave as `null` to hide the form.
 */
export type NewsletterConfig =
  | { provider: 'buttondown'; handle: string }
  | { provider: 'beehiiv'; publicationId: string };

export const newsletter: NewsletterConfig | null = null;

/**
 * Comments are now powered by a Cloudflare Pages Function backed by D1
 * (see functions/api/posts/[slug]/comments.ts and migrations/0001_init.sql).
 * No third-party widget, no GitHub login required.
 */

/**
 * Social links shown in the footer. Set a real URL to render the icon;
 * leave a value as `null` (or empty) to hide that icon entirely.
 * No more `href="#"` placeholder links.
 */
export const social: Record<'youtube' | 'facebook' | 'instagram' | 'x' | 'tiktok', string | null> =
  {
    youtube: null,
    facebook: null,
    instagram: null,
    x: 'https://x.com/stallbaumer_',
    tiktok: 'https://www.tiktok.com/@keyych',
  };

/**
 * Optional teaser shown at the bottom of the entries menu.
 * Set to `null` to hide the "coming soon" card entirely.
 */
export const upcoming: { label: string; title: string; description: string } | null = {
  label: 'Next Entry · Coming Soon',
  title: 'Unknown Entity',
  description: 'The next entry is being prepared. Check back soon.',
};
