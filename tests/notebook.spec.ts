import { test, expect } from '@playwright/test';

const pages = [
  '/',
  '/entries/',
  '/slenderman/',
  '/mothman/',
  '/about/',
  '/sightings/',
  '/bibliography/',
  '/glossary/',
  '/glossary/cryptid/',
  '/seasons/1/',
  '/drafts/',
  '/drafts/banshee/',
  '/404.html',
  '/pocket/slenderman/',
];

for (const width of [1280, 375]) {
  test(`all page types share notebook geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let expected: { width: number; x: number; left: string; right: string } | undefined;
    for (const path of pages) {
      await page.goto(path);
      const geometry = await page.locator('[data-notebook-page]').evaluate((sheet) => {
        const rect = sheet.getBoundingClientRect();
        const inner = getComputedStyle(sheet.querySelector('.doc-inner')!);
        return { width: rect.width, x: rect.x, left: inner.paddingLeft, right: inner.paddingRight };
      });
      expected ??= geometry;
      expect(geometry, path).toEqual(expected);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        path,
      ).toBeLessThanOrEqual(width);
    }
  });
}

test('page links navigate, section jumps stay still, and back navigation remains usable', async ({
  page,
}) => {
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  // Anchor IDs on the rendered page stay unique.
  expect(
    await page.locator('[id]').evaluateAll((elements) => {
      const ids = elements.map((element) => element.id);
      return new Set(ids).size === ids.length;
    }),
  ).toBe(true);

  await page.getByRole('link', { name: 'Jump to Six Rules', exact: true }).click();
  await expect(page.locator('#six-rules-heading')).toBeInViewport();

  await page.getByRole('link', { name: 'Print pocket guide', exact: false }).click();
  await expect(page).toHaveURL(/\/pocket\/slenderman\/?$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/slenderman\/?#six-rules$/);
  // The print link is below the rules; returning keeps that scroll position.
  await expect(
    page.getByRole('link', { name: 'Print pocket guide', exact: false }),
  ).toBeInViewport();

  await page.getByRole('link', { name: 'All entries', exact: false }).click();
  await expect(page).toHaveURL(/\/entries\/?$/);
  await page.getByRole('searchbox').fill('Mothman');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
});

test('blocked session storage never prevents a page link from working', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
  });
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('h1')).toHaveText('Slenderman');
});
