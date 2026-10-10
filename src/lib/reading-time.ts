/**
 * Estimate reading time and word count from raw MDX or Astro source.
 * The entry route appends its frontmatter rules so they count once, alongside
 * the body text, in the title's reading estimate.
 *
 * The helper strips the Astro frontmatter, HTML/component tags, and JSX
 * expressions, then counts whitespace-separated tokens that contain a letter
 * or digit. Reading speed is a conventional 200 wpm.
 */
export interface ReadingStats {
  /** Number of words detected. */
  words: number;
  /** Estimated minutes (rounded to nearest, minimum 1). */
  minutes: number;
}

const WORDS_PER_MINUTE = 200;

export function readingStats(astroSource: string): ReadingStats {
  // Strip Astro frontmatter (everything between the first two --- lines).
  const withoutFrontmatter = astroSource.replace(/^---\n[\s\S]*?\n---/, '');

  // Strip JSX-style expressions and HTML tags.
  const stripped = withoutFrontmatter
    .replace(/^import .*?;\s*$/gm, '')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Decode the few HTML entities we use in copy so they count as words.
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ');

  const tokens = decoded.split(/\s+/).filter((token) => /[a-z0-9]/i.test(token));

  const words = tokens.length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { words, minutes };
}
