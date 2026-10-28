# Front office — Slice 1 (ERP move, public shell, listings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the ERP under `/erp`, open a public site at `/` with home, search and unit pages that show real units the staff publish from the ERP.

**Architecture:** The ERP route group moves to `src/app/erp/`; a new `src/app/(site)/` route group holds the public pages. Staff publish a unit through a new `listings` table edited on the ERP unit page; a database trigger enforces the publishing rules. Public pages are server components that query the data layer as the unauthenticated `public` role (views `public_listings`, `public_listing_photos`) and pass data to client components that render text through the i18n catalogs; photos load straight from S3 (Floci) through a `public` storage permission.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind 4, GSAP design system already in the repo, the Floci AWS stack (AppSync + DynamoDB + S3 + Cognito), Postgres 16, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-front-office-design.md` (approved 2026-10-22). Slice 1 = spec §11 item 1.

## Global Constraints

- Work in the main checkout `C:\Users\mbark\Projects\ERP_Real_Estate`, branch `vitrine`; never in a worktree.
- Design system only: icons from `@/components/icons` (never `lucide-react`), `Button` from `@/components/ui/button`, `PageHeader`, `ScrollStagger`/`StaggerItem` for reveals, durations from `gsapTokens`; no motion/react mount staggers, no CSS row animations; everything reduced-motion safe.
- Look follows the Stitch screens (spec F3): Accueil `73944003ff204a708656f918ec88b559`, Logements à louer `32680b4e46ea4f86a7758d0df5727ee7`, Fiche logement `44c57dc4b6b54e2086e11282b3110c62` in project `projects/18117543231921807105`.
- Every user-visible string lives in the i18n catalogs `fr`, `en`, `ar` (French first); amounts with the existing `formatTnd`, surfaces with `formatArea`.
- No FNAIM or other French body anywhere; footer copyright « © 2026 Emerald Immobilier Tunisie. Tous droits réservés. »; trust badge « Agence immobilière agréée — Tunisie ».
- Public site serves one organization: `NEXT_PUBLIC_AGENCY_ORG_ID`; every public query filters on it (spec F5, R7).
- Only French public pages are indexed (spec R8): server render is French; en/ar switch on the client like the ERP.
- Migrations are applied by the user in the legacy cloud console; data-layer metadata only through `scripts/apply-hasura-permissions.mjs`; nothing is pushed to the backend by Claude.
- Migration numbering for this project, replacing spec §6's numbers: `0005_listings.sql` (this slice), `0006_rent_requests_visits.sql`, `0007_sales_offers.sql`, `0008_client_space.sql`, `0009_inspections_deposit.sql`. Task 2 updates the spec's numbering paragraph to match.
- Commit after every task with a conventional message; no attribution lines.

## Review Focus

1. A published listing whose unit is later archived, rented by a new lease, or loses all photos: it must vanish from search and its page must answer 404 (or show the photo placeholder), never crash. Tests: Task 2 SQL tests (auto-close, view filters), Task 10 `listing-page` test, Task 11 E2E (closed listing → 404).
2. Garbage in the search URL (`?prix_max=abc&page=-3&pieces=99&ville=<script>`): ignored or clamped, page renders. Test: Task 5 `parseSearchParams` cases.
3. Old ERP links (bookmarks, e-mailed notification links like `/baux/123?onglet=loyers`, `/connexion`): redirected to `/erp/...` keeping path and query. Test: Task 1 `legacyRedirects` test.
4. A logged-out visitor opening `/erp/biens/123`: sent to `/erp/connexion?next=%2Ferp%2Fbiens%2F123`, and after login lands back there. Test: Task 1 `safeNext` test.
5. Arabic (RTL) and very long listing titles on cards and the unit page: text truncates, prices stay readable. Test: Task 7 `listing-card` test (title has `line-clamp-2`, price element has `tabular-nums` and `dir="ltr"`).

---

### Task 1: Move the ERP under `/erp`

**Files:**
- Move: `web/src/app/(app)/` → `web/src/app/erp/(app)/`; `web/src/app/connexion/` → `web/src/app/erp/connexion/`
- Create: `web/src/lib/erp-paths.ts`, `web/src/lib/erp-paths.test.ts`
- Modify: `web/next.config.ts` (add `redirects`), `web/src/lib/navigation.ts`, `web/src/components/app-shell.tsx`, `web/src/app/erp/connexion/page.tsx`, every file holding an ERP path literal (about 56 files; list them with `grep -rlE "['\"\`]/(biens|baux|contacts|calendrier|administration|connexion|finance|maintenance|securite|fournisseurs|ventes|rapports)" web/src web/e2e`), `web/e2e/*.spec.ts`, `web/e2e/helpers.ts`

**Interfaces:**
- Produces: `ERP_BASE = '/erp'`; `erpPath(path: string): string` (prefixes `/erp`; `erpPath('/')` is `'/erp'`); `LEGACY_PREFIXES: readonly string[]` = `['/biens', '/baux', '/contacts', '/calendrier', '/administration', '/finance', '/maintenance', '/securite', '/fournisseurs', '/ventes', '/rapports']`; `legacyRedirects(): { source: string; destination: string; permanent: false }[]` (for each prefix one `/<prefix>` and one `/<prefix>/:path*` entry, plus `/connexion` → `/erp/connexion`); `safeNext(next: string | null | undefined): string` (returns `next` only when it starts with `/erp` and not `//`, else `'/erp'`).

- [ ] **Step 1: Write the failing tests** in `erp-paths.test.ts`:
  - `erpPath('/biens/1')` → `'/erp/biens/1'`; `erpPath('/')` → `'/erp'`.
  - `legacyRedirects()` contains `{ source: '/baux/:path*', destination: '/erp/baux/:path*', permanent: false }` and `{ source: '/connexion', destination: '/erp/connexion', permanent: false }`; no entry has source `/` (the public home must never redirect).
  - `safeNext('/erp/biens/123')` → `'/erp/biens/123'`; `safeNext('https://evil.tld')`, `safeNext('//evil.tld')`, `safeNext('/louer')`, `safeNext(null)` → `'/erp'`.
  - Navigation: `sectionOf('/erp/biens/1/unites/2')` → `'/erp/biens'`; `sectionOf('/erp')` → `'/erp'`; `buildCrumbs('/erp/baux/demandes', nav)` → `[{ label: nav.items.rentersAndLeases, href: '/erp/baux' }, { label: nav.items.rentalRequests }]`.
- [ ] **Step 2: Run** `cd web; npx vitest run src/lib/erp-paths.test.ts src/lib/navigation` — expected FAIL (module missing, old section logic).
- [ ] **Step 3: Implement** `erp-paths.ts`; prefix every `href` in `NAV_GROUPS` with `/erp` (dashboard `'/erp'`); `sectionOf` returns `'/erp'` for `/erp` and `'/erp/' + <first segment after /erp>` otherwise. In `next.config.ts`: `redirects: async () => legacyRedirects()` (Next keeps the query string on redirects).
- [ ] **Step 4: Move the folders** with `git mv`, then rewrite every ERP path literal to its `/erp` form (string, template and `href` literals, `router.push`/`replace`, `redirect(`, E2E `page.goto`/`toHaveURL`). `AppShell` sends an anonymous user to `'/erp/connexion?next=' + encodeURIComponent(pathname + search)`; after sign-in the login page goes to `safeNext(searchParams.get('next'))` (today it goes to `/`). Notification links stored in the database keep their old paths; the redirects resolve them.
- [ ] **Step 5: Verify** — `npx vitest run` all green; `npx tsc --noEmit`; `npx eslint src`; `npm run build`; and this grep prints nothing: `grep -rnE "['\"\`]/(biens|baux|contacts|calendrier|administration|connexion)(['\"\`/?]|$)" web/src web/e2e | grep -v erp-paths`.
- [ ] **Step 6: Commit** — `git commit -m "refactor(web): move the ERP under /erp with redirects from the old paths"`

### Task 2: Migration `0005_listings.sql` (listings, publishing rules, public views)

**Files:**
- Create: `db/migrations/0005_listings.sql`, `db/tests/0005_listings.test.sql`, `db/seeds/0005_listings.sql`
- Modify: `docs/superpowers/specs/2026-10-22-front-office-design.md` (§6 numbering line → the numbering in Global Constraints; under §6.1 note that photo order comes from the unit's `property_files` (`is_cover`, `sort_order`) and `listing_photos` is deferred; under §7 note that publish/pause are a status update guarded by the trigger below)

**Interfaces:**
- Produces table `public.listings`: `id uuid pk default gen_random_uuid()`, `organization_id uuid not null`, `unit_id uuid not null` (composite FK `(unit_id, organization_id)` → `units (id, organization_id)`), `kind text not null check (kind in ('rent', 'sale'))`, `status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed'))`, `title text not null check (length(trim(title)) > 0)`, `description text`, `price numeric(12,3) check (price > 0)`, `charges numeric(12,3) check (charges >= 0)`, `deposit_months smallint not null default 2 check (deposit_months between 0 and 12)`, `reservation_deposit numeric(12,3) not null default 10000 check (reservation_deposit >= 0)`, `reservation_days smallint not null default 15 check (reservation_days between 1 and 90)`, `available_from date`, `furnished boolean not null default false`, `amenities text[] not null default '{}'` (allowed values: `parking, lift, air_conditioning, heating, sea_view, balcony, garden, security, equipped_kitchen`), `virtual_tour_url text`, `published_at timestamptz`, `closed_reason text check (closed_reason in ('leased', 'sold', 'unit_archived', 'manual'))`, `created_at`, `updated_at`; unique partial index on `(unit_id, kind) where status <> 'closed'`.
- Produces trigger `check_listing_publishable` (before insert or update, when `new.status = 'published'`) raising an exception whose message is the code: `LISTING_NEEDS_PRICE`; `LISTING_NEEDS_PHOTO` (no `property_files` row of kind `photo` for the unit); `LISTING_UNIT_ARCHIVED`; `LISTING_UNIT_NOT_RENTABLE` (rent allowed when the unit is `vacant`, or `rented` with its current lease `end_date` within today + 90 days and `available_from` after that end date); `LISTING_UNIT_NOT_SELLABLE` (sale allowed when the unit is `for_sale` or `rented`). It sets `published_at = now()` on the first publish.
- Produces trigger on `leases` (after update of `status` to `active`): its units' open rent listings become `closed` with `closed_reason = 'leased'`; trigger on `units` (after update of `archived_at` to not null): all its open listings become `closed` / `unit_archived`.
- Produces view `public.public_listings` (published listings of non-archived units only): `id, organization_id, unit_id, kind, title, description, price, charges, deposit_months, reservation_deposit, reservation_days, available_from, furnished, amenities, virtual_tour_url, published_at, unit_type, rooms, surface_m2, floor, unit_status, city, governorate, latitude, longitude` (coordinates rounded to 3 decimals), `cover_file_id` (the unit's `is_cover` photo, else the lowest `sort_order`), `photo_count`.
- Produces view `public.public_listing_photos`: `listing_id, storage_file_id, position` (photos of published listings' units, cover first then `sort_order`).

- [ ] **Step 1: Write the failing SQL test** `db/tests/0005_listings.test.sql` (style of `0003_leases.test.sql`, ending with `OK: all`): publish without price → `LISTING_NEEDS_PRICE`; without photo → `LISTING_NEEDS_PHOTO`; rent on a `for_sale` unit → `LISTING_UNIT_NOT_RENTABLE`; rent on a `rented` unit whose lease ends in 60 days with `available_from` the next day → published; lease ending in 120 days → `LISTING_UNIT_NOT_RENTABLE`; sale on a `vacant` unit → `LISTING_UNIT_NOT_SELLABLE`; a second open rent listing for the same unit → unique violation; activating a new lease on a listed unit → listing `closed`/`leased` and gone from `public_listings`; archiving the unit → `closed`/`unit_archived`; draft and paused listings are absent from `public_listings`; `public_listings.latitude` has 3 decimals; `public_listing_photos` lists the cover first.
- [ ] **Step 2: Run** `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0005_listings.test.sql` — expected FAIL (relation `listings` does not exist).
- [ ] **Step 3: Write `0005_listings.sql`**: indexes on `organization_id` and `unit_id`; `set_updated_at` trigger; trigger functions `SECURITY DEFINER` with `set search_path = public, pg_temp` as in 0003. The seed publishes one rent and one sale listing on seeded units that have photos; if the seeds have no photo rows it inserts the listings as `draft` and says so in a comment.
- [ ] **Step 4: Run** the new SQL test → `OK: all`; re-run the `0002`–`0004` tests → still `OK: all`.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): listings with publishing rules and public views (0005)"`

### Task 3: Data-layer metadata for listings, the `public` role and public photos

**Files:**
- Modify: `scripts/apply-hasura-permissions.mjs`

**Interfaces:**
- Consumes: Task 2 objects.
- Produces (in the data layer): tracked `listings`, `public_listings`, `public_listing_photos`; relationships `units.listings` (array), `listings.unit` (object), `public_listings.photos` (array → `public_listing_photos` on `listing_id`). Permissions: `org_admin`, `manager` select/insert/update on `listings` with the organization filter (insert columns: all except `id`, `organization_id` (preset from `X-Hasura-Org-Id`), `published_at` and the timestamps; no delete, listings are closed, not deleted); `viewer` select on `listings`; role **`public`** select on `public_listings` and `public_listing_photos` (all columns, no row filter: the views hold only published rows and the site filters by organization), and select on `storage.files` limited to files linked to a published listing (through `property_links` → unit → `listings.status = 'published'`), columns `id, mime_type, size, updated_at`.

- [ ] **Step 1: Run** `node scripts/apply-hasura-permissions.mjs --dry-run` and note the counts it prints.
- [ ] **Step 2: Add** the entries above following the script's existing patterns (TRACK list, SELECT_COLUMNS, writer permissions, the storage block around line 342, the relationship list).
- [ ] **Step 3: Run** `node scripts/apply-hasura-permissions.mjs --dry-run` — expected: no error, and the permission count grows by the number of added permissions (state the number in the commit message).
- [ ] **Step 4: Commit** — `git commit -m "feat(hasura): listings permissions, public role and public listing photos"`

### Task 4: ERP « Publication » card on the unit page

**Files:**
- Create: `web/src/components/listings/listing-card-erp.tsx`, `web/src/components/listings/listing-form.tsx`, `web/src/components/listings/listing-form.test.tsx`, `web/src/lib/listings.ts`, `web/src/lib/listings.test.ts`, `web/src/i18n/messages/{fr,en,ar}/listings.ts`
- Modify: `web/src/app/erp/(app)/biens/[id]/unites/[unitId]/page.tsx` (add the card under the lease card), `web/src/i18n/messages/{fr,en,ar}/index.ts` (register `listings`), `web/src/lib/show-error.ts` (map the five `LISTING_*` codes)

**Interfaces:**
- Consumes: `listings` table and its data-layer permissions (Tasks 2–3).
- Produces: `type ListingKind = 'rent' | 'sale'`; `type ListingStatus = 'draft' | 'published' | 'paused' | 'closed'`; `AMENITIES` (the nine values of Task 2, same order); `defaultKindFor(unitStatus: string): ListingKind | null` (`for_sale` → `'sale'`, `vacant` / `rented` → `'rent'`, else `null`); `listingErrorKey(message: string): keyof Messages['listings']['errors'] | null` (finds a `LISTING_*` code inside a GraphQL error message); `<ListingCardErp unitId unitStatus />`.

- [ ] **Step 1: Write the failing tests**
  - `listings.test.ts`: `defaultKindFor('for_sale')` → `'sale'`; `defaultKindFor('rented')` → `'rent'`; `defaultKindFor('sold')` → `null`; `listingErrorKey('database query error: LISTING_NEEDS_PHOTO')` → `'needsPhoto'`; unknown text → `null`.
  - `listing-form.test.tsx` (stub `graphql`): submitting with an empty title shows the catalog's required-field message and sends nothing; « Publier » sends an update with `status: 'published'`; a rejected call carrying `LISTING_NEEDS_PHOTO` shows `t.listings.errors.needsPhoto` in an element with role `alert`; for a `sale` listing the rent-only fields (charges, deposit months) are hidden and the reservation fields are shown.
- [ ] **Step 2: Run** `npx vitest run src/lib/listings.test.ts src/components/listings` — expected FAIL.
- [ ] **Step 3: Implement.** The card shows the unit's open listing (if any) with its status chip, or « Créer une annonce » when none exists (hidden for `viewer` through `useCanEdit`). Form fields: kind (only the kinds the unit allows), title, description, price (« Loyer mensuel » or « Prix de vente »), charges and deposit months (rent), reservation deposit and days (sale), available from, furnished, amenities (checkboxes from `AMENITIES`), virtual tour URL. Buttons: « Enregistrer » (draft), « Publier », « Mettre en pause », « Clôturer » (sets `closed`, `closed_reason = 'manual'`, confirmed with `ConfirmDialog`). Link « Voir sur le site » to `/logement/<id>` when published. French copy of the five errors: « Indiquez un prix avant de publier. », « Ajoutez au moins une photo du logement avant de publier. », « Ce logement est archivé : il ne peut pas être publié. », « Ce logement ne peut pas être mis en location maintenant (il doit être libre, ou loué avec un bail qui se termine dans les 90 jours). », « Ce logement ne peut pas être mis en vente (il doit être « à vendre » ou loué). »; English and Arabic translations of each.
- [ ] **Step 4: Run** the tests → PASS; `npx tsc --noEmit`; `npx eslint src`.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): publish a unit from the ERP (listing card)"`

### Task 5: Public data layer and search parameters

**Files:**
- Create: `web/src/lib/site/config.ts`, `web/src/lib/site/public-api.ts`, `web/src/lib/site/public-api.test.ts`, `web/src/lib/site/search-params.ts`, `web/src/lib/site/search-params.test.ts`, `web/src/lib/site/listings-queries.ts`, `web/src/lib/site/similar.ts`, `web/src/lib/site/similar.test.ts`
- Modify: `web/.env.example` (add `NEXT_PUBLIC_AGENCY_ORG_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGENCY_PHONE`, `NEXT_PUBLIC_AGENCY_EMAIL`, `NEXT_PUBLIC_AGENCY_ADDRESS`)

**Interfaces:**
- Produces:
  - `siteConfig: { orgId: string; siteUrl: string; agencyName: 'Emerald Immobilier'; phone: string; email: string; address: string }` (defaults: phone `+216 71 000 000`, address `Rue du Lac Biwa, Les Berges du Lac, Tunis`).
  - `publicGraphqlUrl(): string` = `https://${NEXT_PUBLIC_NHOST_SUBDOMAIN}.graphql.${NEXT_PUBLIC_NHOST_REGION}.nhost.run/v1`; `publicImageUrl(fileId: string, width: number): string` = `https://${subdomain}.storage.${region}.nhost.run/v1/files/${fileId}?w=${width}&q=80`; `publicQuery<T>(query: string, variables: Record<string, unknown>): Promise<T>`, server only (`import 'server-only'`), `fetch` POST with no auth header, throws on GraphQL errors.
  - `type SearchMode = 'rent' | 'sale'`; `type SearchFilters = { cities: string[]; types: ('apartment' | 'office' | 'shop' | 'parking')[]; priceMin?: number; priceMax?: number; roomsMin?: number; surfaceMin?: number; furnished?: boolean; availableFrom?: string; sort: 'recent' | 'price_asc' | 'price_desc'; page: number }`; `parseSearchParams(params: Record<string, string | string[] | undefined>): SearchFilters`; `toQueryString(filters: SearchFilters): string`. URL keys: `ville` (repeatable), `type` (repeatable), `prix_min`, `prix_max`, `pieces`, `surface_min`, `meuble=1`, `dispo` (`YYYY-MM-DD`), `tri`, `page`.
  - `PAGE_SIZE = 12`; `type PublicListing` (fields of `public_listings` in camelCase plus `photos?: { storageFileId: string; position: number }[]`); `getLatestListings(mode: SearchMode, limit: number): Promise<PublicListing[]>`; `searchListings(mode: SearchMode, filters: SearchFilters): Promise<{ items: PublicListing[]; total: number; cities: string[] }>`; `getListing(id: string): Promise<PublicListing | null>` (null when absent, unpublished or of another organization); `countPublished(): Promise<{ total: number; cities: number }>`; `pickSimilar(base: PublicListing, candidates: PublicListing[], limit = 3): PublicListing[]` (same kind and city, price within ±25 %, never `base`, closest price first). Every query filters `organization_id = siteConfig.orgId`; query functions use `'use cache'` with `cacheLife('minutes')`.

- [ ] **Step 1: Write the failing tests**
  - `search-params.test.ts`: `{ ville: ['Carthage', 'La Marsa'], prix_max: '2000', pieces: '2', tri: 'price_asc', page: '2' }` → `cities: ['Carthage', 'La Marsa'], priceMax: 2000, roomsMin: 2, sort: 'price_asc', page: 2`; garbage `{ prix_max: 'abc', page: '-3', pieces: '99', type: 'castle', dispo: '2026-13-40', tri: 'drop' }` → `priceMax` undefined, `page: 1`, `roomsMin: 10` (clamped), `types: []`, `availableFrom` undefined, `sort: 'recent'`; `ville` values are trimmed, cut to 60 characters and at most 10 are kept; `toQueryString(parseSearchParams(x))` round-trips and leaves out defaults (`page=1`, `tri=recent`).
  - `similar.test.ts`: around a Carthage rent base at 1 450 with candidates at 1 450, 1 100, 1 800, 1 900, 1 450 (other city) and 1 450 (sale) → only the Carthage rent ones within 1 087.5–1 812.5, closest first, never the base, at most 3.
  - `public-api.test.ts`: `publicImageUrl('abc', 640)` with subdomain `xyz` and region `eu-central-1` → `https://xyz.storage.eu-central-1.nhost.run/v1/files/abc?w=640&q=80`; `publicQuery` sends no `Authorization` header (stubbed `fetch`) and rejects when the response has `errors`.
- [ ] **Step 2: Run** `npx vitest run src/lib/site` — expected FAIL.
- [ ] **Step 3: Implement.** The GraphQL `where` built from filters: `kind`, `price` `_gte`/`_lte`, `rooms` `_gte`, `surface_m2` `_gte`, `city` `_in`, `unit_type` `_in`, `furnished`, `available_from` `_lte` the chosen date or null; order `published_at desc` or `price asc|desc`; `limit PAGE_SIZE`, `offset (page - 1) * PAGE_SIZE`; `public_listings_aggregate` for `total`; distinct cities for the filter list.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public listings data layer and search parameters"`

### Task 6: Public shell (layout, header, footer, `site` catalog)

**Files:**
- Create: `web/src/app/(site)/layout.tsx`, `web/src/app/(site)/not-found.tsx`, `web/src/components/site/site-header.tsx`, `web/src/components/site/site-footer.tsx`, `web/src/components/site/site-shell.test.tsx`, `web/src/i18n/messages/{fr,en,ar}/site.ts`
- Modify: `web/src/i18n/messages/{fr,en,ar}/index.ts` (register `site`), `web/src/app/layout.tsx` (load Plus Jakarta Sans as `--font-heading-site`, used only by the public pages' headings)

**Interfaces:**
- Consumes: `siteConfig` (Task 5); the existing `LanguageSwitcher`.
- Produces: `<SiteHeader />`: logo « Emerald Immobilier » with the `Building2` icon linking to `/`; links Louer `/louer`, Acheter `/acheter`, Comment ça marche `/#comment-ca-marche`, Contact `/#contact`; frosted button « Espace client » (links to `/#contact` until slice 2 adds `/compte/connexion`); mobile menu in a `Sheet`. `<SiteFooter id="contact" />`: logo and one-line description, badge « Agence immobilière agréée — Tunisie », address, phone and e-mail from `siteConfig`, links Louer, Acheter, Mentions légales, Confidentialité, the language switcher, copyright « © 2026 Emerald Immobilier Tunisie. Tous droits réservés. ». The `(site)` layout renders header, `<main id="contenu">` and footer on the page background `#F4FBF7` (light) without the ERP sidebar or app shell; the public 404 page offers « Voir les logements à louer ».

- [ ] **Step 1: Write the failing test** `site-shell.test.tsx`: the header has links with hrefs `/louer` and `/acheter`; the footer contains « Agence immobilière agréée — Tunisie » and « © 2026 Emerald Immobilier Tunisie. Tous droits réservés. »; `document.body.textContent` never matches `/FNAIM/i`; with the `ar` catalog the header shows the Arabic labels.
- [ ] **Step 2: Run** `npx vitest run src/components/site` — expected FAIL.
- [ ] **Step 3: Implement** following the Stitch Accueil header and footer.
- [ ] **Step 4: Run** → PASS; `npm run build` passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public site layout, header and footer"`

### Task 7: Listing card (shared by home, search and similar listings)

**Files:**
- Create: `web/src/components/site/listing-card.tsx`, `web/src/components/site/listing-card.test.tsx`

**Interfaces:**
- Consumes: `PublicListing`, `publicImageUrl` (Task 5).
- Produces: `<ListingCard listing={PublicListing} />` per the Stitch cards: cover photo (`publicImageUrl(coverFileId, 640)`, `loading="lazy"`, placeholder with the `ImageOff` icon when `coverFileId` is null), chip « Disponible », city with the `MapPin` icon, title, specs (surface, rooms, floor), price as `formatTnd(price)` plus « / mois » for rent, link to `/logement/<id>`, a favourite heart button that is disabled with the tooltip « Bientôt » until slice 4.

- [ ] **Step 1: Write the failing test** `listing-card.test.tsx`: a rent listing at 1450 shows « 1 450 » and « / mois »; a sale listing shows no « / mois »; the title element has class `line-clamp-2`; the price element has `tabular-nums` and `dir="ltr"`; with `coverFileId: null` the placeholder (role `img`, alt text from the catalog) renders instead of an `<img>`; the card links to `/logement/<id>`.
- [ ] **Step 2: Run** `npx vitest run src/components/site/listing-card.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public listing card"`

### Task 8: Home page `/`

**Files:**
- Create: `web/src/app/(site)/page.tsx`, `web/src/components/site/home-hero.tsx`, `web/src/components/site/home-sections.tsx`, `web/src/components/site/home.test.tsx`

**Interfaces:**
- Consumes: `getLatestListings`, `countPublished`, `toQueryString` (Task 5); `<ListingCard />` (Task 7).
- Produces: the home page per the Stitch Accueil screen. Hero with photo (a static image in `web/public/site/hero.jpg`, licence-free, source credited in a comment), title « Trouvez le logement qui vous ressemble, à louer ou à acheter », subtitle, search card (Louer / Acheter toggle, Ville from the published cities, Type de bien, Budget max) that navigates to `/louer?…` or `/acheter?…` built with `toQueryString`; four stat cards (published count, city count, « Visite sous 48 h », « Dossier 100 % en ligne »); « Nouveautés à la location » (3 latest rent) and « À vendre » (3 latest sale) with « Voir toutes… » links; « Comment ça marche » (anchor `comment-ca-marche`, four steps); the sand band; `generateMetadata` with the French title and description. The server page fetches; client sections render text through `useT`.

- [ ] **Step 1: Write the failing test** `home.test.tsx` (client sections with fixture listings, stubbed router): submitting the hero form in Acheter mode with Ville « La Marsa » and budget 400 000 navigates to `/acheter?ville=La+Marsa&prix_max=400000`; with no rent listings the « Nouveautés à la location » section shows its empty text instead of cards; the first stat card shows the fixture count.
- [ ] **Step 2: Run** `npx vitest run src/components/site/home.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement**; cards are `StaggerItem`s so the app-wide reveal applies (wrap the `(site)` layout's content in `ScrollStagger` in this task).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public home page"`

### Task 9: Search pages `/louer` and `/acheter`

**Files:**
- Create: `web/src/app/(site)/louer/page.tsx`, `web/src/app/(site)/acheter/page.tsx`, `web/src/components/site/search-page.tsx` (server), `web/src/components/site/search-filters.tsx`, `web/src/components/site/search-results.tsx`, `web/src/components/site/search.test.tsx`

**Interfaces:**
- Consumes: `parseSearchParams`, `toQueryString`, `searchListings`, `PAGE_SIZE` (Task 5); `<ListingCard />` (Task 7); the existing map component in `web/src/components/map` for the « Carte » view.
- Produces: `SearchPage({ mode: SearchMode, searchParams: Promise<Record<string, string | string[] | undefined>> })`, used by both routes. Per the Stitch « Logements à louer » screen: title with the result count, Louer / Acheter toggle (links), sort select, Liste / Carte toggle (`vue=carte` in the URL); the filter column is a GET form (works without JavaScript) submitted by « Appliquer les filtres »; « Réinitialiser » links to the bare path; removable active-filter chips (each a link to the URL without that value); a 3-column grid of `ListingCard`; pagination links; an empty state (`SearchX` icon with `animation="draw"`, « Aucun logement ne correspond à ces critères », link « Réinitialiser les filtres »); the « Créer une alerte » card shows with its button disabled and « Bientôt » (slice 4). `generateMetadata`: « Logements à louer » / « Biens à vendre », with the city when exactly one is selected.

- [ ] **Step 1: Write the failing test** `search.test.tsx` (client parts with fixtures): the `Carthage` chip links to the same URL without `ville=Carthage`; « Réinitialiser » links to `/louer`; page 2 of 30 results shows links to pages 1 and 3 that keep the filters; zero results show the empty-state text; switching to Acheter keeps the city filter and drops the price filters (rent and sale prices differ).
- [ ] **Step 2: Run** `npx vitest run src/components/site/search.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `npm run build`.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public search pages for rent and sale"`

### Task 10: Unit page `/logement/[listingId]`

**Files:**
- Create: `web/src/app/(site)/logement/[listingId]/page.tsx`, `web/src/components/site/listing-gallery.tsx`, `web/src/components/site/listing-details.tsx`, `web/src/components/site/listing-contact-card.tsx`, `web/src/components/site/listing-page.test.tsx`

**Interfaces:**
- Consumes: `getListing`, `searchListings`, `pickSimilar`, `publicImageUrl`, `siteConfig` (Task 5); `<ListingCard />` (Task 7); the existing `PhotoViewer` for full-screen photos.
- Produces, per the Stitch « Fiche logement » screen: `notFound()` when `getListing` returns null. Gallery (large photo + 4 thumbnails; « Voir les N photos » opens the viewer; placeholder when there is no photo); title, chip, breadcrumb Accueil › Louer|Acheter › city › title; key facts with icons (surface, rooms, floor, furnished, amenities labelled from the catalog); description; « Emplacement » with the map pin at the rounded coordinates (no map when coordinates are null); « Conditions » — rent: loyer, charges, dépôt de garantie = `depositMonths × price` shown as « 2 mois (2 900 TND) », disponible le; sale: prix, acompte de réservation and its duration; « Documents demandés » (rent only, static list from the catalog); a sticky contact card with the price, the agency phone and e-mail from `siteConfig` as `tel:` and `mailto:` links, and « Le dépôt de dossier en ligne arrive bientôt. » in place of the application and offer buttons (slices 2 and 3 replace it); « Visite virtuelle » only when `virtualTourUrl` is set (new tab, `rel="noopener noreferrer"`); « Biens similaires » from `pickSimilar` (hidden when empty); `generateMetadata` with title, city, price and the cover image as Open Graph image.

- [ ] **Step 1: Write the failing test** `listing-page.test.tsx` (client parts with fixtures): a rent listing at 1450 with `depositMonths: 2` shows « 2 900 »; a sale listing shows the reservation deposit and no « Documents demandés »; a listing with no photo renders the placeholder and no « Voir les » button; « Visite virtuelle » is absent when `virtualTourUrl` is null and, when set, is a link with `target="_blank"` and `rel="noopener noreferrer"`; the contact card links `tel:+21671000000`.
- [ ] **Step 2: Run** `npx vitest run src/components/site/listing-page.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): public unit page"`

### Task 11: End-to-end test, setup steps for the user, full verification

**Files:**
- Create: `web/e2e/front-office.spec.ts`, `docs/superpowers/handoffs/2026-10-22-front-office-slice-1.md`
- Modify: `web/e2e/helpers.ts` (staff login at `/erp/connexion`, if Task 1 has not already done it)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write** `front-office.spec.ts`: staff signs in at `/erp/connexion`; opens a vacant seeded unit that has a photo, creates a rent listing « Appartement test E2E » at 1 234 TND and publishes it; signs out; as a visitor opens `/louer`, finds the card « Appartement test E2E » with « 1 234 », opens it, sees « Conditions » and « 2 468 » (deposit); `/biens` redirects to `/erp/biens`; staff signs in again and closes the listing; `/logement/<id>` now shows the public 404 page.
- [ ] **Step 2: Write the handoff** for the user, in order, each with how to check it worked: (1) apply `db/migrations/0005_listings.sql` then `db/seeds/0005_listings.sql` in the legacy cloud console; (2) in the console → Settings → environment variables, set `HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public`; (3) run `node scripts/apply-hasura-permissions.mjs` with `HASURA_ADMIN_SECRET` set; (4) add `NEXT_PUBLIC_AGENCY_ORG_ID` (from `select id from organizations`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AGENCY_PHONE`, `NEXT_PUBLIC_AGENCY_EMAIL`, `NEXT_PUBLIC_AGENCY_ADDRESS` to `web/.env.local`, then `docker compose restart web`; (5) publish one unit from the ERP and open `/louer` while logged out; (6) run the E2E with the user's own test credentials.
- [ ] **Step 3: Verify everything** — `cd web; npx tsc --noEmit; npx eslint src; npx vitest run; npm run build` all green; SQL tests `0002`–`0005` print `OK: all`; `node scripts/apply-hasura-permissions.mjs --dry-run` succeeds. The E2E needs the live backend set up by the handoff, so it is run after the user's steps.
- [ ] **Step 4: Commit** — `git commit -m "test(e2e): publish a unit and see it on the public site; slice 1 handoff"`
