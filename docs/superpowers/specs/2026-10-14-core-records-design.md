# Project 1 — Core records: biens, unités, contacts (design)

Date: 2026-10-14 · Status: approved in conversation, awaiting written-spec review

This is the first of three projects (1 core records → 2 leases → 3 sales). Leases, sales, fee calls and
accounting are out of scope here. Staff-only, French-only UI, same visual system as the existing pages
(shadcn/ui, Emerald tokens, motion primitives).

## 1. Goals

Staff can fully maintain biens, units and contacts, and see how they connect:

1. Edit biens, units and contacts (today only creation exists). Archive contacts as well as biens and units.
2. Record who owns each unit, with shares and dates, including the organization itself as owner.
3. See the links both ways: owners on bien and unit pages, owned units on the contact page.
4. Attach photos and documents to biens and units.
5. See biens on a map and place them precisely.
6. Find and fix incomplete records.
7. Record a building's common areas and each unit's share in thousandths.

Success: every item above works end to end for an `org_admin` or `manager`, read-only for a `viewer`,
with no data visible across organizations.

## 2. Decisions (with the reason)

| Decision | Reason |
|---|---|
| Ownership attaches to **units only**. A bien's owners are derived from its units. | One answer to "who owns this / who gets the rent". Leases and sales are on units too. |
| Houses and plots get **one unit automatically** ("Maison" / "Terrain"). | Keeps the units-only model; a house lease or sale needs a unit anyway. |
| Ownership is **effective-dated** with a **share %**; several co-owners allowed (indivision). | Glossary §5, scope matrix §4.4 (MVP). Needed to sell a leased unit. |
| The organization owns its own stock through one **self contact** (`is_organization`). | Glossary N-03: one ownership model for both seller types. |
| Business rules live **in the database** (constraints, triggers, views), exposed by the data layer. | Leases and sales reuse the same views; bad data cannot be written around the UI. |
| Map: **Leaflet + OpenStreetMap** tiles, address search via **Nominatim** on demand, then drag/click to adjust. | Free, no key, user-friendly; Tunisian addresses often need manual adjustment. Google left out (billing key). |
| Common-area shares in **thousandths (‰) per unit**, suggested from surfaces, editable, warning when total ≠ 1000. | Matches Tunisian co-ownership rulebooks while staying quick to fill. |
| Duplicate contacts are **warned, not blocked**. | Two people can legitimately share a phone or e-mail. |
| Deletion of biens/units/contacts with history is **not offered**; archive instead. | Keeps history for later leases, sales and statements. |

## 3. Data model — migration `db/migrations/0002_core_records.sql`

All new tables carry `organization_id uuid not null`, `created_at`, `updated_at`, and composite foreign
keys `(x_id, organization_id)` like 0001, so a row can only point at rows of the same organization.

### 3.1 Changes to existing tables

- `contacts`
  - `archived_at timestamptz` (nullable).
  - `is_organization boolean not null default false`; partial unique index: one `true` per organization.
- `units`
  - `type` check extended with `house`, `land`.
  - `common_share integer` (nullable), check `common_share between 0 and 1000`.
  - Unique `(property_id, code)` (verify seed data first; seed codes are already unique per bien).

### 3.2 New tables

**`ownerships`**

| Column | Type | Rule |
|---|---|---|
| `id` | uuid pk | |
| `unit_id` | uuid | FK → units (same org) |
| `contact_id` | uuid | FK → contacts (same org) |
| `share_percent` | numeric(5,2) | `> 0 and <= 100` |
| `starts_on` | date | not null |
| `ends_on` | date | nullable = still current; check `ends_on >= starts_on` |
| `notes` | text | |

- Exclusion constraint (btree_gist): same `(unit_id, contact_id)` cannot have overlapping
  `daterange(starts_on, ends_on, '[]')`.
- Constraint trigger, `deferrable initially deferred`: for the affected unit, the sum of
  `share_percent` of rows overlapping any day must stay ≤ 100. Deferred so a transfer (end old rows +
  insert new rows in one GraphQL request, which the data layer runs in one transaction) passes.

**`property_files`**

| Column | Type | Rule |
|---|---|---|
| `id` | uuid pk | |
| `property_id` | uuid null | FK → properties (same org) |
| `unit_id` | uuid null | FK → units (same org) |
| `storage_file_id` | uuid | FK → `storage.files(id)` on delete cascade |
| `kind` | text | `photo` or `document` |
| `category` | text null | documents only: `title_deed`, `plan`, `certificate`, `contract`, `other` |
| `title` | text | not empty |
| `is_cover` | boolean | default false; partial unique: one cover per bien and per unit |
| `sort_order` | integer | default 0 |

