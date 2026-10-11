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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('animationstart', (event) => {
      if (!event.animationName.startsWith('notebook-')) return;
      try {
        const turns = JSON.parse(sessionStorage.getItem('observed-turns') || '[]');
        turns.push(event.animationName);
        sessionStorage.setItem('observed-turns', JSON.stringify(turns));
      } catch {
        // Some tests deliberately disable storage.
      }
    });
  });
});

test('page links flip, section jumps stay still, and back navigation remains usable', async ({
  page,
}) => {
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-notebook-arrival');
  const turns = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('observed-turns') || '[]'),
  );
  expect(turns).toEqual(['notebook-depart', 'notebook-arrive']);

  await page.getByRole('link', { name: 'Jump to Six Rules', exact: true }).click();
  await expect(page.locator('#six-rules-heading')).toBeInViewport();
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem('observed-turns') || '[]')),
  ).toEqual(turns);

  await page.getByRole('link', { name: 'Print pocket guide', exact: false }).click();
  await expect(page).toHaveURL(/\/pocket\/slenderman\/?$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-notebook-arrival');
  await page.goBack();
  await expect(page).toHaveURL(/\/slenderman\/?#six-rules$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-notebook-departure');
  await expect(page.locator('html')).not.toHaveAttribute('data-notebook-arrival');
  // The print link is below the rules; clicking it scrolls past the heading.
  await expect(
    page.getByRole('link', { name: 'Print pocket guide', exact: false }),
  ).toBeInViewport();

  await page.getByRole('link', { name: 'All entries', exact: false }).click();
  await expect(page).toHaveURL(/\/entries\/?$/);
  await page.getByRole('searchbox').fill('Mothman');
  await expect(page.locator('[data-card]:visible')).toHaveCount(1);
});

test('reduced motion keeps links immediate without page turns', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  expect(await page.evaluate(() => sessionStorage.getItem('observed-turns'))).toBeNull();
  await expect(page.locator('html')).not.toHaveAttribute('data-notebook-arrival');
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
