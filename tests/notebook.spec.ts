import { test, expect } from '@playwright/test';

const pages = [
  '/',
  '/entries/',
  '/most-dangerous/',
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
  '/drafts/banshee/pocket/',
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

test('page links, section jumps, and back navigation remain usable', async ({ page }) => {
  await page.goto('/entries/');
  await expect(page.locator('[data-notebook-page]')).toHaveCSS(
    'animation-name',
    'notebook-fade-in',
  );
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('.notebook-turn-layer')).toHaveCount(0);
  await page.getByRole('link', { name: 'Jump to Six Rules', exact: true }).click();
  await expect(page.locator('#six-rules-heading')).toBeInViewport();
  await page.getByRole('link', { name: 'Print pocket guide', exact: false }).click();
  await expect(page).toHaveURL(/\/pocket\/slenderman\/?$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/slenderman\/?#six-rules$/);
  await expect(
    page.getByRole('link', { name: 'Print pocket guide', exact: false }),
  ).toBeInViewport();
  await page.getByRole('link', { name: 'All entries', exact: false }).click();
  await page.getByRole('searchbox').fill('Mothman');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
});

test('reduced motion disables the page fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/entries/');
  await expect(page.locator('[data-notebook-page]')).toHaveCSS('animation-name', 'none');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('[data-notebook-page]')).toBeVisible();
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

test('throttled animation frames cannot block navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('[data-notebook-page]')).toBeVisible();
  await expect(page.locator('.notebook-turn-layer')).toHaveCount(0);
});
