import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, isoInDays, pickContact, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('bien → units → owner for all → transfer → contact → photo → pin → incomplete list', async ({ page }) => {
  const bienName = `E2E Résidence ${Date.now().toString().slice(-6)}`;
  await signIn(page);

  // 1. Create a bien.
  await page.goto('/erp/biens/nouveau');
  await page.getByLabel('Nom du bien *').fill(bienName);
  await page.getByRole('combobox', { name: 'Succursale *' }).click();
  await page.getByRole('option', { name: /Tunis Nord/ }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('Rue E2E');
  await page.getByLabel('Ville').fill('Tunis');
  await page.getByRole('button', { name: 'Enregistrer le bien' }).click();
  await expect(page.getByRole('heading', { name: bienName })).toBeVisible();
  const bienUrl = page.url().split('#')[0];

  // The new bien has no position yet: it is listed as incomplete.
  await page.goto('/erp/biens/fiches-incompletes');
  await expect(page.getByText(bienName)).toBeVisible();
  await page.goto(bienUrl);

  // 2. Add two units.
  for (const code of ['E-1', 'E-2']) {
    await page.getByRole('button', { name: 'Ajouter une unité' }).click();
    await page.getByLabel('Référence *').fill(code);
    await page.getByLabel('Surface').fill('50');
    await page.getByLabel('Loyer mensuel').fill('500');
    await page.getByRole('button', { name: 'Ajouter l’unité' }).click();
    await expect(page.getByText('Unité créée')).toBeVisible();
  }

  // 3. Same owner for all units.
  await page.getByRole('tab', { name: /Unités/ }).click();
  await page.getByRole('button', { name: 'Même propriétaire pour toutes' }).click();
  await pickContact(page, 'Sté Foncière Carthage');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('cell', { name: 'Sté Foncière Carthage' })).toHaveCount(2);

  // 4. Transfer E-1 to Hédi Ben Salem from tomorrow.
  await page.getByRole('link', { name: 'E-1' }).click();
  await page.getByRole('tab', { name: 'Propriétaires' }).click();
  await page.getByRole('button', { name: 'Transférer la propriété' }).click();
  await page.getByLabel('À partir du').fill(isoInDays(1));
  await pickContact(page, 'Hédi Ben Salem');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('À venir')).toBeVisible();

  // 5. The contact page shows the upcoming holding.
  await page.getByRole('link', { name: 'Hédi Ben Salem' }).first().click();
  await expect(page.getByRole('link', { name: /E-1/ }).first()).toBeVisible();
  await expect(page.getByText(/à partir du/).first()).toBeVisible();

  // 6. Upload a photo on the bien.
  await page.goto(bienUrl + '#photos');
  // Wait for the hydrated, loaded empty state: a file set earlier would be lost before the handler exists.
  await expect(page.getByText('Aucune photo pour le moment')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'facade-e2e.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Facade e2e')).toBeVisible();

  // 7. Place the pin and save.
  await page.goto(bienUrl + '/modifier');
  await page.locator('.leaflet-container').click({ position: { x: 160, y: 120 } });
  await expect(page.getByText(/Position\s*:/)).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  // The edit page heading also contains the bien name, so wait for the save toast and the redirect instead.
  await expect(page.getByText('Bien mis à jour')).toBeVisible();
  await expect(page).toHaveURL(bienUrl);

  // 8. The "position" gap is gone for this bien.
  await page.goto('/erp/biens/fiches-incompletes');
  const row = page.getByRole('listitem').filter({ hasText: bienName });
  // The bien is still listed (shares not set), so the page is loaded before checking the position gap is gone.
  await expect(row).toBeVisible();
  await expect(row.getByText('Position sur la carte manquante')).toHaveCount(0);

  // Clean up: archive the test bien (history is kept, nothing is hard-deleted).
  await page.goto(bienUrl);
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page.getByText('Bien archivé')).toBeVisible();
});
