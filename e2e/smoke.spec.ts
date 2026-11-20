import { expect, test } from '@playwright/test';

test('архив открывает книжку дня', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Место сгиба' })).toBeVisible();
  await page.getByRole('list', { name: 'Архив дней' }).getByRole('link').first().click();
  await expect(page.locator('.day-spread')).toBeVisible();
});

test('фото открывается крупно, Escape возвращает фокус на отпечаток', async ({ page }) => {
  await page.goto('./#/day/2026-11-14-047');
  const print = page.getByRole('button', { name: 'Увеличить снимок 1' });
  await print.click();
  const dialog = page.getByRole('dialog', { name: 'Фотография крупно' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('figcaption')).toContainText('два стакана');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(print).toBeFocused();
});

test('почему так и текст автора', async ({ page }) => {
  await page.goto('./#/day/2026-11-16-049');
  await expect(page.locator('.handwriting mark')).toHaveText('Чай у окна вокзала.');
  await page.getByText('Почему так', { exact: true }).click();
  await expect(page.locator('.day-why li').first()).toBeVisible();
});

test('путь записи и возврат в архив', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Записать день' }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByRole('button', { name: /архив|отмена/i }).click();
  await expect(page.getByRole('heading', { name: 'Место сгиба' })).toBeVisible();
});

test('нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of ['./', './#/new', './#/day/2026-11-14-047', './#/day/2026-11-17-050']) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(0);
  }
});
