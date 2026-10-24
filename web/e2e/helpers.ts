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

/** Presses « Continuer » on the current question of a one-question-at-a-time form, `times` times. */
async function next(page: Page, times = 1) {
  for (let step = 0; step < times; step += 1) await page.getByRole('button', { name: 'Continuer' }).click();
}

/**
 * Creates a building through the question-by-question form (name, type, branch, address, city, then the optional
 * questions left empty) and waits for the new bien page.
 */
export async function createBien(page: Page, name: string) {
  await page.goto('/erp/biens/nouveau');
  await page.getByLabel('Nom du bien *').fill(name);
  await next(page, 2); // name, then type (building by default)
  await page.getByRole('radio', { name: /Tunis Nord/ }).click();
  await next(page);
  await page.getByLabel('Adresse', { exact: true }).fill('Rue E2E');
  await next(page);
  await page.getByLabel('Ville').fill('Tunis');
  await next(page, 4); // city, position, year built and floors, neighbourhood
  await page.getByRole('button', { name: 'Enregistrer le bien' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

export type NewUnit = {
  code: string;
  surface?: string;
  rent: string;
  title?: string;
  /** Uploaded on the photos question, so the unit is complete for the website as soon as it is saved. */
  photo?: { name: string; mimeType: string; buffer: Buffer };
};

/** Adds a vacant apartment from the « Ajouter une unité » dialog of a bien page, walking through every question. */
export async function addUnit(page: Page, unit: NewUnit) {
  await page.getByRole('button', { name: 'Ajouter une unité' }).click();
  await page.getByLabel('Référence *').fill(unit.code);
  await next(page, 2); // reference, then type and status (an available apartment by default)
  if (unit.surface) await page.getByLabel('Surface').fill(unit.surface);
  await next(page, 2); // size, then bedrooms and bathrooms
  await page.getByLabel('Loyer mensuel').fill(unit.rent);
  await next(page, 6); // rent, rental terms, condition, outdoor space, amenities, availability
  if (unit.title) await page.getByLabel('Titre de l’annonce').fill(unit.title);
  await next(page); // title and description
  if (unit.photo) await page.locator('input[type=file]').setInputFiles(unit.photo);
  await next(page); // photos
  await page.getByRole('button', { name: 'Ajouter l’unité' }).click();
}

export async function pickContact(page: Page, name: string) {
  await page.getByRole('combobox').filter({ hasText: 'Choisir un contact' }).first().click();
  await page.getByPlaceholder('Rechercher un contact…').fill(name);
  await page.getByRole('option', { name: new RegExp(name) }).first().click();
}
