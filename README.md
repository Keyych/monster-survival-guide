# Monster Survival Guide

A field-manual-themed website cataloguing cryptids and folklore entities —
origins, behaviour, documented encounters, and six survival rules per entry.
Built with [Astro](https://astro.build) and hosted on Cloudflare Pages.

Production: [monster-survival-guide.pages.dev](https://monster-survival-guide.pages.dev)

---

## Stack

- **Astro 6** — static site generator with MDX content collections
- **TypeScript** — strict mode end-to-end; frontmatter validated by Zod at build
- **Vanilla CSS** with `color-mix()` — no Tailwind, no UI framework
- **Cloudflare Pages** — hosting + automated deploys from `main`
- **Cloudflare Pages Functions + D1** — self-hosted comments backend, no third-party widget
- **Satori + @resvg/resvg-js** — per-entry social cards generated at build time
- **d3-geo + topojson-client + world-atlas** — equirectangular world maps with per-monster pins
- **@fontsource/...** — self-hosted Rajdhani / Sorts Mill Goudy / Anonymous Pro
- **Decap CMS** — optional GUI editor at `/admin/`

## Project layout

```
src/
├── components/                # Reusable Astro components
│   ├── BackLink.astro
│   ├── CommentSection.astro     # Comments form + list (D1-backed)
│   ├── DangerMeter.astro
│   ├── DocMeta.astro
│   ├── DocTitle.astro
│   ├── EncounterCard.astro
│   ├── MonsterMap.astro         # Per-entry world map
│   ├── NewsletterForm.astro     # Buttondown / Beehiiv
│   ├── Outro.astro
│   ├── RelatedEntries.astro
│   ├── Section.astro
│   ├── SixRules.astro
│   ├── SocialRow.astro
│   ├── StampRow.astro
│   └── StatRow.astro
├── config/site.ts             # Site name, URL, social, newsletter, contact, analytics
├── content/
│   ├── monsters/              # MDX entries — frontmatter Zod-validated
│   │   └── <slug>.mdx
│   └── glossary/              # MDX glossary terms
│       └── <slug>.mdx
├── content.config.ts          # Zod schemas for both collections
├── layouts/FieldManual.astro  # Page chrome, SEO meta, JSON-LD, fonts, footer
├── lib/
│   ├── og-image.ts            # Satori + resvg PNG generator
│   ├── reading-time.ts        # Word-count heuristic
│   ├── references.ts          # Extracts encounter references from MDX bodies
│   ├── seasons.ts             # Season grouping helpers
│   ├── structured-data.ts     # JSON-LD builders
│   └── world-map.ts           # Land-mass SVG path + lat/lon projector
├── pages/
│   ├── [...slug].astro        # Dynamic route — renders any published monster
│   ├── about.astro            # Editorial standards + contact
│   ├── bibliography.astro     # Aggregated sources across all entries
│   ├── entries.astro          # Index with search + danger + tag filter
│   ├── glossary/[slug].astro  # Per-term glossary page
│   ├── glossary/index.astro
│   ├── og/[slug].png.ts       # Per-entry OG image route
│   ├── rss.xml.ts             # RSS feed (auto-discovered from collection)
│   ├── seasons/[number].astro # Per-season index
│   ├── sightings.astro        # Combined world map (every monster, colour-coded)
│   ├── 404.astro
│   └── index.astro
└── styles/
    ├── field-manual.css       # Shared layout + components (≈1000 lines)
    └── pages/<page>.css       # Per-page :root color tokens (~15 lines each)

functions/
└── api/posts/[slug]/comments.ts   # Cloudflare Pages Function: GET + POST

migrations/
└── 0001_init.sql               # D1 schema for the comments table

public/
├── admin/                      # Decap CMS GUI editor
│   ├── index.html
│   └── config.yml
└── robots.txt                  # Sitemap reference for crawlers

tests/
└── smoke.spec.ts               # Playwright: crawls sitemap, asserts H1 + meta

.github/workflows/ci.yml        # check / build / format / e2e / Lighthouse
.lighthouserc.json              # Lighthouse CI thresholds
playwright.config.ts            # E2E config
```

## Commands

| Command                | Action                                       |
| :--------------------- | :------------------------------------------- |
| `npm install`          | Install dependencies                         |
| `npm run dev`          | Local dev server at `localhost:4321`         |
| `npm run build`        | Build to `./dist/`                           |
| `npm run preview`      | Preview the production build                 |
| `npm run check`        | `astro check` — TypeScript across the site   |
| `npm run format`       | Format all files with Prettier               |
| `npm run format:check` | Verify formatting (CI uses this)             |
| `npm run test:e2e`     | Run Playwright smoke tests against the build |
| `npm run lhci`         | Run Lighthouse CI                            |

## Adding a new monster entry

1. Create `src/content/monsters/<slug>.mdx`. Copy `wendigo.mdx` as the template — same component imports, same section structure.
2. Fill in the frontmatter (validated by Zod at build time):

   ```yaml
   ---
   number: '09'
   entryClass: 'Whatever Threat'
   region: 'Where It Lives'
   title: 'The Thing'
   description: 'One-sentence hook.'
   tags: ['tag one', 'tag two']
   danger: 7
   bandColor: '#6a4018'
   classification: 'monster survival guide  —  the thing'
   entryStatus: 'Active Entry'
   status: 'published' # 'draft' hides it from build
   publishDate: '2026-06-01' # future dates exclude it from build
   season: 1
   sightings:
     - {
         name: 'Place, Region',
         lat: 38.85,
         lon: -82.13,
         year: 1966,
         label: 'Description',
         sourceUrl: 'https://primary-source.example/',
       }
   ---
   ```

3. Create `src/styles/pages/<slug>.css` with theme tokens in `:root` (paper, ink, warn, accent, etc.). Copy from any existing file.
4. The `/entries` index, `/sightings` map, RSS feed, sitemap, and per-entry OG image all auto-discover the new entry. Nothing else to wire up.

### Illustrated entries and pocket guides

Published entries and all draft previews use the shared `EntryHeader` and `EntryNavigation` components.
Keep a single notebook column, quiet links in the page flow, and circled rule
numbers in the margin. The contents note opens on demand; it does not stay fixed
beside or above the prose.
All reading pages, including pocket-guide previews, share the 850px maximum
notebook width, responsive margins, and viewport minimum height. Longer entries
continue vertically. Keep that geometry in `field-manual.css`; do not introduce
page-specific wrapper widths. `NotebookMotion` curls the outer edge across a
temporary paper surface on same-site page links, then lets the arriving sheet
uncurl and settle. Narrow segments follow one continuous bend with a shaded
paper reverse and a moving fold shadow; the viewport-sized overlay is inert and
removed after the turn. The real page keeps its layout, focus, and scroll
position. Normal document navigation initializes each page's scripts. Section jumps, external links, downloads,
and reduced-motion preferences bypass the animation. Pocket guides retain their
separate A5 print dimensions. `tests/notebook.spec.ts` covers the shared frame,
navigation, history restoration, and motion/storage fallbacks, including
interrupted or throttled animations.

Copy the `illustration`, `recordKind`, `recordNote`, `dossier`, and `rules`
frontmatter from an existing published entry, then replace its values. Do not
repeat the title or dossier in the MDX body. Drafts use the same dossier frontmatter and notebook reading styles, with a draft notice
and a return link to the drafts queue. Their placeholder text remains unchanged;
they stay excluded from public indexes. Headers without artwork use the full text
width, and draft previews do not link to published pocket guides.

- **Artwork:** put a transparent PNG in `src/assets/illustrations/<slug>.png` and set
  `illustration.src` to `/illustrations/<slug>.png`. Use loose monochrome ink
  sketches with open shading, no painted background or colored rendering. Write
  descriptive alt text for accessibility. Keep the drawings uncaptioned so they
  feel like the writer’s doodles on the page.
  `InkIllustration` builds PNGs at the display size and twice that size for sharp
  screens, preserving transparency. CMS uploads also work via their public URL.
- **Source context:** choose `reported`, `folklore`, or `constructed` for
  `recordKind`. Explain the distinction in `recordNote`; a reported account is
  not verification of the creature. Encounter cards retain their individual
  verdicts and show a matching source-context label.
- **Six Rules:** keep exactly six `{ title, body }` objects in frontmatter. In
  the body, use `<SixRules rules={frontmatter.rules} title={frontmatter.title}
number={frontmatter.number} pocketHref="/pocket/<slug>/" />` inside the existing
  Six Rules section. The same data generates `/pocket/<slug>/`, with a one-page
  A5 print layout and a browser Print / Save PDF action.
- **Contents:** static `<Section heading="…">` headings generate a quiet, collapsible
  contents note in the page flow on desktop and mobile. The Six Rules section receives the stable `#six-rules`
  anchor. Keep headings unique and use double quotes around `heading` values.

The optional Decap editor includes these fields. `tests/reading.spec.ts` checks
contents links, search/filter behavior, mobile navigation, matching print rules,
and single-page A5 output for all eight current entries.

To **draft** an entry: set `status: 'draft'`. To **schedule** publication: set `status: 'published'` plus a future `publishDate:`. Both cases keep the entry out of the built site.

## Adding a glossary term

1. Create `src/content/glossary/<slug>.mdx` with frontmatter:
   ```yaml
   ---
   term: 'Algonquian'
   aliases: ['Algonkian']
   summary: 'One-line definition shown on the index.'
   tags: ['indigenous', 'language']
   ---
   ```
2. Body is plain MDX/Markdown. Link to monster entries with `[The Wendigo](/wendigo)`.

## Configuration

`src/config/site.ts` is the single source of truth for site-wide settings:

| Field                                                        | Purpose                                                                                               |
| :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `site.url`                                                   | Public canonical URL — drives canonical, OG, sitemap, RSS                                             |
| `site.name` / `site.signature` / `site.tagline`              | Branding shown in title, footer, JSON-LD                                                              |
| `social.youtube` / `x` / `tiktok` / `instagram` / `facebook` | Footer icons render only when a URL is set                                                            |
| `newsletter`                                                 | `null`, or `{ provider: 'buttondown' \| 'beehiiv', handle / publicationId }` — drives the signup form |
| `contact.email` / `correctionsEmail`                         | Surfaced on the `/about` page                                                                         |
| `cloudflareAnalyticsToken`                                   | When set, injects the privacy-respecting beacon script                                                |
| `upcoming`                                                   | Optional "coming soon" card at the bottom of `/entries`                                               |

If you change `site.url`, that's all you change — `astro.config.mjs` reads from this file.

## Comments — Cloudflare Pages Function + D1

Each monster page renders a comment form backed by a Pages Function at
`functions/api/posts/[slug]/comments.ts`, storing comments in a Cloudflare D1
SQLite database. No third-party widget, no GitHub login.

### One-time setup

```sh
npx wrangler login
npx wrangler d1 create monster-survival-guide-comments
npx wrangler d1 execute monster-survival-guide-comments \
  --file=migrations/0001_init.sql --remote
```

Then in the Cloudflare dashboard → **Pages** → project → **Settings** → **Bindings** → **Add D1 database**:

- Variable name: `COMMENTS_DB`
- D1 database: `monster-survival-guide-comments`

Click **Save**, then redeploy from the **Deployments** tab.

### Optional moderation gate

Add a Pages env variable `COMMENTS_REQUIRE_APPROVAL=1` in the dashboard. Every comment then stays hidden until you flip `approved=1` in D1:

```sh
# List pending.
npx wrangler d1 execute monster-survival-guide-comments --remote \
  --command "SELECT id, post_slug, author, body FROM comments WHERE approved = 0;"

# Approve.
npx wrangler d1 execute monster-survival-guide-comments --remote \
  --command "UPDATE comments SET approved = 1 WHERE id = 42;"

# Delete.
npx wrangler d1 execute monster-survival-guide-comments --remote \
  --command "DELETE FROM comments WHERE id = 42;"
```

### Built-in protections

- **Slug allowlist** — POSTs to unknown post slugs return 400
- **Per-IP rate limit** — 5 comments per 5 minutes; IPs are SHA-256 hashed before storage
- **Honeypot field** — bot submissions absorbed silently
- **Length validation** — 1–80 chars for author, 1–5000 for body
- **No raw IPs stored** — only hashed for rate limiting

## Decap CMS at `/admin/`

`public/admin/` ships a Decap CMS bundle that lets non-engineers edit MDX
entries through a GUI. By default it expects Netlify Identity / git-gateway;
swap to a GitHub OAuth proxy for Cloudflare Pages, or flip `local_backend: true`
in `public/admin/config.yml` and run `npx decap-server` next to `npm run dev`
for offline authoring.

## CI

`.github/workflows/ci.yml` runs on every PR + push to `main`:

1. **build** — `npm run check`, `npm run build`, `npm run format:check`. Uploads `dist/` as an artifact.
2. **e2e** — downloads the artifact, runs `npx playwright test`. The smoke test crawls every URL in the sitemap and asserts every page returns 200 with a non-empty `<h1>` and a meta description ≥10 chars.
3. **lighthouse** — runs `npm run lhci` against the built `dist/`. Asserts ≥0.9 on accessibility + SEO (error) and ≥0.9 on perf + best practices (warn).

---

## Changelog — what changed and why

This site started as a hand-authored Astro Minimal starter with eight monster
pages, each duplicating ~130 lines of CSS, hand-written component markup, and
no SEO, accessibility, search, comments, or maps. The refactor that brought it
to its current state landed in a series of merges to `main`. Highlights, in
roughly the order they shipped:

### Architecture refactor

- **CSS deduplication.** ~1,200 lines of duplicated per-page CSS consolidated into a single shared `field-manual.css` using `color-mix()` and CSS variables. Per-page files dropped from ~130 lines to ~15 lines — they contain only the page's `:root` color tokens now.
- **Restored Astro CSS bundling.** Replaced the `import css from '...css?raw'` + `<style is:inline set:html={css}>` pattern with plain CSS imports, so Vite can dedupe and cache.
- **Reusable components.** Page chrome extracted into ~15 components (`BackLink`, `StampRow`, `DocMeta`, `DocTitle`, `DangerMeter`, `StatRow`, `SixRules`, `EncounterCard`, `Outro`, `SocialRow`, `NewsletterForm`, `MonsterMap`, `RelatedEntries`, `CommentSection`). Each monster entry's body went from ~150 lines of repeated markup to plain MDX with section components.
- **Typed monster entries.** Old `.astro` pages exporting a `const entry` were replaced with **MDX content collections** validated by Zod at build time. Drafts (`status: 'draft'`) and future-dated posts (`publishDate:`) are excluded from the build.
- **Dynamic route.** `src/pages/[...slug].astro` renders every monster from the collection; the eight per-page `.astro` files were retired.
- **Prettier + `prettier-plugin-astro`.** `npm run format` and `format:check`.
- **`astro check`** for TypeScript.
- **`packageManager`** pinned in `package.json` so collaborators don't end up with mismatched lockfiles.

### SEO + metadata

- **Site URL** set in `astro.config.mjs`; **`@astrojs/sitemap`** generates `sitemap-index.xml` covering all routes on every build.
- **`@astrojs/rss`** feed at `/rss.xml`, auto-discovered from the content collection.
- **JSON-LD structured data.** Layout emits a single `@graph` with `Person` + `WebSite` schemas on every page, plus an `Article` schema on monster pages. What Google rich results and AI search citations key off of.
- **Open Graph + Twitter cards** with canonical URLs.
- **Per-entry OG PNGs.** `src/lib/og-image.ts` uses Satori + `@resvg/resvg-js` to generate a 1200×630 social card per monster at build time, each showing the entry's class / region / title / hook / danger meter / bandColor rail. Fonts (Rajdhani Bold + Sorts Mill Goudy Italic) fetched once from Google Fonts on first build, cached in module scope.
- **`robots.txt`** in `public/` with sitemap reference.
- **Home-page typo fix** ("This show guide not tell you" → "This guide does not tell you").

### Performance

- **Self-hosted fonts via `@fontsource`.** Dropped the Google Fonts CDN. Vite bundles all woff2 into `/_astro/` with `font-display: swap`. No third-party request on first paint.
- **`prefers-reduced-motion`** honored.
- **Print stylesheet.** A field manual that prints like a field manual is on-brand. `@media print` hides the chrome, expands external links inline (URL appended after the text), forces page-break-inside: avoid on encounter cards.

### Accessibility

- **Semantic headings.** `.doc-title` → `<h1>`, `.section-head` → `<h2>`, card titles → `<h3>`. Pages had no `<h1>` before; they do now.
- **Landmarks.** Real `<main>`, `<footer>`, and `<section>` elements throughout.
- **Skip-to-main-content link.** First focusable element on every page, hidden until focused.
- **`:focus-visible`** outlines on every interactive element.
- **DangerMeter** exposed as `role="img"` with an aria-label; decorative bars hidden from AT.
- **Decorative SVGs** marked `aria-hidden`.
- **Social icons** render only when a real URL is configured — no more `href="#"` placeholder links.
- **Contrast bump** on muted-text tokens to clear WCAG AA on small text against the cream paper.

### Content features

- **`/entries` menu** got search + danger-band filter + tag filter. The search input matches across title, hook, entry class, region, and tags — purely client-side, ~80 lines of inline JS, no fetch / no index. Tag filter is collapsible (show first 5, expand to all). Filters AND together; an empty-state announces when nothing matches.
- **Per-monster world maps.** Each monster page renders an equirectangular world map (Natural Earth 110m land outline) with pins for that monster's documented sightings. Map sits directly below the "Two Cases on the Record" section, anchored to the encounter record it visualises. Pins link out to a real article about the sighting (BBC News for the Waukesha stabbing, Smithsonian Folklife for Point Pleasant, Linda Godfrey's archive for the Beast of Bray Road, etc.). 51 pins total across the 8 entries.
- **Combined `/sightings` map.** Every monster's pins on a single world map, colour-coded by `bandColor` with a colour-keyed legend.
- **Related entries.** Bottom of each monster page surfaces 3 other entries scored by tag overlap + danger proximity.
- **Reading time + word count badge** under each entry, computed from the rendered MDX body.
- **`/about`** — Zazu byline page with six editorial standards, a research-not-survival-advice disclaimer, and the corrections email surfaced from `site.ts`.
- **`/bibliography`** — every cited reference across every entry, grouped by entry. Extracted at build time from each MDX body's `<EncounterCard references={[...]}>` blocks via `src/lib/references.ts`.
- **`/glossary`** — typed content collection with index + per-term pages. Starter terms: Algonquian, Cryptid, Liminal space, Sleep paralysis, Wendigo psychosis, Yee Naaldlooshii.
- **`/seasons/[number]`** — dynamic per-season route. `/entries` opens with a Browse-by-Season chip row. Adding Season II is a content-only change: write entries with `season: 2`.
- **`/404`** — field-manual styled "entry not on file" page.

### Editorial sourcing

- **Every Wikipedia URL removed** from pin sourceUrls and encounter card references. Replacements lean on primary / non-Wiki sources: Dictionary of Canadian Biography for Jack Fiddler, Smithsonian Folklife for Point Pleasant, Historic Mysteries Network for the Silver Bridge collapse, WBEZ "Curious City" for the 2017 Chicago Mothman flap, Linda Godfrey's archive for the Beast of Bray Road, the Tetrapod Zoology blog for the Michigan Dogman, Spooky Isles + HuffPost UK for the Black-Eyed Children, Britannica for the Skinwalker entry, Legends of America for Skinwalker Ranch, Atlas Obscura for the international BEK cases.

### Engagement

- **YouTube / X / TikTok** social links wired into the footer's `SocialRow`.
- **Newsletter signup** (`NewsletterForm`) in the sign-off block. Supports Buttondown and Beehiiv via a single `newsletter` config slot. No JS bundle — plain HTML POST to the provider's embed endpoint. Hidden when not configured.
- **Comments.** Started as Giscus (GitHub Discussions). Replaced with a **custom Cloudflare Pages Function + D1** backend — no third-party widget, no GitHub login required for commenters. Per-IP rate limiting (hashed), honeypot field, optional moderation gate.
- **Cloudflare Web Analytics** config slot in `site.ts` (off by default — paste a beacon token to enable).

### Authoring tooling

- **Decap CMS at `/admin/`** with the monsters + glossary collection schemas mapped to GUI form fields. Configured with the Netlify Identity widget for git-gateway auth + a boot-loading fallback so the page never appears blank.

### Quality

- **Playwright smoke tests** (`tests/smoke.spec.ts`). The test reads the sitemap, fetches every URL, and asserts each returns 200 with a non-empty `<h1>` and a meaningful meta description.
- **Lighthouse CI** (`.lighthouserc.json`) runs against the built `dist/` on home + entries + wendigo + bibliography. Asserts ≥0.9 on accessibility and SEO (error), ≥0.9 on perf and best practices (warn).
- **GitHub Actions CI** runs `check`, `build`, `format:check`, e2e, and Lighthouse on every PR + push to `main`.

### Deployment

- **Cloudflare Pages**, deploys from `main` on every push. Build command `npm run build`, output `dist/`.
- **Cloudflare Pages Function** at `functions/api/posts/[slug]/comments.ts` deploys alongside the static site — no separate Worker project to manage.
- **Cloudflare D1** SQLite database `monster-survival-guide-comments` bound to the Pages project as `COMMENTS_DB` for the comments backend.

---

## Rejected directions

Things that were built, suggested, or partially shipped during the refactor and
then **deliberately rolled back** at the editor's direction. Recorded here so
that if any of these come up again in future iterations, the previous decision
is on the record with the reasoning.

### Stylised North-America-only map

- **What was built first.** A hand-drawn SVG outline of North America (~30 polygon vertices) inside a 1000×600 viewBox, with one pin per monster placed at hand-tuned x/y coordinates relative to that outline. Lived at `/sightings` and was embedded at the bottom of each monster page.
- **Why it was rejected.** Stylised continent shape didn't read as geography, the proportions were rough, and the encounter record isn't North-America-only.
- **What replaced it.** Real equirectangular world map driven by `d3-geo` + the `world-atlas` 110m TopoJSON dataset. Pins now use real `lat` / `lon` and project through a shared function (`src/lib/world-map.ts`), so they line up correctly on any continent.

### Map at the bottom of the page

- **What was tried first.** `<MonsterMap>` was invoked from the dynamic route (`[...slug].astro`) **after** the entire MDX body — so it appeared below the outro on every entry page.
- **Why it was rejected.** Disconnected from the encounter record it visualises; readers scrolled past the outro and missed it.
- **What replaced it.** The component is now invoked from inside each MDX file, anchored directly between the "Two Cases on the Record" section and "Before You Go." Adding a new entry means dropping `<MonsterMap title={frontmatter.title} sightings={frontmatter.sightings} />` between those sections.

### Pin tooltips without the monster name

- **What was tried first.** Per-monster map pins showed `<year> · <place> — <label>` on hover. Reader had to know which page they were on.
- **Why it was rejected.** Tooltips and screen-reader announcements lacked the entity name; the combined `/sightings` map handled this correctly but the per-entry map didn't match.
- **What replaced it.** Pin titles now lead with the monster's name: `The Wendigo — Fort Saskatchewan, Alberta (1879) · Swift Runner case…`. Same shape as the combined map, consistent across the site.

### Map figcaption with the monster name on top

- **Briefly considered.** When the editor said "titled name of monster," the first interpretation was a big figcaption rendering the entry's name above the map (an "eyebrow + display title" treatment).
- **Why it was rejected.** Not what was meant — the editor wanted the monster's name in each pin's hover title, not a duplicated heading above the map (the entry's `<h1>` already shows the name above the fold).
- **What replaced it.** Figcaption stays as the small `DOCUMENTED SIGHTING LOCATIONS` eyebrow only; the monster name lives in pin tooltips.

### Map pins linking back to the entry page

- **What was tried first.** Each pin was an `<a href="/{monsterId}">` — clicking returned to the entry's own page.
- **Why it was rejected.** A pin on the Wendigo page linking back to the Wendigo page is a dead loop; it gave readers no new information.
- **What replaced it.** Every pin links out (in a new tab, `rel="noopener noreferrer"`) to a real article about that specific sighting — BBC News for Waukesha, Linda Godfrey's archive for Bray Road, Smithsonian Magazine for the Phenomenon of 1909, etc.

### Wikipedia as a primary source

- **What was tried first.** Many pin `sourceUrl` fields and encounter card references pointed at Wikipedia articles (`en.wikipedia.org/wiki/Mothman`, `…/Skinwalker_Ranch`, etc.).
- **Why it was rejected.** Wikipedia is a tertiary source, not a primary one — and an editorial guide that takes its sourcing standards seriously shouldn't lean on it as the citation of record.
- **What replaced it.** **Zero Wikipedia URLs anywhere on the site.** Replacement sources lean primary / scholarly: Dictionary of Canadian Biography for Jack Fiddler; Smithsonian Folklife Magazine for Point Pleasant; Smithsonian Magazine for the Phenomenon of 1909; Historic Mysteries Network for the Silver Bridge collapse and the Blackbird of Chernobyl; WBEZ "Curious City" for the 2017 Chicago Mothman flap; Linda Godfrey's archive for the Beast of Bray Road; Tetrapod Zoology (Darren Naish) for the Michigan Dogman; Spooky Isles + HuffPost UK for the Black-Eyed Children; Britannica for the Skinwalker entry; Legends of America for Skinwalker Ranch; Atlas Obscura for the international BEK cases.

### Giscus comments

- **What was tried first.** Comments + reactions via Giscus, backed by GitHub Discussions. Discussions were enabled on the repo via the GitHub API, the giscus IDs were resolved, and the widget was wired in.
- **Why it was rejected.** Giscus requires every commenter to sign in with a GitHub account. For a content site aimed at general readers, that's a high signup barrier and most of the audience won't have an account. Also: Giscus needs the repo to be public for unauthenticated visitors to read existing comments, which created an unrelated visibility decision.
- **What replaced it.** A small **Cloudflare Pages Function + D1** comments backend at `/api/posts/<slug>/comments`. No login required, no third-party widget, no JavaScript framework — just `<form>` POSTs to a same-origin endpoint, with per-IP rate limiting (hashed IPs), a honeypot field, and an optional moderation gate.

### Comments paths that weren't taken

When picking a comment system, four other paths were considered and dropped:

- **Hyvor Talk** ($5/mo hosted, polished UX) — rejected because a custom Pages Function + D1 is free, owned, and integrates with the Cloudflare account already hosting the site.
- **Webmentions + Mastodon replies** (decentralised, indie-web) — rejected as too niche for the target audience and operationally fiddly.
- **No comments, point at email instead** — rejected; comments were wanted, just not via Giscus.
- **Cusdis hosted SaaS** — rejected once the Cloudflare-native custom backend was on the table.

### Decap CMS with GitHub auth

- **What was tried first.** The Decap CMS `config.yml` defaults to `backend: git-gateway` (Netlify Identity).
- **Why it was partially rejected.** The site is hosted on Cloudflare Pages, not Netlify — git-gateway works there only with a separate Identity provider, and that's extra ops work.
- **Current state.** `config.yml` ships with both backends documented (git-gateway + github), and a one-line toggle (`local_backend: true`) for offline authoring via `npx decap-server`. A proper Cloudflare-native auth proxy for Decap is a future task if/when non-engineer authoring becomes important.

### Hamilton County, Florida (Slenderman)

- **What was tried first.** A pin for the 2014 Slenderman-inspired house fire was placed in **Hamilton County, FL** at coords (30.55, -82.95).
- **Why it was wrong.** Factually inaccurate — the actual fire was in **Pasco County** (Port Richey), Florida. The Hamilton County pin was based on a hallucinated detail and the news source confirms Pasco.
- **What replaced it.** The Hamilton County pin was removed entirely. The Pasco County pin was kept and its label updated to point at the correct AJC.com news article about the Port Richey case.

### Slenderman, the Rake — fictional encounter pins

- **What was almost rejected.** The Rake has no documented real-world encounters — the entire compendium is constructed lore from a 2005 forum thread. Pinning the fictional 1691 mariner's log, 1880 Spanish journal, and 2003 Niagara Falls "central case" felt like dressing fiction up as fact.
- **What we did instead.** Pins **kept**, but every fictional pin's label is explicitly flagged as `lore · constructed` and links to the original creepypasta.com compendium. Self-reported sightings (Reddit sleep-paralysis cluster, etc.) are flagged `self-report`. The map's editorial honesty stays intact because the labels do.

---

## Credits

Built collaboratively over many iterations with [Claude Code](https://claude.com/claude-code).
The prose of every entry — and the editorial framing — is by Zazu.

## License

Code: MIT. Prose: see individual entries — most are CC BY-NC-SA 4.0 by default
unless an entry's footer says otherwise.
