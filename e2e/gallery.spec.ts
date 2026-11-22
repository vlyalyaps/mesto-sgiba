import { expect, test } from '@playwright/test';

const front = '.g-face:not(.g-face-back) ';

test('галерея: пустые дни сжаты, день раскрывается и листается', async ({ page }) => {
  await page.route('https://itunes.apple.com/**', (r) => r.abort());
  await page.goto('./');
  // Подряд идущие дни без записей сжаты в одну клетку.
  await expect(page.getByLabel(/1 ноября — 13 ноября: без записей/)).toBeVisible();

  await page.getByRole('link', { name: /Два стакана на чемодане/ }).click();
  await expect(page).toHaveURL(/#\/gallery\/2026-11-14-047$/);
  await expect(page.getByRole('heading', { name: /два\s*стакана\s*на\s*чемодане/i })).toBeVisible();
  await expect(page.locator('.gallery')).toHaveAttribute('data-phase', 'open');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/gallery\/2026-11-15-048$/);
});

test('галерея: на 375 px нет горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const hash of ['#/', '#/gallery/2026-11-14-047']) {
    await page.goto('./' + hash);
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, hash).toBeLessThanOrEqual(0);
  }
});

test('открытый касанием день сразу запрашивает свою песню', async ({ page }) => {
  let lookups = 0;
  await page.route('https://itunes.apple.com/lookup*', (route) => {
    lookups++;
    return route.abort();
  });
  await page.goto('./');
  expect(lookups).toBe(0);
  await page.getByRole('link', { name: /Два стакана на чемодане/ }).click();
  await expect.poll(() => lookups).toBeGreaterThan(0);
  // Фрагмент недоступен — страница всё равно собирается целиком.
  await expect(page.locator(front + '[data-assembling]')).toHaveCount(1);
  await expect(page.locator(front + '[data-assembling]')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator(front + '[data-hero]')).toBeVisible();
});
