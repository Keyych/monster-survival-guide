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
    new MutationObserver((changes) => {
      const event = changes.find(
        (change) =>
          change.attributeName?.startsWith('data-notebook-') &&
          document.documentElement.hasAttribute(change.attributeName),
      );
      if (!event) return;
      const animationName =
        event.attributeName === 'data-notebook-departure' ? 'notebook-depart' : 'notebook-arrive';
      try {
        const turns = JSON.parse(sessionStorage.getItem('observed-turns') || '[]');
        turns.push(animationName);
        sessionStorage.setItem('observed-turns', JSON.stringify(turns));
      } catch {
        // Some tests deliberately disable storage.
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-notebook-departure', 'data-notebook-arrival'],
    });
  });
});

test('page links curl, section jumps stay still, and back navigation remains usable', async ({
  page,
}) => {
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page.locator('.notebook-turn-layer')).toHaveAttribute('aria-hidden', 'true');
  // Different surface angles confirm the sheet bends instead of rotating rigidly.
  await expect
    .poll(() =>
      page
        .locator('.notebook-paper-strip')
        .evaluateAll(
          (strips) =>
            new Set(strips.map((strip) => getComputedStyle(strip).transform.split(',')[0])).size,
        ),
    )
    .toBeGreaterThan(2);
  expect(
    await page.locator('[id]').evaluateAll((elements) => {
      const ids = elements.map((element) => element.id);
      return new Set(ids).size === ids.length;
    }),
  ).toBe(true);
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

test('a motion preference change releases an active turn and follows the link', async ({
  page,
}) => {
  await page.goto('/entries/');
  await page.locator('[data-card][href="/slenderman"]').click();
  await expect(page.locator('.notebook-turn-layer')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page).toHaveURL(/\/slenderman\/?$/);
  await expect(page.locator('[data-notebook-page]')).toBeVisible();
  await expect(page.locator('.notebook-turn-layer')).toHaveCount(0);
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
