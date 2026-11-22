import { expect, test } from '@playwright/test';

test('тетрадь открывается на первом дне и листается настоящим переворотом страницы', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Место сгиба' })).toBeVisible();
  await page.getByRole('link', { name: /Открыть книгу: Ноябрь/ }).click();
  await expect(page).toHaveURL(/month\/2026-11/);
  await expect(page.getByRole('heading', { name: 'Два стакана на чемодане' })).toBeVisible();
  await expect(page.locator('.g-page [data-hero]')).toHaveAttribute('data-show', 'true');
  await page.getByRole('button', { name: 'Следующий день' }).click();
  // Страница переворачивается в книге (StPageFlip), а не листом в воздухе.
  const frame = page.frameLocator('.flip-window iframe');
  await expect(frame.locator('.stf__item [data-stock]').first()).toBeAttached();
  await expect(page).toHaveURL(/gallery\/2026-11-15-048/);
  await expect(
    page.getByRole('heading', { name: 'Один стакан так и остался полным' }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/gallery\/2026-11-16-049/);
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
  await page.getByRole('button', { name: 'Почему так' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Почему так' }).locator('li').first(),
  ).toBeVisible();
});

test('047 содержит два разных отпечатка и заголовок из отдельных вырезок', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/day/2026-11-14-047');
  const prints = page.locator('.diary-leaf img[src*="/demo/photos/"]');
  await expect(prints).toHaveCount(2);
  expect(
    await prints.evaluateAll((imgs) => new Set(imgs.map((img) => img.getAttribute('src'))).size),
  ).toBe(2);
  const letters = page
    .locator('.day-spread')
    .getByRole('img', { name: 'Два стакана на чемодане' })
    .locator('img');
  await expect(letters).toHaveCount('Двастакананачемодане'.length);
  await expect(page.getByText('на перроне', { exact: true })).toBeVisible();
  await expect(page.locator('.pen-heart')).toHaveCount(1);
  await page.getByRole('button', { name: 'Почему так' }).click();
  await expect(page.getByRole('dialog', { name: 'Почему так' })).toContainText('тиснёная лента');
});

test('путь записи и возврат в архив', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Записать день' }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByRole('button', { name: /архив|отмена/i }).click();
  await expect(page.getByRole('heading', { name: 'Место сгиба' })).toBeVisible();
});

test('нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of [
    './',
    './#/new',
    './#/month/2026-11',
    './#/month/2026-11/contents',
    './#/day/2026-11-14-047',
    './#/day/2026-11-17-050',
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(0);
  }
});
