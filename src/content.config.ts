import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Each monster entry lives in src/content/monsters/<slug>.mdx.
 * Frontmatter is validated by Zod at build time; the MDX body holds the
 * sections, encounter cards, six rules, and outro.
 */
const monsters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/monsters' }),
  schema: z.object({
    number: z.string(),
    entryClass: z.string(),
    region: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    danger: z.number().int().min(1).max(10),
    bandColor: z.string(),

    illustration: z.object({ src: z.string(), alt: z.string(), caption: z.string() }).optional(),
    recordKind: z.enum(['reported', 'folklore', 'constructed']).optional(),
    recordNote: z.string().optional(),
    dossier: z
      .object({
        entity: z.string(),
        origin: z.string(),
        status: z.string(),
        stamps: z.array(z.string()).length(3),
        dangerLabel: z.string(),
        dangerNote: z.string(),
      })
      .optional(),
    rules: z
      .array(z.object({ title: z.string(), body: z.string() }))
      .length(6)
      .optional(),

    classification: z.string(),
    bottomBar: z.string().optional(),
    entryStatus: z.string().default('Active Entry'),

    status: z.enum(['draft', 'published']).default('draft'),
    publishDate: z.coerce.date().optional(),
    dateModified: z.coerce.date().optional(),

    /** Season number. Used to group entries on /entries and /seasons/<n>. */
    season: z.number().int().min(1).default(1),

    /**
     * Documented sighting locations for this monster. Each gets a pin on
     * the world map shown at the bottom of the entry page (and on the
     * combined /sightings page).
     *
     * Entries with an empty array (or only one location) still get a map —
     * but if the lore is explicitly placeless (Slenderman, the Rake), pass
     * `[]` and the map renders a "no fixed geography" overlay instead.
     */
    sightings: z
      .array(
        z.object({
          /** Short location name, e.g. "Point Pleasant, WV". */
          name: z.string(),
          /** Decimal latitude (-90..90, positive = north). */
          lat: z.number().min(-90).max(90),
          /** Decimal longitude (-180..180, positive = east). */
          lon: z.number().min(-180).max(180),
          /** Optional year — used in tooltip + sort order. */
          year: z.union([z.number(), z.string()]).optional(),
          /** Optional descriptor shown in the tooltip / legend. */
          label: z.string().optional(),
          /**
           * URL to the primary article / record for this specific encounter.
           * When set, the map pin and legend entry link out to it (in a new
           * tab). When omitted, the pin renders as a non-link with a
           * tooltip only.
           */
          sourceUrl: z.string().url().optional(),
        }),
      )
      .default([]),
  }),
});

/**
 * Glossary terms — each lives at src/content/glossary/<slug>.mdx.
 * Linked from monster entries so recurring terminology gets one canonical
 * definition (and one indexable URL each).
 */
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    /** Optional aliases / alternate spellings. */
    aliases: z.array(z.string()).default([]),
    /** One-line summary — used in tooltips and the index page. */
    summary: z.string(),
    /** Tags help cluster related terms (e.g., 'folklore', 'medical'). */
    tags: z.array(z.string()).default([]),
    /** Sort key — defaults to lower-cased term. */
    sortKey: z.string().optional(),
  }),
});

export const collections = { monsters, glossary };
