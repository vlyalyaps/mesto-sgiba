import { expect, test } from '@playwright/test';

test('архив открывает книжку дня', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Место сгиба' })).toBeVisible();

  const covers = page.getByRole('list', { name: 'Архив дней' }).getByRole('link');
  await expect(covers).toHaveCount(3);
  await covers.first().click();

  await expect(page).toHaveURL(/#\/day\//);
  await expect(page.getByRole('link', { name: '← Архив' })).toBeVisible();
});

test('нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of ['./', './#/new']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
