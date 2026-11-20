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

test('на странице дня книжка раскрывается и сворачивается', async ({ page }) => {
  await page.goto('./#/day/2026-11-14-047');
  const book = page.locator('.scene');
  await expect(book).toBeVisible();
  await expect(book).toHaveAttribute('aria-expanded', 'false');
  await expect(book).toHaveAccessibleName(/Раскрыть книжку/);

  await page.getByRole('button', { name: 'Раскрыть', exact: true }).click();
  await expect(book).toHaveAttribute('aria-expanded', 'true');
  await expect(book).toHaveAccessibleName(/Сложить книжку/);
  // Раскрытый разворот не вылезает за страницу и узкие складки на месте.
  await expect(page.locator('.pnl')).not.toHaveCount(0);

  await book.focus();
  await page.keyboard.press('Enter');
  await expect(book).toHaveAttribute('aria-expanded', 'false');
});

test('оборот «Почему так» открывается кнопкой', async ({ page }) => {
  await page.goto('./#/day/2026-11-16-049');
  const why = page.locator('#book-why');
  await expect(why).toBeHidden();
  await page.getByRole('button', { name: 'Почему так' }).click();
  await expect(why).toBeVisible();
});

test('нет горизонтальной прокрутки', async ({ page }) => {
  for (const path of ['./', './#/new', './#/day/2026-11-14-047', './#/day/2026-11-17-050']) {
    await page.goto(path);
    if (path.includes('day')) {
      await page.getByRole('button', { name: 'Раскрыть', exact: true }).click();
      await page.waitForTimeout(2500);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
