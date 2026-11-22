import { expect, test } from '@playwright/test';

test('дни сеткой: с полки в сетку, из сетки в день и обратно в книгу', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Дни сеткой' }).click();
  await expect(page).toHaveURL(/#\/gallery$/);

  await page.getByRole('link', { name: /Два стакана на чемодане/ }).click();
  await expect(page).toHaveURL(/#\/gallery\/2026-11-14-047$/);
  await expect(page.getByRole('heading', { name: /Два стакана на чемодане/i })).toBeVisible();

  await page.getByRole('link', { name: /В книге/ }).click();
  await expect(page).toHaveURL(/#\/day\/2026-11-14-047$/);
  await expect(page.getByRole('heading', { name: 'Два стакана на чемодане' })).toBeVisible();
});

test('дни сеткой: на 375 px нет горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const hash of ['#/gallery', '#/gallery/2026-11-14-047']) {
    await page.goto('./' + hash);
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, hash).toBeLessThanOrEqual(0);
  }
});
