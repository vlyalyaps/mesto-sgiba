import { expect, test } from '@playwright/test';
test('сборка не запускает звук автоматически, сеть недоступна — остаётся весь день', async ({
  page,
}) => {
  let lookups = 0;
  await page.route('https://itunes.apple.com/lookup*', (r) => {
    lookups++;
    return r.abort();
  });
  await page.goto('./#/day/2026-11-14-047');
  // По прямой ссылке страница собирается тихо: кусочки ложатся по очереди, главный кадр последним.
  const spread = page.locator('.g-page .day-spread');
  await expect(spread).toHaveAttribute('data-assembling', 'true');
  await expect(spread).not.toHaveAttribute('data-assembling');
  expect(lookups).toBe(0);
  await page.getByRole('button', { name: /Открыть день со звуком/ }).click();
  await expect(page.getByRole('status')).toContainText('недоступен');
  expect(lookups).toBe(1);
  await expect(spread).not.toHaveAttribute('data-assembling', { timeout: 15000 });
  await expect(page.locator('.g-page [data-hero]')).toBeVisible();
});
test('сокращение движения сразу показывает все элементы', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/day/2026-11-14-047');
  await expect(page.getByRole('button', { name: /Увеличить снимок 1/ })).toBeVisible();
  await expect(page.locator('[data-assembling]')).toHaveCount(0);
  expect(
    await page.evaluate(() => document.querySelectorAll('[data-element]').length),
  ).toBeGreaterThan(5);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) => (a.effect as KeyframeEffect)?.target?.closest('[data-element]')).length,
    ),
  ).toBe(0);
});
test('после перелистывания страница не собирается заново, даже первый день', async ({ page }) => {
  await page.goto('./#/day/2026-11-14-047');
  const spread = page.locator('.g-page .day-spread');
  await expect(spread).not.toHaveAttribute('data-assembling', { timeout: 15000 });
  await page.locator('.g-turn:not(.g-turn-prev)').click();
  await expect(page).toHaveURL(/2026-11-15-048/);
  await expect(spread).not.toHaveAttribute('data-assembling');
  await page.locator('.g-turn-prev').click();
  await expect(page).toHaveURL(/2026-11-14-047/);
  await expect(page.locator('.flip-window')).toHaveCount(0);
  for (let i = 0; i < 6; i++) {
    await expect(spread).not.toHaveAttribute('data-assembling');
    await page.waitForTimeout(150);
  }
});