- Check: exactly one of `property_id`, `unit_id` is set.
- Check: `category` is null when `kind = 'photo'`, not null when `kind = 'document'`.

**`common_areas`**

| Column | Type | Rule |
|---|---|---|
| `id` | uuid pk | |
| `property_id` | uuid | FK → properties (same org) |
| `name` | text | not empty |
| `kind` | text | `stairs`, `lift`, `garden`, `roof`, `parking`, `other` |
| `notes` | text | |

### 3.3 Triggers

- After insert on `properties` where `type in ('house','plot')`: insert one unit with
  `code = 'MAISON'` / `'TERRAIN'`, `type = 'house'` / `'land'`, same organization.
- After insert on `organizations`: insert its self contact (`kind = 'company'`, `full_name` = org name,
  `is_organization = true`). The migration back-fills one for each existing organization.
- `updated_at` maintenance on the new tables, same as 0001.

### 3.4 Views (tracked by the data layer, select-only)

- `current_ownerships`: ownerships where `starts_on <= current_date` and
  (`ends_on is null` or `ends_on >= current_date`).
- `property_owners`: per bien and contact, number of units currently held and the list of unit ids.
- `record_gaps`: one row per missing item:
  `organization_id, entity_type (property|unit|contact), entity_id, property_id, gap_code, label`.
  Gap codes:
  - unit: `no_owner`, `no_surface`, `no_rent` (only when status is `vacant` or `rented`)
  - property: `no_address`, `no_position`, `shares_total` (building with ≥ 2 active units whose
    `common_share` total ≠ 1000)
  - contact: `no_contact_info` (no phone and no e-mail; self contact excluded)
  Archived rows are excluded.

### 3.5 Permissions (`scripts/apply-hasura-permissions.mjs`, additive)

- New tables and views: select for `org_admin`, `manager`, `viewer` filtered by
  `organization_id = X-Hasura-Org-Id`.
- `ownerships`, `property_files`, `common_areas`: insert/update/delete for `org_admin`, `manager`;
  `organization_id` set from the JWT on insert, never updatable.
- `contacts.is_organization` is never writable by clients. `contacts.archived_at` and
  `units.common_share` added to the writers' update columns.
- Relationships: `units.ownerships`, `units.current_owners`, `contacts.ownerships`,
  `properties.files`, `units.files`, `properties.common_areas`, `properties.owners` (view).
- Storage (`storage.files`), added without replacing the storage service's own metadata:
  - insert: writers, check `bucket_id = 'property-files'`;
  - select / delete: rows that have a `property_files` link in the user's organization
    (manual relationship `storage.files.id → property_files.storage_file_id`).
- Bucket `property-files` created by the migration: private, 10 MB max, presigned URLs enabled.

## 4. Pages

### 4.1 Biens

- **`/biens` (list)**: cover thumbnail per bien; current owner on each unit row; new "Propriétaire"
  filter; link to the map.
- **Bien form** — shared by `/biens/nouveau` and new `/biens/[id]/modifier`: current fields + map
  picker (search + draggable pin). For house/plot, a note says the unit is created automatically.
- **`/biens/[id]`** with tabs:
  - *Aperçu*: stat tiles, address with a small map, owners summary
    ("Sté Foncière Carthage — 11 unités · Hédi Ben Salem — 1 unité").
  - *Unités*: table + owner column + row checkboxes; bulk action "Définir le propriétaire"
    (selected or all units).
  - *Photos*: grid, upload, set cover, reorder, full-screen viewer.
  - *Documents*: grouped by category, upload, preview (PDF/images), download, delete.
  - *Parties communes*: list of areas (add/edit/delete) + shares table with
    "Proposer selon les surfaces" and a live total (red when ≠ 1000).
  - Header actions: Modifier, Archiver/Restaurer, Ajouter une unité.

### 4.2 Unités — `/biens/[id]/unites/[unitId]` with tabs

- *Aperçu*: facts and status (as today).
- *Propriétaires*: current owners with %, history timeline; "Ajouter un copropriétaire";
  "Transférer la propriété" dialog (transfer date, new owners and shares; current owners end the day
  before; one request).
- *Photos*, *Documents*: same components as the bien.
- "Modifier" opens the unit dialog in edit mode (the add-unit dialog, generalised).

