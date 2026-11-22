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
  const hero = page.locator('[data-hero]');
  await expect(hero).toHaveAttribute('data-show', 'false');
  await expect(hero).toHaveAttribute('data-show', 'true');
  expect(lookups).toBe(0);
  await page.getByRole('button', { name: /Открыть день со звуком/ }).click();
  await expect(page.getByRole('status')).toContainText('недоступен');
  expect(lookups).toBe(1);
  await expect(page.locator('[data-show="false"]')).toHaveCount(0);
});
test('сокращение движения сразу показывает все элементы', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/day/2026-11-14-047');
  await expect(page.getByRole('button', { name: /Увеличить снимок 1/ })).toBeVisible();
  await expect(page.locator('[data-show="false"]')).toHaveCount(0);
});
