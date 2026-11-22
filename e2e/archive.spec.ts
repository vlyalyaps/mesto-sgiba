import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';

test('день из ZIP остаётся на полке после перезагрузки', async ({ page }) => {
  const input = {
    date: '2026-12-05',
    number: 99,
    text: 'Утром выпал первый снег. А потом мы долго пили горячий чай у окна.',
    photos: [{ id: 'p1', src: '', width: 100, height: 80, palette: ['#aabbcc'], lightness: 0.5 }],
    song: null,
  };
  const zip = zipSync({
    '2026-12-05 Чай у окна/day.json': strToU8(JSON.stringify(input)),
    '2026-12-05 Чай у окна/photos/p1.jpg': new Uint8Array([0xff, 0xd8, 1, 2]),
  });
  await page.goto('./');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'day.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page).toHaveURL(/day\/2026-12-05-099/);
  await expect(page.getByRole('button', { name: 'Скачать папку дня (ZIP)' })).toBeVisible();
  await page.goto('./');
  await page.reload();
  await expect(page.getByRole('link', { name: /Открыть книгу: Декабрь 2026/ })).toBeVisible();
});

test('не-ZIP файл даёт понятную ошибку', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('нет') });
  await expect(page.getByRole('alert')).toContainText('не похож на папку дня');
});
