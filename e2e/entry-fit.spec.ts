import { expect, test } from '@playwright/test';

const days = [
  '2026-11-14-047',
  '2026-11-15-048',
  '2026-11-16-049',
  '2026-11-17-050',
  '2026-10-05-051',
  '2026-11-19-052',
];

test('запись дня помещается в своё место на листе и не прокручивается', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const id of days) {
    await page.goto(`./#/gallery/${id}`);
    // Переход по хешу внутри приложения: перезагрузка гарантирует, что смотрим лист нужного дня.
    await page.reload();
    const entry = page.locator('.g-face:not(.g-face-back) .handwriting');
    await expect(entry).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const fit = await entry.evaluate((el) => {
      const ink = el.firstElementChild as HTMLElement;
      return {
        overflow: getComputedStyle(el).overflowY,
        spill: ink.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom,
      };
    });
    expect(fit.overflow, id).toBe('visible');
    expect(fit.spill, id).toBeLessThanOrEqual(1);
  }
});
