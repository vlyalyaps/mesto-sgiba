import { expect, test, type Page } from '@playwright/test';

const cors = { 'access-control-allow-origin': '*' };
const track = {
  trackId: 777001,
  trackName: 'Тестовая песня',
  artistName: 'Тестовый исполнитель',
  trackViewUrl: 'https://music.apple.com/kz/song/777001',
  previewUrl: 'https://audio-ssl.itunes.apple.com/test/preview.m4a',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/test/100x100bb.jpg',
  releaseDate: '2009-05-01T07:00:00Z',
  primaryGenreName: 'Pop',
};

/** Без сети: каталог песен отвечает заготовкой, фрагмент и погода недоступны. */
async function mockNetwork(page: Page) {
  await page.route('https://itunes.apple.com/search*', async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ json: { resultCount: 1, results: [track] }, headers: cors });
  });
  await page.route('https://itunes.apple.com/lookup*', (route) =>
    route.fulfill({ json: { resultCount: 1, results: [track] }, headers: cors }),
  );
  await page.route('https://audio-ssl.itunes.apple.com/**', (route) =>
    route.fulfill({ status: 404, headers: cors, body: 'нет' }),
  );
  await page.route('https://**.open-meteo.com/**', (route) => route.abort());
  await page.route('https://is1-ssl.mzstatic.com/**', (route) => route.abort());
}

