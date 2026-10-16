import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

const PAGES = ['/', '/biens', '/contacts', '/baux', '/biens/nouveau'];

test('language switcher: persists, flips dir, and the pages render in every language', async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'fr');
  await expect(html).toHaveAttribute('dir', 'ltr');

  await page.getByRole('button', { name: 'Changer la langue' }).click();
  await page.getByRole('menuitemradio', { name: 'العربية' }).click();
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(html).toHaveAttribute('dir', 'rtl');

  for (const [locale, name] of [['ar', 'العربية'], ['en', 'English'], ['fr', 'Français']] as const) {
    await page.evaluate((value) => (document.cookie = `NEXT_LOCALE=${value}; path=/`), locale);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(html).toHaveAttribute('lang', locale);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/i18n/${locale}${path.replace(/\//g, '_') || '_'}.png` });
    }
    expect(name).toBeTruthy();
  }
});