### 4.3 Contacts

- **`/contacts`**: "Afficher les archivés" toggle; owned-units count column.
- **Contact form** — shared by `/contacts/nouveau` and new `/contacts/[id]/modifier`: duplicate warning
  on CIN, e-mail, phone with a link to the existing contact; saving still allowed.
- **`/contacts/[id]`**: Propriétaire card lists current units (share, since) and past units, each
  linked; Locataire and Acquéreur cards say they arrive with Baux and Ventes. Actions: Modifier,
  Archiver/Restaurer. The self contact cannot be archived.

### 4.4 New pages and navigation

- **`/biens/carte`**: full-width map; pins coloured by occupancy (all rented / partly / none) with a
  legend; city and branch filters; side list; popup with key figures and "Ouvrir"; biens without
  position listed with "Placer sur la carte".
- **`/biens/fiches-incompletes`** (new nav entry under Biens): gaps grouped by biens, units, contacts
  with counts; each line has "Compléter" linking to the exact form or tab.
- **`/biens/parties-communes`**: every building with its area count and share-total status, linking to
  the bien's tab.
- **Dashboard**: "Fiches incomplètes : N" tile linking to the page.

## 5. Files and map

### 5.1 Photos and documents

- Accepted: photos JPG/PNG/WebP; documents PDF/JPG/PNG; max 10 MB each. Checked in the browser and by
  the bucket.
- Upload: storage upload (S3, Floci) to `property-files` → insert `property_files`. If the insert fails,
  delete the uploaded file immediately (no orphans).
- Thumbnails via storage image transformation (width parameter); full size and PDFs via presigned URLs.
- Delete: confirmation dialog → delete `property_files` row → delete the storage file.
- Drop zone + file picker, multiple files, per-file progress, French errors
  ("Fichier trop lourd (max 10 Mo)", "Format non accepté").

### 5.2 Map

- `leaflet` + `react-leaflet`, loaded client-side only (dynamic import, no SSR). OpenStreetMap tiles
  with attribution.
- Address search runs only on "Rechercher" (never per keystroke), `countrycodes=tn`, max 5 results; empty
  result → "Adresse introuvable, placez le repère sur la carte."
- Pins as coloured `divIcon`s; positions stored in the existing `latitude`/`longitude` columns.
- Map access goes through one small module so the provider can be swapped later.

## 6. Errors

One shared mapper turns database/data-layer errors into French messages:

| Cause | Message |
|---|---|
| shares > 100 % | « Le total des parts dépasse 100 % à partir du JJ/MM/AAAA. » |
| overlapping period, same owner | « Ce propriétaire détient déjà cette unité sur cette période. » |
| end before start | « La date de fin doit suivre la date de début. » |
| duplicate unit code | « La référence X existe déjà dans ce bien. » |
| permission / network | toast with « Réessayer »; form values kept |

## 7. Testing

- **Database**: `db/tests/0002_core_records.test.sql`, run in the SQL editor inside a transaction that
  rolls back. Covers: 100 % cap, transfer in one transaction, overlap exclusion, end ≥ start, house
  auto-unit, self contact creation, unit code uniqueness, `record_gaps` rows.
  Cross-organization isolation is checked through the data layer with two JWT roles in the E2E suite.
- **Unit (Vitest)**: share suggestion (largest-remainder so the total is exactly 1000), transfer
  date maths, error mapper, gap labels and links, file validation.
- **Component (Testing Library)**: forms (validation, duplicate warning), shares table total, transfer
  dialog.
- **E2E (Playwright)**: create bien → add units → set owner for all → transfer B-101 → contact page
  shows it → upload a photo → place the pin → incomplete list shrinks. Credentials come from a
  git-ignored `web/.env.test.local` filled by the user.
- Coverage ≥ 80 % on new logic; browser check of each page at desktop and mobile widths.

## 8. Build order

Each step is usable on its own:

1. Migration 0002, DB tests, permissions script.
2. Edit forms (bien, unit, contact) and contact archiving.
3. Ownership: unit tab, bulk owner, transfer, contact Propriétaire card, list columns.
4. Common areas and shares.
5. Photos and documents.
6. Map (form picker, then `/biens/carte`).
7. Incomplete records page and dashboard tile.

## 9. Out of scope

Leases and rent requests (project 2); mandates, listings, offers, closing, installments (project 3);
fee calls, invoices, statements (Finance); Google Maps; owner/renter portals (V1).
