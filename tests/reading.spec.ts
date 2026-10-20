import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

// Derive the published set from content so the suite tracks drafts being
// promoted into published entries, rather than hard-coding the list/count.
const slugs = readdirSync('src/content/monsters')
  .filter((f) => f.endsWith('.mdx'))
  .filter((f) =>
    /^status:\s*['"]?published/m.test(readFileSync(`src/content/monsters/${f}`, 'utf8')),
  )
  .map((f) => f.replace(/\.mdx$/, ''));
const publishedCount = slugs.length;

test('search combines with danger filters and reset restores the archive', async ({ page }) => {
  await page.goto('/entries/');
  await expect(page.getByRole('searchbox', { name: 'Search entries' })).toBeInViewport();
  await page.getByRole('searchbox', { name: 'Search entries' }).fill('Mothman');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText(`1 of ${publishedCount} entries`);
  await page.locator('.index-filters summary').click();
  await page.getByRole('button', { name: '9–10', exact: true }).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(0);
  await expect(page.locator('[data-filter-empty]')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('[data-card]:visible')).toHaveCount(publishedCount);
  await expect(page.getByRole('status')).toHaveText(
    `${publishedCount} of ${publishedCount} entries`,
  );
});

test('each entry has working contents, an illustration, and the same six rules in print', async ({
  page,
}) => {
  for (const slug of slugs) {
    await test.step(slug, async () => {
      await page.goto(`/${slug}/`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.entry-reading-time')).toBeVisible();
      await expect(page.locator('.creature-study img')).toHaveJSProperty('complete', true);
      expect(
        await page
          .locator('.creature-study img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBeGreaterThan(0);
      const targets = await page
        .locator('[data-contents-link]')
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hash));
      for (const target of targets) await expect(page.locator(target)).toHaveCount(1);
      await expect(page.locator('#six-rules .rules-list > li')).toHaveCount(6);
      const rules = await page
        .locator('#six-rules .rules-list li > span:last-child')
        .allTextContents();
      await page.getByRole('link', { name: 'Printable pocket guide' }).click();
      await expect(page).toHaveURL(new RegExp(`/pocket/${slug}/`));
      await expect(page.locator('[data-notebook-page]')).toBeVisible();
      // Join the pocket guide's title (<h2>) and body (<p>) with an explicit
      // space. They are separate block elements, so their combined textContent
      // has no reliable separator — Astro's whitespace handling between them is
      // not guaranteed — and the entry renders "title body" in a single span.
      const printed = await page.locator('.pocket-rules li > div').evaluateAll((divs) =>
        divs.map((d) => {
          const h2 = d.querySelector('h2')?.textContent ?? '';
          const p = d.querySelector('p')?.textContent ?? '';
          return `${h2} ${p}`;
        }),
      );
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(printed.map(normalize)).toEqual(rules.map(normalize));
    });
  }
});

test('desktop section note and direct Six Rules jump work', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/mothman/');
  await expect(page.locator('.entry-contents')).not.toHaveAttribute('open');
  await page.locator('.entry-contents summary').click();
  await page
    .getByRole('navigation', { name: 'Entry sections', exact: true })
    .getByRole('link', { name: 'Origins', exact: true })
    .click();
  await expect(page.locator('#where-it-comes-from-heading')).toBeInViewport();
  await expect(page.locator('.entry-contents')).not.toHaveAttribute('open');
  await page.getByRole('link', { name: 'Jump to Six Rules' }).click();
  await expect(page).toHaveURL(/#six-rules$/);
  await expect(page.locator('#six-rules-heading')).toBeInViewport();
  await expect(page.locator('.entry-contents')).not.toBeInViewport();
});

test('mobile contents close after a section choice and keep the heading in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/mothman/');
  await page.locator('.entry-contents summary').click();
  await page
    .getByRole('navigation', { name: 'Entry sections', exact: true })
    .getByRole('link', { name: 'The Six Rules', exact: true })
    .click();
  await expect(page.locator('.entry-contents')).not.toHaveAttribute('open');
  await expect(page.locator('#six-rules-heading')).toBeFocused();
  await expect(page.locator('#six-rules-heading')).toBeInViewport();
  const top = await page
    .locator('#six-rules-heading')
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('mobile index shows search and the first creature without a long introduction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/entries/');
  await expect(page.getByRole('searchbox')).toBeInViewport();
  await expect(page.locator('[data-card]').first()).toBeInViewport();
});

test('keyboard navigation and pocket guides remain usable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://localhost:4321/mothman/');
  await page.getByRole('link', { name: 'Jump to Six Rules' }).press('Enter');
  await expect(page.locator('#six-rules-heading')).toBeInViewport();
  await page.getByRole('link', { name: 'Print pocket guide', exact: false }).press('Enter');
  await expect(page.locator('.pocket-rules li')).toHaveCount(6);
  await context.close();
});

test('all pocket guides fit one A5 print page', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  for (const slug of slugs) {
    await page.goto(`/pocket/${slug}/`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.print-toolbar')).toBeHidden();
    const pdf = await page.pdf({ preferCSSPageSize: true });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? [];
    expect(pages.length, `${slug} should fit a single A5 page`).toBe(1);
  }
});
