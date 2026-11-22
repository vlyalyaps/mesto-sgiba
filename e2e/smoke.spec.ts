import { expect, test } from '@playwright/test';

const front = '.g-face:not(.g-face-back) ';

test('сетка открывает день, стрелка листает к следующему', async ({ page }) => {
  // Песня дня запрашивается сразу; без сети страница собирается тихо.
  await page.route('https://itunes.apple.com/**', (r) => r.abort());
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Дни', exact: true })).toBeAttached();
  await page.getByRole('link', { name: /Два стакана на чемодане/ }).click();
  await expect(page).toHaveURL(/#\/gallery\/2026-11-14-047$/);
  await expect(page.locator(front + '[data-assembling]')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator(front + '[data-hero]')).toBeVisible();
  await expect(page.locator('.gallery')).toHaveAttribute('data-phase', 'open');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/gallery\/2026-11-15-048/);
  await expect(page.locator(front + '.day-spread')).toBeVisible();
  await page.getByRole('button', { name: 'Ко всем дням' }).click();
  await expect(page).toHaveURL(/mesto-sgiba\/$|#\/gallery$/);
  await expect(page.locator('.gallery')).toHaveAttribute('data-phase', 'grid');
});

test('книг и входов в них нет, старые ссылки открывают галерею', async ({ page }) => {
  for (const path of ['./', './#/month/2026-11', './#/month/2026-11/contents']) {
    await page.goto(path);
    await page.reload();
    await expect(page.locator('.g-grid')).toBeVisible();
    await expect(page.locator('a[href^="#/day/"], a[href^="#/month/"], a[href="#/"]')).toHaveCount(
      0,
    );
  }
  await page.goto('./#/day/2026-11-16-049');
  await expect(page.getByRole('heading', { name: /чай\s*у\s*окна\s*вокзала/i })).toBeVisible();
  await expect(page.locator('a[href^="#/day/"], a[href^="#/month/"], a[href="#/"]')).toHaveCount(0);
});

test('фото открывается крупно, Escape возвращает фокус на отпечаток', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/gallery/2026-11-14-047');
  const print = page.getByRole('button', { name: 'Увеличить снимок 1' });
  await print.click();
  const dialog = page.getByRole('dialog', { name: 'Фотография крупно' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('figcaption')).toContainText('два стакана');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(print).toBeFocused();
  await expect(page).toHaveURL(/gallery\/2026-11-14-047$/);
});

test('почему так и текст автора', async ({ page }) => {
  await page.goto('./#/gallery/2026-11-16-049');
  await expect(page.locator(front + '.handwriting mark')).toHaveText('Чай у окна вокзала.');
  await page.getByRole('button', { name: 'Почему так' }).click();
  await expect(page.locator('.g-why li').first()).toBeVisible();
});

test('047 содержит два разных отпечатка и заголовок из отдельных вырезок', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/gallery/2026-11-14-047');
  const prints = page.locator(front + '.diary-leaf img[src*="/demo/photos/"]');
  await expect(prints).toHaveCount(2);
  expect(
    await prints.evaluateAll((imgs) => new Set(imgs.map((img) => img.getAttribute('src'))).size),
  ).toBe(2);
  const letters = page.getByRole('img', { name: 'Два стакана на чемодане' }).locator('img');
  await expect(letters).toHaveCount('Двастакананачемодане'.length);
  await expect(page.locator(front).getByText('на перроне', { exact: true })).toBeVisible();
  await expect(page.locator(front + '.pen-heart')).toHaveCount(1);
  await page.getByRole('button', { name: 'Почему так' }).click();
  await expect(page.locator('.g-why')).toContainText('тиснёная лента');
});

test('путь записи и возврат в галерею', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Записать день' }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page).toHaveURL(/#\/gallery$/);
  await expect(page.locator('.g-grid')).toBeVisible();
});

test('нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of [
    './',
    './#/new',
    './#/gallery',
    './#/gallery/2026-11-14-047',
    './#/gallery/2026-11-17-050',
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(0);
  }
});
