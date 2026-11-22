import { expect, test } from '@playwright/test';

const front = '.g-face:not(.g-face-back) ';

test('кадры выезжают из кармашка, записка разворачивается и стикер отгибается', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/gallery/2026-11-19-052');
  const pocket = page.getByRole('button', { name: 'Выдвинуть снимки из кармашка' });
  await expect(page.locator(front + '[data-pocket-print="in"]')).toHaveCount(2);
  const before = await page
    .locator(front + '[data-pocket-print="in"]')
    .first()
    .boundingBox();
  await pocket.click();
  await expect(page.locator(front + '[data-pocket-print="out"]')).toHaveCount(2);
  const after = await page
    .locator(front + '[data-pocket-print="out"]')
    .first()
    .boundingBox();
  expect(after!.y).toBeLessThan(before!.y);
  const firstPrint = page
    .locator(front + '[data-pocket-print="out"]')
    .first()
    .getByRole('button');
  await firstPrint.click();
  await expect(page.getByRole('dialog', { name: 'Фотография крупно' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(firstPrint).toBeFocused();
  await page.getByRole('button', { name: 'Убрать снимки в кармашек' }).click();
  await expect(page.locator(front + '[data-pocket-print="in"]')).toHaveCount(2);

  await page.goto('./#/gallery/2026-11-15-048');
  await page.getByRole('button', { name: 'Развернуть записку' }).click();
  await expect(page.locator(front + '.note-inside')).toBeVisible();
  await expect(page.locator(front + '.note-inside')).toContainText(
    'Один стакан так и остался полным.',
  );
  await page.getByRole('button', { name: 'Сложить записку' }).click();
  await expect(page.locator(front + '.note-inside')).toBeHidden();

  await page.goto('./#/gallery/2026-11-16-049');
  await page.getByRole('button', { name: 'Отогнуть стикер' }).click();
  await expect(page.locator(front + '.note-inside')).toBeVisible();
  await page.getByRole('button', { name: 'Опустить стикер' }).click();
  await expect(page.locator(front + '.note-inside')).toBeHidden();
});

test('нажатие на кассету запускает фрагмент и повторное нажатие останавливает его', async ({
  page,
}) => {
  const audioUrl = 'https://preview.invalid/day-sample.wav';
  const wave = Buffer.alloc(44 + 64000, 128);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24);
  wave.writeUInt32LE(8000, 28);
  wave.writeUInt16LE(1, 32);
  wave.writeUInt16LE(8, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(wave.length - 44, 40);
  await page.route('https://itunes.apple.com/lookup*', (route) =>
    route.fulfill({
      json: { results: [{ previewUrl: audioUrl }] },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await page.route(audioUrl, (route) =>
    route.fulfill({
      body: wave,
      contentType: 'audio/wav',
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/gallery/2026-11-17-050');
  await page.getByRole('button', { name: 'Включить фрагмент с носителя' }).click();
  await expect(page.getByRole('button', { name: /Остановить звук/ })).toBeVisible();
  await page.getByRole('button', { name: 'Остановить фрагмент' }).click();
  await expect(page.getByRole('button', { name: 'Включить фрагмент с носителя' })).toBeVisible();
});
