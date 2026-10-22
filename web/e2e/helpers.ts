import { expect, type Page } from '@playwright/test';
import { addDays, todayTunis } from '../src/lib/dates';

export const EMAIL = process.env.E2E_EMAIL;
export const PASSWORD = process.env.E2E_PASSWORD;

export const isoInDays = (days: number): string => addDays(todayTunis(), days);

export async function signIn(page: Page) {
  await page.goto('/erp/connexion');
  await page.getByLabel('Adresse e-mail professionnelle').fill(EMAIL as string);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD as string);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // The first sign-in compiles the dashboard route in dev and calls Nhost: allow more than the default 5 s.
  await expect(page).not.toHaveURL(/connexion/, { timeout: 30_000 });
}

export async function pickContact(page: Page, name: string) {
  await page.getByRole('combobox').filter({ hasText: 'Choisir un contact' }).first().click();
  await page.getByPlaceholder('Rechercher un contact…').fill(name);
  await page.getByRole('option', { name: new RegExp(name) }).first().click();
}
