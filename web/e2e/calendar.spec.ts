import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, isoInDays, pickContact, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

// Needs migration 0004, the Hasura permissions of this plan and the demo seeds applied on the live project.
test('calendar: schedule with a renter → calendar → contact page → cancel → filter', async ({ page }) => {
  test.setTimeout(180_000);
  const title = `E2E Rendez-vous ${Date.now().toString().slice(-6)}`;
  await signIn(page);

  // Schedule an appointment tomorrow, 09:00, with a renter as participant.
  await page.goto('/calendrier');
  await page.getByRole('button', { name: 'Nouveau rendez-vous' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau rendez-vous' })).toBeVisible();
  await page.getByLabel('Titre *').fill(title);
  await page.getByLabel('Date *').fill(isoInDays(1));
  await page.getByLabel('Heure *').fill('09:00');
  await page.getByRole('button', { name: 'Ajouter un participant' }).click();
  await pickContact(page, 'SARL Carthage Digital');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  // It shows in the week view of tomorrow.
  await page.goto(`/calendrier?vue=semaine&date=${isoInDays(1)}`);
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

  // It opens in the detail sheet with its participant.
  await page.getByText(title).first().click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('SARL Carthage Digital')).toBeVisible();

  // It shows on the contact page too.
  await page.goto('/contacts');
  await page.getByPlaceholder(/Rechercher/).first().fill('SARL Carthage Digital');
  await page.getByRole('link', { name: /SARL Carthage Digital/ }).first().click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

  // Cancel it from the calendar.
  await page.goto(`/calendrier?vue=semaine&date=${isoInDays(1)}`);
  await page.getByText(title).first().click();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.getByRole('button', { name: 'Annuler le rendez-vous' }).click();
  await expect(page.getByText('Rendez-vous annulé')).toBeVisible();

  // Hidden by default, back when cancelled appointments are shown.
  await page.goto(`/calendrier?vue=semaine&date=${isoInDays(1)}`);
  await expect(page.getByText(title)).toHaveCount(0);
  await page.getByLabel('Afficher les rendez-vous annulés').click();
  await expect(page.getByText(title)).toBeVisible();
});
