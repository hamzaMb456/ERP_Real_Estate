import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, isoInDays, pickContact, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

test('lease: draft → activate → unit rented → rent change → renew → end → unit available', async ({ page }) => {
  test.setTimeout(240_000);
  const bienName = `E2E Bail ${Date.now().toString().slice(-6)}`;
  await signIn(page);

  // A bien with two units.
  await page.goto('/erp/biens/nouveau');
  await page.getByLabel('Nom du bien *').fill(bienName);
  await page.getByRole('combobox', { name: 'Succursale *' }).click();
  await page.getByRole('option', { name: /Tunis Nord/ }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('Rue E2E');
  await page.getByLabel('Ville').fill('Tunis');
  await page.getByRole('button', { name: 'Enregistrer le bien' }).click();
  await expect(page.getByRole('heading', { name: bienName })).toBeVisible();
  const bienUrl = page.url().split('#')[0];
  for (const code of ['E-1', 'E-2']) {
    await page.getByRole('button', { name: 'Ajouter une unité' }).click();
    await page.getByLabel('Référence *').fill(code);
    await page.getByLabel('Surface').fill('50');
    await page.getByLabel('Loyer mensuel').fill('500');
    await page.getByRole('button', { name: 'Ajouter l’unité' }).click();
    await expect(page.getByText('Unité créée')).toBeVisible();
  }

  // A draft lease on both units, with a renter and a guarantor.
  await page.goto('/erp/baux/nouveau');
  await expect(page.getByLabel('Début du bail')).toBeVisible();
  await page.getByLabel('Début du bail').fill(isoInDays(0));
  await page.getByLabel('Fin du bail').fill(isoInDays(364));
  await page.getByRole('checkbox', { name: new RegExp('E-1 · ' + bienName) }).click();
  await page.getByRole('checkbox', { name: new RegExp('E-2 · ' + bienName) }).click();
  await expect(page.getByLabel('Loyer E-1')).toHaveValue('500');
  await page.getByLabel('Loyer E-2').fill('650,5');
  await pickContact(page, 'SARL Carthage Digital');
  await page.getByRole('button', { name: 'Ajouter un garant' }).click();
  await pickContact(page, 'Hédi Ben Salem');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(page.getByRole('heading', { name: /Bail N° \d+/ })).toBeVisible();
  const leaseUrl = page.url().split('#')[0];
  await expect(page.getByText('Brouillon', { exact: true }).first()).toBeVisible();

  // Activate: the lease is active and both units are rented.
  await page.getByRole('button', { name: 'Activer', exact: true }).click();
  await page.getByRole('button', { name: 'Activer le bail' }).click();
  await expect(page.getByText('Bail activé')).toBeVisible();
  await expect(page.getByText('Actif', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'E-1', exact: true }).click();
  await expect(page.getByText('Loué', { exact: true }).first()).toBeVisible();

  // A rent change starting in 30 days appears in the history.
  await page.goto(leaseUrl + '#loyers');
  await expect(page.getByRole('button', { name: 'Changer le loyer' })).toBeVisible();
  await page.getByRole('button', { name: 'Changer le loyer' }).click();
  await page.getByLabel('À partir du').fill(isoInDays(30));
  await page.getByLabel('Loyer (TND)').fill('520');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Loyer enregistré')).toBeVisible();
  await expect(page.getByRole('cell', { name: /520,000/ })).toBeVisible();

  // Renew: the same lease gets a second term.
  await page.goto(leaseUrl);
  await expect(page.getByRole('button', { name: 'Renouveler' })).toBeVisible();
  await page.getByRole('button', { name: 'Renouveler' }).click();
  await page.getByRole('button', { name: 'Renouveler le bail' }).click();
  await expect(page.getByText('Bail renouvelé')).toBeVisible();
  await expect(page.getByText('Renouvellement', { exact: true })).toBeVisible();

  // End: the lease is ended and the units are available again.
  await page.getByRole('button', { name: 'Terminer', exact: true }).click();
  await page.getByRole('button', { name: 'Terminer le bail' }).click();
  await expect(page.getByText('Bail terminé')).toBeVisible();
  await expect(page.getByText('Terminé', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'E-1', exact: true }).click();
  await expect(page.getByText('Disponible', { exact: true }).first()).toBeVisible();

  // Clean up: archive the test bien (the ended lease stays as history).
  await page.goto(bienUrl);
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page.getByText('Bien archivé')).toBeVisible();
});
