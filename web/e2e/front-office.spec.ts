import { expect, test, type Page } from '@playwright/test';
import { EMAIL, PASSWORD, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');
// The overall timeout below is long only for the cache-lag windows: a wrong selector or a hung page must fail fast.
test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

// Self-contained: the test creates its own bien with one vacant unit and uploads its own photo, so it needs no seeded
// photo (the demo seeds have none). It needs the slice 1 setup of docs/superpowers/handoffs/2026-10-22-front-office-slice-1.md
// (migration 0005, role `public`, Hasura permissions, NEXT_PUBLIC_AGENCY_ORG_ID in web/.env.local). The public pages are
// cached for a few minutes ('use cache', cacheLife 'minutes'), so the visitor steps reload until the change shows up.

// 1×1 transparent PNG, as in core-records.spec.ts.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const LISTING_TITLE = 'Appartement test E2E';
const STALE_BIEN_PREFIX = 'E2E Annonce';
// Intl groups thousands with a space that differs between Chrome and Node (NBSP, narrow NBSP or none): \s? covers all.
const RENT = /1\s?234/;
const DEPOSIT = /2\s?468/;
const STALE_BIEN_NAME = new RegExp(`^${STALE_BIEN_PREFIX} \\d{6}$`);
const CACHE_WINDOW = { timeout: 300_000, intervals: [5_000, 10_000, 15_000] };

/** Archive the biens left behind by an earlier failed run, so no stale « Appartement test E2E » stays published. */
async function archiveStaleBiens(page: Page) {
  await page.goto('/erp/biens');
  await page.getByLabel('Rechercher un bien').fill(STALE_BIEN_PREFIX);
  // The summary line only shows once the list is loaded.
  await expect(page.getByText(/unités dans/)).toBeVisible();
  const hrefs = await page
    .getByRole('link', { name: STALE_BIEN_NAME })
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  for (const href of [...new Set(hrefs)].filter((value) => /^\/erp\/biens\/[^/]+$/.test(value))) {
    await page.goto(href);
    await page.getByRole('button', { name: 'Archiver' }).click();
    await expect(page.getByText('Bien archivé')).toBeVisible();
  }
}

/** The « Publication » card of the unit page. */
const publicationCard = (page: Page) => page.locator('[data-slot="card"]').filter({ has: page.getByText('Publication', { exact: true }) });

/** Closes the open listing of the unit, if there is one. Returns false when the unit has no open listing. */
async function closeOpenListing(page: Page, unitUrl: string): Promise<boolean> {
  await page.goto(unitUrl);
  const publication = publicationCard(page);
  const edit = publication.getByRole('button', { name: 'Modifier', exact: true });
  if (!(await edit.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false))) return false;
  await edit.click();
  await publication.getByRole('button', { name: 'Clôturer', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clôturer', exact: true }).click();
  await expect(page.getByText('Annonce clôturée')).toBeVisible();
  return true;
}

async function signOut(page: Page) {
  await page.locator('[data-sidebar="footer"]').getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/connexion/);
}

test('publish a unit from the ERP, see it on the public site, close it, see it disappear', async ({ page, browser }, testInfo) => {
  test.setTimeout(900_000);
  const bienName = `${STALE_BIEN_PREFIX} ${Date.now().toString().slice(-6)}`;
  let bienUrl: string | null = null;
  let unitUrl: string | null = null;
  let staffSignedIn = false;
  const visitor = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const guest = await visitor.newPage();

  try {
    // 1. Staff: a bien with one vacant unit and a photo.
    await signIn(page);
    staffSignedIn = true;
    await archiveStaleBiens(page);

    await page.goto('/erp/biens/nouveau');
    await page.getByLabel('Nom du bien *').fill(bienName);
    await page.getByRole('combobox', { name: 'Succursale *' }).click();
    await page.getByRole('option', { name: /Tunis Nord/ }).click();
    await page.getByLabel('Adresse', { exact: true }).fill('Rue E2E');
    await page.getByLabel('Ville').fill('Tunis');
    await page.getByRole('button', { name: 'Enregistrer le bien' }).click();
    await expect(page.getByRole('heading', { name: bienName })).toBeVisible();
    bienUrl = page.url().split('#')[0];

    await page.getByRole('button', { name: 'Ajouter une unité' }).click();
    await page.getByLabel('Référence *').fill('E-1');
    await page.getByLabel('Surface').fill('50');
    await page.getByLabel('Loyer mensuel').fill('500');
    await page.getByRole('button', { name: 'Ajouter l’unité' }).click();
    await expect(page.getByText('Unité créée')).toBeVisible();
    // The unit links live on the « Unités » tab of the bien page (it opens on « Aperçu »).
    await page.getByRole('tab', { name: /Unités/ }).click();
    await page.getByRole('link', { name: 'E-1' }).click();
    await expect(page).toHaveURL(/\/unites\//);
    unitUrl = page.url().split('#')[0];

    // The new unit is vacant. Without a photo the listing cannot be published (LISTING_NEEDS_PHOTO), so upload one first.
    await page.getByRole('tab', { name: 'Photos' }).click();
    // Wait for the hydrated, loaded empty state: a file set earlier would be lost before the handler exists.
    await expect(page.getByText('Aucune photo pour le moment')).toBeVisible();
    await page.locator('input[type=file]').setInputFiles({ name: 'photo-e2e.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Photo e2e')).toBeVisible();

    // 2. Staff: create the rent listing at 1 234 TND and publish it.
    await page.getByRole('tab', { name: 'Aperçu' }).click();
    const publication = publicationCard(page);
    await publication.getByRole('button', { name: 'Créer une annonce' }).click();
    await publication.getByLabel('Titre', { exact: true }).fill(LISTING_TITLE);
    await publication.getByLabel('Loyer mensuel', { exact: true }).fill('1234');
    await publication.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(page.getByText('Annonce publiée')).toBeVisible();
    await expect(publication.getByText('Publiée', { exact: true })).toBeVisible();

    // The public link of the form carries the listing id: every public check below is scoped to it.
    await publication.getByRole('button', { name: 'Modifier', exact: true }).click();
    const href = await publication.getByRole('link', { name: 'Voir sur le site' }).getAttribute('href');
    expect(href).toMatch(/^\/logement\/[0-9a-f-]{36}$/);
    const listingPath = href as string;

    // 3. The old /biens link redirects to the ERP (signed in, so it lands on the list).
    await page.goto('/biens');
    await expect(page).toHaveURL(/\/erp\/biens$/);

    // 4. Staff signs out.
    await signOut(page);
    staffSignedIn = false;

    // 5. Visitor: the card is on /louer, then the unit page.
    const card = guest.locator('article').filter({ has: guest.locator(`a[href="${listingPath}"]`) });
    await expect(async () => {
      await guest.goto('/louer');
      await expect(card).toBeVisible({ timeout: 10_000 });
    }).toPass(CACHE_WINDOW);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText(LISTING_TITLE)).toBeVisible();
    await expect(card.getByTestId('listing-price')).toHaveText(RENT);
    // The photo is served to a visitor with no session (storage permissions of the `public` role).
    await expect
      .soft(card.locator('img'), 'the cover photo loads for an anonymous visitor')
      .toHaveJSProperty('complete', true);
    await expect.soft(card.locator('img')).not.toHaveJSProperty('naturalWidth', 0);

    await card.getByRole('link', { name: LISTING_TITLE }).click();
    await expect(guest).toHaveURL(new RegExp(listingPath + '$'));
    await expect(guest.getByRole('heading', { name: /Conditions/ }).first()).toBeVisible();
    // Deposit = 2 months of rent (the default of the form) = 2 468 TND.
    await expect(guest.getByText(DEPOSIT).first()).toBeVisible();

    // A visitor sent to the old /biens link ends at the ERP sign-in.
    await guest.goto('/biens');
    await expect(guest).toHaveURL(/\/erp\/connexion/);

    // 6. Staff signs in again and closes the listing.
    await signIn(page);
    staffSignedIn = true;
    expect(await closeOpenListing(page, unitUrl), 'the unit has an open listing to close').toBe(true);

    // 7. Visitor: the unit page now shows the public not-found page (HTTP 200 with noindex, ruling R9: assert on the text).
    await expect(async () => {
      await guest.goto(listingPath);
      await expect(guest.getByRole('heading', { name: 'Page introuvable' })).toBeVisible({ timeout: 10_000 });
    }).toPass(CACHE_WINDOW);
  } finally {
    // Clean up like the other specs, best effort: close the listing (an archived bien only leaves the public views, the
    // listing itself would stay « published »), then archive the bien (nothing is hard-deleted).
    await visitor.close().catch(() => undefined);
    if (bienUrl) {
      try {
        if (!staffSignedIn) await signIn(page);
        if (unitUrl) await closeOpenListing(page, unitUrl); // false when the test already closed it
        await page.goto(bienUrl);
        const archive = page.getByRole('button', { name: 'Archiver' });
        await expect(archive).toBeVisible({ timeout: 15_000 });
        await archive.click();
        await expect(page.getByText('Bien archivé')).toBeVisible();
      } catch (error) {
        console.warn(`[front-office e2e] cleanup of "${bienName}" failed; the next run archives stale "${STALE_BIEN_PREFIX}" biens first.`, error);
      }
    }
  }
});
