import { strToU8, unzipSync, zipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('день из ZIP остаётся в сетке, скачивается папкой и восстанавливается', async ({
  page,
  browser,
}, info) => {
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
  await expect(page).toHaveURL(/gallery\/2026-12-05-099/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать папку дня (ZIP)' }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe('2026-12-05-099.zip');
  const file = readFileSync(await saved.path());
  const names = Object.keys(unzipSync(file));
  expect(names.some((name) => /^2026-12-05 .+\/day\.json$/.test(name))).toBe(true);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Скачать папку дня (ZIP)' })).toBeVisible();
  await page.goto('./');
  await page.reload();
  await expect(page.locator('a[data-day="2026-12-05-099"]')).toBeVisible();

  const clean = await browser.newContext({ baseURL: info.project.use.baseURL });
  const other = await clean.newPage();
  await other.goto('./');
  await other
    .locator('input[type="file"]')
    .setInputFiles({ name: 'folder.zip', mimeType: 'application/zip', buffer: file });
  await expect(other).toHaveURL(/gallery\/2026-12-05-099/);
  await expect(other.getByRole('button', { name: 'Скачать папку дня (ZIP)' })).toBeVisible();
  await clean.close();
});

test('у демо-дня нет кнопки скачивания', async ({ page }) => {
  await page.goto('./#/gallery/2026-11-14-047');
  await expect(page.getByRole('button', { name: 'Почему так' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Скачать папку дня (ZIP)' })).toHaveCount(0);
});

test('не-ZIP файл даёт понятную ошибку', async ({ page }) => {
  await page.goto('./');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('нет') });
  await expect(page.getByRole('alert')).toContainText('не похож на папку дня');
});
