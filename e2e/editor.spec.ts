import { expect, test } from '@playwright/test';

// Только наборы проекта: без папки src/assets/local редактор тоже обязан работать.
test('редактор: стикер, надпись, бумага и фон сохраняются в день и в папку', async ({
  page,
  browser,
}, info) => {
  await page.route('https://**.open-meteo.com/**', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/new');
  await page.getByLabel('Дата', { exact: true }).fill('2025-06-14');
  await page.getByLabel('Как прошёл день').fill('Ехали долго. А потом пили чай у окна.');
  await page.locator('input[type="file"]').setInputFiles('public/demo/photos/cups.webp');
  await expect(page.getByRole('button', { name: /^Фото 1: отметить/ })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить без песни' }).click();
  await page.getByLabel('Добавить погоду').uncheck();

  const editor = page.getByRole('main', { name: 'Редактор листа' });
  const tabs = editor.getByRole('navigation', { name: 'Инструменты' });
  const tab = (name: string) => tabs.getByRole('button', { name, exact: true }).click();

  await tab('Стикеры');
  await editor.getByPlaceholder('Найти стикер').fill('Поезд');
  await editor.getByRole('button', { name: 'Поезд', exact: true }).click();
  await tab('Надписи');
  await editor.getByRole('button', { name: '+ Рукописная' }).click();
  await editor.getByLabel('Текст надписи').fill('Запомнить навсегда');
  await tab('Бумага');
  await editor.getByRole('button', { name: 'Клетка', exact: true }).click();
  await tab('Фон');
  await editor.getByRole('button', { name: 'Цвет фона: #354f46' }).click();
  await page.getByRole('button', { name: 'Сложить день' }).click();
  await expect(page).toHaveURL(/#\/gallery\/2025-06-14-\d+/);
  const front = page.locator('.g-face:not(.g-face-back)');
  const check = async (root: typeof front) => {
    await expect(root.locator('.sheet-label')).toHaveText('Запомнить навсегда');
    await expect(root.locator('img[src$="/stickers/train.webp"].sheet-image')).toHaveCount(1);
    await expect(root.locator('.leaf-left')).toHaveAttribute('data-ruling', 'grid');
  };
  await check(front);
  await expect(page.locator('.g-light[data-on] .sheet-scene')).toHaveCount(1);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать папку дня (ZIP)' }).click();
  const file = await (await download).path();

  const clean = await browser.newContext({ baseURL: info.project.use.baseURL });
  const other = await clean.newPage();
  await other.emulateMedia({ reducedMotion: 'reduce' });
  await other.goto('./');
  await other.locator('input[type="file"]').setInputFiles(file);
  await expect(other).toHaveURL(/#\/gallery\/2025-06-14-\d+/);
  await check(other.locator('.g-face:not(.g-face-back)'));
  await clean.close();
});

test('«Записать день» сразу открывает редактор, запись внутри него', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Записать день' }).click();
  const editor = page.getByRole('main', { name: 'Редактор листа' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.ed-render .day-spread')).toBeVisible();
  await expect(editor.getByLabel('Как прошёл день')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Добавить фото' })).toBeVisible();
  await expect(editor.getByLabel(/^Песня дня/)).toBeAttached();
  await editor.getByLabel('Как прошёл день').fill('Пили чай у окна вокзала.');
  await expect(editor.locator('.ed-render .handwriting')).toContainText('у окна вокзала');
});

test('«назад» и «Отмена» спрашивают и не теряют запись', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Записать день' }).click();
  const text = page.getByLabel('Как прошёл день');
  await text.fill('Черновик, который нельзя потерять.');
  await page.goBack();
  await expect(page).toHaveURL(/#\/new$/);
  await expect(page.getByText('Выйти без сохранения?')).toBeVisible();
  await page.getByRole('button', { name: 'Остаться' }).click();
  await expect(text).toHaveValue(/нельзя потерять/);

  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/#\/gallery$/);
  await page.goBack();
  await expect(page.locator('.g-grid')).toBeVisible();
});
