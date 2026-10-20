import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

const drafts = readdirSync('src/content/monsters')
  .filter((file) =>
    /^status: ['"]?draft/m.test(readFileSync(`src/content/monsters/${file}`, 'utf8')),
  )
  .map((file) => file.replace(/\.mdx$/, ''));

for (const width of [1280, 375]) {
  test(`all 20 drafts use the notebook reading layout at ${width}px`, async ({ page }) => {
    expect(drafts).toHaveLength(20);
    await page.setViewportSize({ width, height: 900 });
    for (const slug of drafts) {
      await page.goto(`/drafts/${slug}/`);
      await expect(page.locator('.document--entry .entry-content')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.entry-opening')).toBeVisible();
      await expect(page.locator('.draft-banner')).toContainText('awaiting research');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex,nofollow',
      );
      await expect(page.locator('a[href^="/pocket/"]')).toHaveCount(0);
      await expect(page.locator('.notebook-rules li')).toHaveCount(6);
      await expect(page.locator('.entry-back')).toHaveAttribute('href', '/drafts/');
      await page.getByRole('link', { name: 'Jump to Six Rules' }).click();
      await expect(page.locator('#six-rules-heading')).toBeInViewport();
      await page.locator('.entry-contents summary').click();
      const links = page.locator('[data-contents-link]');
      expect(await links.count()).toBeGreaterThan(6);
      const target = await links.first().getAttribute('href');
      await links.first().click();
      await expect(page.locator(`${target}-heading`)).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        slug,
      ).toBeLessThanOrEqual(width);
      expect(
        await page.locator('[id]').evaluateAll((nodes) => {
          const ids = nodes.map((node) => node.id);
          return new Set(ids).size === ids.length;
        }),
        slug,
      ).toBe(true);
    }
  });
}
