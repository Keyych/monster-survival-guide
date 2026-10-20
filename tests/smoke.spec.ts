/**
 * Smoke test: every URL in the sitemap should return 200, render an <h1>,
 * and have an SEO description. Catches the kind of subtle break that "build
 * succeeded" hides — components rendering empty, missing meta tags, broken
 * runtime in client scripts.
 */
import { test, expect, request } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';

interface SitemapIndexEntry {
  loc: string;
}
interface SitemapUrlEntry {
  loc: string;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

async function listSitemapUrls(baseURL: string): Promise<string[]> {
  const ctx = await request.newContext();
  const parser = new XMLParser({ ignoreAttributes: false });

  const indexRes = await ctx.get(`${baseURL}/sitemap-index.xml`);
  expect(indexRes.ok(), 'sitemap-index.xml served').toBeTruthy();
  const index = parser.parse(await indexRes.text());
  const indexEntries = asArray<SitemapIndexEntry>(index.sitemapindex?.sitemap);
  expect(indexEntries.length).toBeGreaterThan(0);

  const urls: string[] = [];
  for (const entry of indexEntries) {
    // The sitemap-index points at the production domain; rewrite each child
    // sitemap URL to fetch from the local preview server.
    const childPath = new URL(entry.loc).pathname;
    const child = await ctx.get(`${baseURL}${childPath}`);
    expect(child.ok(), `${childPath} served`).toBeTruthy();
    const childParsed = parser.parse(await child.text());
    for (const u of asArray<SitemapUrlEntry>(childParsed.urlset?.url)) {
      urls.push(new URL(u.loc).pathname);
    }
  }
  await ctx.dispose();
  return urls;
}

test('sitemap pages load with H1 + meta description', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!;
  const paths = await listSitemapUrls(baseURL);
  expect(paths.length).toBeGreaterThan(5);

  for (const path of paths) {
    await test.step(`GET ${path}`, async () => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `status for ${path}`).toBe(200);

      const h1 = await page.locator('h1').first().textContent();
      expect(h1?.trim().length, `h1 non-empty on ${path}`).toBeGreaterThan(0);

      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length, `description meta on ${path}`).toBeGreaterThan(10);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `canonical link on ${path}`).toMatch(/^https?:\/\//);
    });
  }
});

test('skip-to-main link focuses main', async ({ page }) => {
  await page.goto('/wendigo/');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className ?? '');
  expect(focused).toContain('skip-link');
});

test('entries filter hides cards', async ({ page }) => {
  await page.goto('/entries/');
  const before = await page.locator('[data-card]:not([hidden])').count();
  expect(before).toBeGreaterThan(1);

  // Click the 9–10 danger band.
  await page.locator('.index-filters summary').click();
  await page.getByRole('button', { name: '9–10' }).click();
  await expect(page.getByRole('button', { name: '9–10' })).toHaveAttribute('aria-pressed', 'true');
  const after = await page.locator('[data-card]:not([hidden])').count();
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});