async function storedDays(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; input: Record<string, unknown> }[]>((resolve, reject) => {
        const open = indexedDB.open('mesto-sgiba');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('days').objectStore('days').getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

async function fillCommon(page: Page, date: string) {
  await page.getByLabel('Дата').fill(date);
  await page.locator('input[type="file"]').setInputFiles('public/demo/photos/cups.webp');
  await expect(page.getByRole('button', { name: /^Фото 1/ })).toBeVisible();
  await page.getByRole('button', { name: /Спокойно/ }).click();
  await page
    .getByLabel('Как прошёл день')
    .fill('Утром пили чай у окна. Было светло и тихо, рядом была мама.');
}

test('запись дня: фото, песня, настроение, разворот и оглавление после перезагрузки', async ({
  page,
}) => {
  await mockNetwork(page);
  await page.goto('./#/new');
  await fillCommon(page, '2025-03-09');

  await page.getByLabel(/^Песня дня/).fill('тест');
  const list = page.getByRole('list', { name: 'Найденные песни' });
  await expect(list).toHaveAttribute('aria-busy', 'true');
  // Обложка не загрузилась: вместо битой картинки плашка с нотой.
  await expect(page.locator('.df-cover-none')).toHaveCount(1);
  await expect(page.locator('img.df-cover')).toHaveCount(0);
  await page.getByRole('button', { name: /Тестовая песня/ }).click();
  await expect(page.getByText('Тестовый исполнитель, 2009')).toBeVisible();

  const submit = page.getByRole('button', { name: 'Сложить день' });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page).toHaveURL(/#\/day\/2025-03-09-\d+/);
  await expect(page.getByRole('button', { name: 'Скачать папку дня (ZIP)' })).toBeVisible();

  const days = await storedDays(page);
  expect(days).toHaveLength(1);
  const input = days[0].input as {
    mood: string;
    song: { title: string; features: unknown };
    photos: { src: string; id: string }[];
    weather?: unknown;
  };
  expect(input.mood).toBe('calm');
  expect(input.song.title).toBe('Тестовая песня');
  expect(input.song.features).toBeNull();
  expect(input.weather).toBeUndefined();
  expect(input.photos).toHaveLength(1);
  expect(input.photos[0].src).toBe('');

  await page.goto('./');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Открыть книгу: Март 2025' })).toBeVisible();
  // Тетрадь месяца открывается на своём дне.
  await page.getByRole('link', { name: 'Открыть книгу: Март 2025' }).click();
  await expect(page.locator('.g-rail [aria-current]')).toHaveAttribute('aria-label', /9 марта/);
});

test('ссылка Apple Music, снимок без погоды, одно сохранение при двойном нажатии', async ({
  page,
}) => {
  await mockNetwork(page);
  await page.goto('./#/new');
  await fillCommon(page, '2025-04-02');
  await page.getByLabel(/^Песня дня/).fill('https://music.apple.com/kz/album/x/555?i=777001');
  await page.getByRole('button', { name: /Тестовая песня/ }).click();
  await page.getByLabel('Добавить погоду').uncheck();

  const submit = page.getByRole('button', { name: 'Сложить день' });
  await submit.dblclick();
  await expect(page).toHaveURL(/#\/day\/2025-04-02-\d+/);
  expect(await storedDays(page)).toHaveLength(1);
});

test('ошибки у полей и день без песни', async ({ page }) => {
  await mockNetwork(page);
  await page.goto('./#/new');
  await page.getByRole('button', { name: 'Сложить день' }).click();
  await expect(page.getByText('Напишите хотя бы пару строк о дне.')).toBeVisible();
  await expect(page.getByText('Добавьте хотя бы одно фото.')).toBeVisible();
  await expect(page.getByText(/Выберите песню или нажмите/)).toBeVisible();
  await expect(page).toHaveURL(/#\/new/);

  // Enter в поиске не отправляет форму.
  await page.getByLabel(/^Песня дня/).press('Enter');
  await expect(page).toHaveURL(/#\/new/);

  await page.getByRole('button', { name: 'Сохранить без песни' }).click();
  await expect(page.getByText(/Выберите песню или нажмите/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test('нечитаемое фото даёт понятную ошибку под фото', async ({ page }) => {
  await mockNetwork(page);
  await page.goto('./#/new');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'IMG_0001.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('не картинка'),
  });
  await expect(page.getByRole('alert')).toContainText('IMG_0001.heic');
  await expect(page.getByRole('alert')).toContainText('JPEG');
});

test('375 px: без горизонтальной прокрутки', async ({ page }) => {
  await mockNetwork(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#/new');
  await fillCommon(page, '2025-03-09');
  await page.getByLabel(/^Песня дня/).fill('тест');
  await expect(page.getByRole('button', { name: /Тестовая песня/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('длинная запись сохраняет целую подпись и оставляет карандаш на свободном поле', async ({
  page,
}) => {
  await mockNetwork(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/new');
  await page.getByLabel('Дата').fill('2025-11-12');
  await page.locator('input[type="file"]').setInputFiles('public/demo/photos/ridge.webp');
  await expect(page.getByRole('button', { name: /^Фото 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить без песни' }).click();
  await page.getByLabel('Добавить погоду').uncheck();
  await page
    .getByLabel('Как прошёл день')
    .fill(
      'Я вышел рано. Было тихо. А потом — утром выпал первый снег, и мы долго шли по тропе, пока облака расходились над вершинами и становилось светлее. К вечеру мы вернулись домой и поставили чайник, чтобы согреться после прогулки.',
    );
  await page.getByRole('button', { name: 'Сложить день' }).click();
  await expect(page).toHaveURL(/#\/day\/2025-11-12-\d+/);
  await expect(page.locator('.diary-print > span')).toHaveText(/^утром выпал первый снег$/i);

  const graphite = page.locator('[data-motif="erased-graphite"]');
  await expect(graphite).toBeVisible();
  const overlaps = await graphite.evaluate((mark) => {
    const leaf = mark.closest('.journal-leaf')!;
    const a = mark.getBoundingClientRect();
    return [...leaf.querySelectorAll('[data-kind="text"], .diary-print > span')].some((item) => {
      const b = item.getBoundingClientRect();
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    });
  });
  expect(overlaps).toBe(false);

  await page.getByRole('button', { name: 'Почему так' }).click();
  const why = page.getByRole('dialog', { name: 'Почему так' });
  await expect(why).toContainText('Главная фраза следует за переходом');
  await expect(why).not.toContainText(/сужен[аы] в складк/i);
  await expect(why.getByText(/слева, .*справа\./)).toHaveText(/^\p{Lu}/u);
});

test('ошибка сохранения: кнопка снова активна, черновик цел, повтор сохраняет', async ({
  page,
}) => {
  await mockNetwork(page);
  await page.addInitScript(() => {
    (window as unknown as { failSave: boolean }).failSave = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if ((window as unknown as { failSave: boolean }).failSave) {
        throw new DOMException('Нет места на диске', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
  });
  await page.goto('./#/new');
  await fillCommon(page, '2025-05-05');
  await page.getByRole('button', { name: 'Сохранить без песни' }).click();
  await page.getByLabel('Добавить погоду').uncheck();

  const submit = page.getByRole('button', { name: 'Сложить день' });
  await submit.click();
  await expect(page.getByText(/Не получилось сохранить день:/)).toBeVisible();
  await expect(submit).toBeEnabled();
  await expect(page).toHaveURL(/#\/new/);
  await expect(page.getByLabel('Как прошёл день')).toHaveValue(/пили чай/);
  await expect(page.getByRole('button', { name: /^Фото 1/ })).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { failSave: boolean }).failSave = false;
  });
  await submit.click();
  await expect(page).toHaveURL(/#\/day\/2025-05-05-\d+/);
});
