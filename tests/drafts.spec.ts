import { test, expect } from '@playwright/test';

const slugs = [
  'loch-ness-monster',
  'bigfoot-sasquatch',
  'yeti',
  'chupacabra',
  'aswang',
  'kappa',
  'yuki-onna',
  'banshee',
  'jiangshi',
  'rougarou',
  'mongolian-death-worm',
  'yowie',
  'bunyip',
  'krampus',
  'spring-heeled-jack',
  'owlman-of-mawnan',
  'flatwoods-monster',
  'dover-demon',
  'mokele-mbembe',
  'el-coco',
];
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

for (const slug of slugs) {
  test(`${slug}: draft notebook, mobile contents, and matching A5 rules`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/drafts/${slug}/`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.draft-note')).toContainText('Not published');
    await expect(page.locator('.entry-reading-time')).toContainText('draft words');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('.creature-study figcaption')).toHaveCount(0);
    await expect(page.locator('.creature-study img')).toHaveJSProperty('complete', true);
    expect(
      await page
        .locator('.creature-study img')
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    const targets = await page
      .locator('[data-contents-link]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hash));
    expect(targets.length).toBeGreaterThan(5);
    for (const target of targets) await expect(page.locator(target)).toHaveCount(1);
    await page.locator('.entry-contents summary').click();
    await page
      .getByRole('navigation', { name: 'Entry sections', exact: true })
      .getByRole('link', { name: 'The Six Rules', exact: true })
      .click();
    await expect(page.locator('.entry-contents')).not.toHaveAttribute('open');
    await expect(page.locator('#six-rules-heading')).toBeFocused();
    await expect(page.locator('#six-rules-heading')).toBeInViewport();
    await expect(page.locator('#six-rules .rules-list > li')).toHaveCount(6);
    await expect(
      page.getByText('Draft placeholder · sources not yet checked', { exact: true }),
    ).toHaveCount(2);
    await expect(page.locator('a[href="https://example.com"]')).toHaveCount(0);
    const rules = await page
      .locator('#six-rules .rules-list li > span:last-child')
      .allTextContents();
    await page.getByRole('link', { name: 'Print pocket guide', exact: false }).click();
    await expect(page).toHaveURL(new RegExp(`/drafts/${slug}/pocket/`));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('.eyebrow')).toContainText('Unpublished draft');
    const printed = await page.locator('.pocket-rules li > div').allTextContents();
    expect(printed.map(normalize)).toEqual(rules.map(normalize));
    await expect(page.getByRole('link', { name: 'Back to the entry' })).toHaveAttribute(
      'href',
      `/drafts/${slug}/#six-rules`,
    );
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(1);
  });
}

test('draft search is high on mobile and handles reset and no matches', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/drafts/');
  await expect(page.getByRole('searchbox', { name: 'Search draft entries' })).toBeInViewport();
  await expect(page.locator('[data-draft-card]')).toHaveCount(20);
  await expect(page.locator('[data-draft-card]').first()).toBeInViewport();
  await page.getByRole('searchbox').fill('Loch Ness');
  await expect(page.locator('[data-draft-card]:visible')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 of 20 drafts');
  await page.getByRole('searchbox').fill('unfindable creature');
  await expect(page.locator('[data-draft-empty]')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('[data-draft-card]:visible')).toHaveCount(20);
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('drafts stay outside public indexes, feed, sitemap, and pocket routes', async ({
  request,
  page,
}) => {
  for (const path of ['/entries/', '/rss.xml', '/sitemap-0.xml']) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
    expect(await response.text(), path).not.toContain('/drafts/');
  }
  await page.goto('/entries/');
  await expect(page.locator('[data-card]')).toHaveCount(8);
  for (const slug of slugs) {
    const response = await request.get(`/pocket/${slug}/`);
    expect(response.status(), slug).toBe(404);
  }
});
