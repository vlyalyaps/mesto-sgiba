import { expect, test } from '@playwright/test';

test('стол: тетради и дни сразу на главной, день раскрывается и ведёт в книгу', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('link', { name: /Открыть книгу: Ноябрь 2026/ })).toBeVisible();
  // Подряд идущие дни без записей сжаты в одну клетку.
  await expect(page.getByLabel(/1 ноября — 13 ноября: без записей/)).toBeVisible();

  await page.getByRole('link', { name: /Два стакана на чемодане/ }).click();
  await expect(page).toHaveURL(/#\/gallery\/2026-11-14-047$/);
  await expect(page.getByRole('heading', { name: /Два стакана на чемодане/i })).toBeVisible();

  // Касание кнопки приближает лист, Escape возвращает обычный вид.
  await page.getByRole('button', { name: 'Рассмотреть страницу ближе' }).click();
  await expect(page.getByRole('button', { name: 'Отдалить страницу' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Рассмотреть страницу ближе' })).toBeVisible();

  await page.getByRole('link', { name: /В книге/ }).click();
  await expect(page).toHaveURL(/#\/day\/2026-11-14-047$/);
  await expect(page.getByRole('heading', { name: 'Два стакана на чемодане' })).toBeVisible();
});

test('стол: на 375 px нет горизонтальной прокрутки', async ({ page }) => {
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
