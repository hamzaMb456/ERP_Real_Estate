# Core Records (biens, unités, contacts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish biens, unités and contacts: edit forms, effective-dated ownership on units, links shown both ways, photos and documents, map, incomplete-record list, common areas with ‰ shares.

**Architecture:** Business rules live in Postgres (constraints, a deferred constraint trigger, triggers, three views) and are exposed by Hasura with organization-scoped permissions. The Next.js client pages stay thin: they query Hasura through `useGraphql`/`graphql`, and the pure rules they still need (share suggestion, transfer planning, error wording, gap links, file checks, geocoding parsing) live in small tested modules under `web/src/lib/`.

**Tech Stack:** Postgres 15 + Hasura (Nhost), Nhost Storage, Next.js 16.4 App Router (client pages), React 19.3, shadcn/ui (radix-nova), react-hook-form + zod 4, motion 14, Leaflet + react-leaflet, OpenStreetMap tiles + Nominatim, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-core-records-design.md` — read it alongside this plan.

## Global Constraints

- UI text is French only; staff-only screens; reuse the existing visual system (shadcn/ui components in `web/src/components/ui`, `PageHeader`, motion primitives in `web/src/components/motion/primitives.tsx`).
- Every new table carries `organization_id uuid not null` with composite foreign keys `(x_id, organization_id)`; `organization_id` is set by Hasura insert presets and is never in an update permission.
- Writers are `org_admin` and `manager`; `viewer` is read-only. Hide write buttons for viewers with `useCanEdit()` (Task 3).
- Money is TND with 3 decimals; dates are `YYYY-MM-DD` strings in the API and `JJ/MM/AAAA` on screen.
- Ownership dates are inclusive on both ends; a transfer on date D ends the previous owners on D − 1.
- Files: photos JPG/PNG/WebP, documents PDF/JPG/PNG, max 10 MB each; bucket `property-files`, private. The bucket enforces the size; the type is checked in the browser (Nhost buckets have no MIME filter).
- Map tiles: OpenStreetMap with attribution; address search only on an explicit click, `countrycodes=tn`, max 5 results.
- Common-area shares are integers 0–1000 per unit; the building total must be 1000.
- Schema changes are applied by the user in the Nhost dashboard SQL editor; Hasura metadata by the user running `node scripts/apply-hasura-permissions.mjs` with `HASURA_ADMIN_SECRET`. Never type secrets or credentials.
- Run the `database-reviewer` agent on every SQL file in this plan before the user applies it.
- Commit steps: the user has asked to hold commits. Execute a task's commit step only once the user lifts the hold; otherwise skip it and move on.
- Next.js 16 note (`web/AGENTS.md`): read `web/node_modules/next/dist/docs/` before using an API you have not seen in this repo.
- Hash-driven UI: tabs and the unit edit dialog follow the URL hash (`#proprietaires`, `#modifier`, …) through `useHash`/`useHashTab` (Task 5), so links from other pages can open the exact place to fix.

## Review Focus

1. **Transfer on the same day an owner started** (`starts_on = transfer date`): expect a clear French refusal, not a raw check-constraint error. Test in Task 4 (`planTransfer` blocking case).
2. **Building whose units have no surface yet**: "Proposer selon les surfaces" must still give a total of exactly 1000 (equal split). Test in Task 4 (`suggestShares` all-null case).
3. **Upload succeeds but saving the link row fails** (network drop, permission): the stored file must be deleted, the user sees one French error. Test in Task 12 (`uploadAndLink` rollback test with injected client).
4. **Phone typed with spaces or `+216`** in the contact form: the duplicate warning must still match the stored `+216 20 000 001`. Test in Task 7 (`normalizePhone`/`findDuplicates`).
5. **Nominatim unreachable or rate-limited (HTTP 429)**: the form must stay usable with "Adresse introuvable, placez le repère sur la carte." Test in Task 13 (`geocodeAddress` non-OK response test).

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `db/migrations/0002_core_records.sql` | Schema, triggers, views, bucket | 1 |
| `db/seeds/0002_demo_core_records.sql` | Demo ownerships, shares, common areas | 1 |
| `db/tests/0002_core_records.test.sql` | Self-rolling-back DB rule tests | 1 |
| `scripts/apply-hasura-permissions.mjs` | Tracking, relationships, permissions, storage rules | 2 |
| `web/vitest.config.ts`, `web/src/test/setup.ts` | Unit/component test setup | 3 |
| `web/src/lib/errors.ts` | DB/Hasura error → French message | 3 |
| `web/src/lib/use-can-edit.ts` | Writer role check | 3 |
| `web/src/lib/ownership.ts` | Dates, current check, owner validation, transfer plan | 4 |
| `web/src/lib/shares.ts` | ‰ suggestion and totals | 4 |
| `web/src/lib/occupancy.ts` | Occupancy level for pins and badges | 4 |
| `web/src/lib/use-hash.ts` | Tabs/dialogs driven by the URL hash | 5 |
| `web/src/components/domain/property-form.tsx` | Bien create/edit form | 5, 13 |
| `web/src/app/(app)/biens/[id]/modifier/page.tsx` | Bien edit page | 5 |
| `web/src/components/domain/unit-dialog.tsx` | Unit create/edit dialog (replaces `add-unit-dialog.tsx`) | 6 |
| `web/src/lib/contact-duplicates.ts` | Duplicate matching | 7 |
| `web/src/components/domain/contact-form.tsx` | Contact create/edit form | 7 |
| `web/src/components/domain/duplicate-notice.tsx` | Duplicate warning box | 7 |
| `web/src/app/(app)/contacts/[id]/modifier/page.tsx` | Contact edit page | 7 |
| `web/src/components/ui/popover.tsx` | shadcn popover (CLI) | 8 |
| `web/src/components/ownership/*` | Contact picker, owners editor, transfer and co-owner dialogs | 8 |
| `web/src/components/ownership/unit-owners-tab.tsx` | Unit "Propriétaires" tab | 9 |
| `web/src/components/property/*` | Bien tabs: overview, units table | 10 |
| `web/src/components/common-areas/*` | Areas list, shares table | 11 |
| `web/src/lib/files.ts`, `web/src/lib/upload.ts`, `web/src/lib/storage.ts` | File checks, upload-and-link, storage calls | 12 |
| `web/src/components/files/*` | Drop zone, gallery, viewer, documents, thumbnail | 12 |
| `web/src/lib/geocode.ts`, `web/src/lib/map-config.ts` | Address search, tile provider | 13 |
| `web/src/components/map/*` | Location picker, biens map | 13 |
| `web/src/lib/gaps.ts` | Gap labels, links, grouping | 14 |
| `web/src/app/(app)/biens/fiches-incompletes/page.tsx` | Incomplete records page | 14 |
| `web/playwright.config.ts`, `web/e2e/core-records.spec.ts` | E2E flow | 15 |

---

### Task 1: Database migration, demo seed and DB tests

**Files:**
- Create: `db/migrations/0002_core_records.sql`
- Create: `db/seeds/0002_demo_core_records.sql`
- Create: `db/tests/0002_core_records.test.sql`

**Interfaces:**
- Consumes: tables from `db/migrations/0001_foundation.sql` (`organizations`, `branches`, `properties`, `units`, `contacts`, `contact_roles`, function `public.set_updated_at()`); Nhost `storage.files`, `storage.buckets`.
- Produces (names every later task uses):
  - tables `public.ownerships(id, organization_id, unit_id, contact_id, share_percent numeric(5,2), starts_on date, ends_on date null, notes)`, `public.property_files(id, organization_id, property_id, unit_id, storage_file_id, kind, category, title, is_cover, sort_order)`, `public.common_areas(id, organization_id, property_id, name, kind, notes)`;
  - columns `contacts.archived_at`, `contacts.is_organization`, `units.common_share`; unit types `house`, `land`;
  - views `public.current_ownerships` (same columns as `ownerships`), `public.property_owners(organization_id, property_id, contact_id, units_count)`, `public.record_gaps(organization_id, entity_type, entity_id, property_id, entity_label, property_label, gap_code)`;
  - error texts: `ownership_shares_exceeded:DD/MM/YYYY`, constraint names `ownerships_no_overlap`, `ownerships_dates_check`, `units_property_id_code_key`;
  - bucket `property-files`.

- [ ] **Step 1: Write the DB test script first (it must fail before the migration exists)**

Create `db/tests/0002_core_records.test.sql`:

```sql
-- Tests for 0002_core_records. Paste into Nhost dashboard → Database → SQL Editor and Run.
-- Everything runs inside one DO block that always ends by raising an exception, so the
-- whole transaction rolls back and no test data stays in the database.
-- Success: the editor shows the error « OK: all core-records tests passed ».
-- Failure: the editor shows an error starting with « FAIL ».
do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br     uuid := '21111111-1111-4111-8111-111111111111';
  prop   uuid := 'a0000000-0000-4000-8000-000000000001';
  u1     uuid := 'a0000000-0000-4000-8000-000000000011';
  u2     uuid := 'a0000000-0000-4000-8000-000000000012';
  c1     uuid := 'a0000000-0000-4000-8000-000000000021';
  c2     uuid := 'a0000000-0000-4000-8000-000000000022';
  org2   uuid := 'a0000000-0000-4000-8000-000000000031';
  c_org2 uuid := 'a0000000-0000-4000-8000-000000000032';
  house  uuid := 'a0000000-0000-4000-8000-000000000041';
  n int;
begin
  insert into properties (id, organization_id, branch_id, name, type) values (prop, org, br, 'Test bien', 'building');
  insert into units (id, organization_id, property_id, code) values (u1, org, prop, 'T-1'), (u2, org, prop, 'T-2');
  insert into contacts (id, organization_id, full_name) values (c1, org, 'Test Un'), (c2, org, 'Test Deux');

  -- 1. Shares above 100 % on the same day are refused.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c1, 80, '2026-01-01'), (org, u1, c2, 30, '2026-01-01');
    set constraints ownerships_shares_cap immediate;
    raise exception 'FAIL 1: shares above 100 %% were accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like 'ownership_shares_exceeded:01/01/2026%' then
      raise exception 'FAIL 1: wrong error: %', sqlerrm;
    end if;
  end;

  -- 2. A transfer (end old owner + start new owner) in one transaction is accepted.
  begin
    set constraints ownerships_shares_cap deferred;
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c1, 100, '2026-01-01');
    update ownerships set ends_on = '2026-03-14' where unit_id = u1 and contact_id = c1;
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c2, 100, '2026-03-15');
    set constraints ownerships_shares_cap immediate;
    raise exception 'PASS 2';
  exception when others then
    if sqlerrm <> 'PASS 2' then raise exception 'FAIL 2: transfer refused: %', sqlerrm; end if;
  end;

  -- 3. The same owner cannot hold overlapping periods on one unit.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on, ends_on)
    values (org, u2, c1, 50, '2026-01-01', '2026-06-30'), (org, u2, c1, 50, '2026-06-01', null);
    raise exception 'FAIL 3: overlap accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%ownerships_no_overlap%' then raise exception 'FAIL 3: wrong error: %', sqlerrm; end if;
  end;

  -- 4. End date before start date is refused.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on, ends_on)
    values (org, u2, c1, 50, '2026-05-01', '2026-04-30');
    raise exception 'FAIL 4: end before start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%ownerships_dates_check%' then raise exception 'FAIL 4: wrong error: %', sqlerrm; end if;
  end;

  -- 5. A contact of another organization cannot own a unit of this one.
  begin
    insert into organizations (id, name) values (org2, 'Autre org');
    insert into contacts (id, organization_id, full_name) values (c_org2, org2, 'Étranger');
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u2, c_org2, 10, '2026-01-01');
    raise exception 'FAIL 5: cross-organization ownership accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%violates foreign key constraint%' then raise exception 'FAIL 5: wrong error: %', sqlerrm; end if;
  end;

  -- 6. A new organization gets its self contact, with the owner role.
  begin
    insert into organizations (id, name) values (org2, 'Autre org');
    select count(*) into n from contacts c join contact_roles r on r.contact_id = c.id and r.role = 'owner'
    where c.organization_id = org2 and c.is_organization and c.full_name = 'Autre org';
    if n <> 1 then raise exception 'FAIL 6: self contact missing (found %)', n; end if;
    raise exception 'PASS 6';
  exception when others then
    if sqlerrm <> 'PASS 6' then raise; end if;
  end;

  -- 7. A house gets its single unit automatically.
  begin
    insert into properties (id, organization_id, branch_id, name, type) values (house, org, br, 'Maison test', 'house');
    select count(*) into n from units where property_id = house and code = 'MAISON' and type = 'house';
    if n <> 1 then raise exception 'FAIL 7: house unit missing (found %)', n; end if;
    raise exception 'PASS 7';
  exception when others then
    if sqlerrm <> 'PASS 7' then raise; end if;
  end;

  -- 8. Unit references stay unique inside a bien.
  begin
    insert into units (organization_id, property_id, code) values (org, prop, 'T-1');
    raise exception 'FAIL 8: duplicate unit code accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%units_property_id_code_key%' then raise exception 'FAIL 8: wrong error: %', sqlerrm; end if;
  end;

  -- 9. Owning a unit gives the contact the owner role.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u2, c2, 100, '2026-01-01');
    select count(*) into n from contact_roles where contact_id = c2 and role = 'owner';
    if n <> 1 then raise exception 'FAIL 9: owner role not added'; end if;
    raise exception 'PASS 9';
  exception when others then
    if sqlerrm <> 'PASS 9' then raise; end if;
  end;

  -- 10. record_gaps lists a unit without owner and a building whose shares do not total 1000.
  select count(*) into n from record_gaps where entity_id = u1 and gap_code = 'no_owner';
  if n <> 1 then raise exception 'FAIL 10: no_owner gap missing for T-1'; end if;
  select count(*) into n from record_gaps where entity_id = prop and gap_code = 'shares_total';
  if n <> 1 then raise exception 'FAIL 10: shares_total gap missing'; end if;
  update units set common_share = 500 where id in (u1, u2);
  select count(*) into n from record_gaps where entity_id = prop and gap_code = 'shares_total';
  if n <> 0 then raise exception 'FAIL 10: shares_total gap still present at 1000'; end if;

  -- 11. A file targets exactly one of bien/unit.
  begin
    insert into property_files (organization_id, property_id, unit_id, storage_file_id, kind, title)
    values (org, prop, u1, gen_random_uuid(), 'photo', 'x');
    raise exception 'FAIL 11: file with two targets accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%property_files_one_target%' then raise exception 'FAIL 11: wrong error: %', sqlerrm; end if;
  end;

  raise exception 'OK: all core-records tests passed';
end $$;
```

- [ ] **Step 2: Run it to verify it fails**

Ask the user to paste the file into the Nhost dashboard SQL editor and press Run.
Expected: an error like `relation "ownerships" does not exist` (the migration is not applied yet).

- [ ] **Step 3: Write the migration**

Create `db/migrations/0002_core_records.sql`:

```sql
-- 0002_core_records: ownership on units (effective-dated, shares), photos and documents,
-- common areas and thousandths, the organization's own contact, record gaps.
-- Apply after 0001, then run db/tests/0002_core_records.test.sql.
-- Ownership attaches to units only; a bien's owners are derived from its units.

create extension if not exists btree_gist;

-- Contacts: archiving, and one contact standing for the organization itself (glossary N-03).
alter table public.contacts
  add column archived_at     timestamptz,
  add column is_organization boolean not null default false;
create unique index contacts_one_self_per_org on public.contacts (organization_id) where is_organization;

-- Units: automatic unit of a house or plot, and the common-area share in thousandths.
-- units_property_id_code_key (unique code per bien among active units) already exists since 0001.
alter table public.units drop constraint units_type_check;
alter table public.units add constraint units_type_check
  check (type in ('apartment', 'office', 'shop', 'parking', 'house', 'land'));
alter table public.units add column common_share integer check (common_share between 0 and 1000);

-- Ownership: who holds which share of a unit between two dates (both inclusive).
create table public.ownerships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  unit_id         uuid not null,
  contact_id      uuid not null,
  share_percent   numeric(5, 2) not null check (share_percent > 0 and share_percent <= 100),
  starts_on       date not null,
  ends_on         date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ownerships_dates_check check (ends_on is null or ends_on >= starts_on),
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict,
  constraint ownerships_no_overlap exclude using gist (
    unit_id with =,
    contact_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
);
create index ownerships_organization_id_idx on public.ownerships (organization_id);
create index ownerships_unit_id_idx on public.ownerships (unit_id);
create index ownerships_contact_id_idx on public.ownerships (contact_id);

-- The total share of one unit may not exceed 100 % on any day. Checked at commit
-- (deferred) so a transfer that ends one owner and starts another in one request passes.
-- The highest total is always reached on some row's start date, so only those days are checked.
create or replace function public.check_ownership_shares()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unit uuid := coalesce(new.unit_id, old.unit_id);
  v_day  date;
begin
  select d.day into v_day
  from (select distinct starts_on as day from public.ownerships where unit_id = v_unit) d
  join public.ownerships o
    on o.unit_id = v_unit and o.starts_on <= d.day and (o.ends_on is null or o.ends_on >= d.day)
  group by d.day
  having sum(o.share_percent) > 100
  order by d.day
  limit 1;

  if v_day is not null then
    raise exception 'ownership_shares_exceeded:%', to_char(v_day, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger ownerships_shares_cap
  after insert or update on public.ownerships
  deferrable initially deferred
  for each row execute function public.check_ownership_shares();

-- Owning a unit makes the contact an owner.
create or replace function public.ensure_owner_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.contact_roles (organization_id, contact_id, role)
  values (new.organization_id, new.contact_id, 'owner')
  on conflict (contact_id, role) do nothing;
  return null;
end;
$$;

create trigger ownerships_ensure_owner_role
  after insert on public.ownerships
  for each row execute function public.ensure_owner_role();

-- Photos and documents of a bien or of a unit (exactly one of the two).
create table public.property_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id     uuid,
  unit_id         uuid,
  storage_file_id uuid not null unique references storage.files (id) on delete cascade,
  kind            text not null check (kind in ('photo', 'document')),
  category        text check (category in ('title_deed', 'plan', 'certificate', 'contract', 'other')),
  title           text not null check (length(trim(title)) > 0),
  is_cover        boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint property_files_one_target check (num_nonnulls(property_id, unit_id) = 1),
  constraint property_files_category_check check (
    (kind = 'photo' and category is null) or (kind = 'document' and category is not null)
  ),
  constraint property_files_cover_is_photo check (not is_cover or kind = 'photo'),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete restrict,
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index property_files_organization_id_idx on public.property_files (organization_id);
create index property_files_property_id_idx on public.property_files (property_id) where property_id is not null;
create index property_files_unit_id_idx on public.property_files (unit_id) where unit_id is not null;
create unique index property_files_one_cover_per_property on public.property_files (property_id) where is_cover and property_id is not null;
create unique index property_files_one_cover_per_unit on public.property_files (unit_id) where is_cover and unit_id is not null;

-- Shared parts of a building (syndic).
create table public.common_areas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id     uuid not null,
  name            text not null check (length(trim(name)) > 0),
  kind            text not null default 'other' check (kind in ('stairs', 'lift', 'garden', 'roof', 'parking', 'other')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete restrict
);
create index common_areas_organization_id_idx on public.common_areas (organization_id);
create index common_areas_property_id_idx on public.common_areas (property_id);

-- A house or a plot gets its single unit automatically (units-only ownership model).
create or replace function public.create_single_unit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.type in ('house', 'plot') then
    insert into public.units (organization_id, property_id, code, type, status)
    values (
      new.organization_id,
      new.id,
      case new.type when 'house' then 'MAISON' else 'TERRAIN' end,
      case new.type when 'house' then 'house' else 'land' end,
      'vacant'
    );
  end if;
  return null;
end;
$$;

create trigger properties_create_single_unit
  after insert on public.properties
  for each row execute function public.create_single_unit();

-- Every organization has one contact standing for itself, so it can own its own stock.
create or replace function public.create_self_contact()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_contact uuid;
begin
  insert into public.contacts (organization_id, kind, full_name, is_organization)
  values (new.id, 'company', new.name, true)
  returning id into v_contact;
  insert into public.contact_roles (organization_id, contact_id, role) values (new.id, v_contact, 'owner');
  return null;
end;
$$;

create trigger organizations_create_self_contact
  after insert on public.organizations
  for each row execute function public.create_self_contact();

-- Back-fill the self contact of existing organizations.
with created as (
  insert into public.contacts (organization_id, kind, full_name, is_organization)
  select o.id, 'company', o.name, true
  from public.organizations o
  where not exists (select 1 from public.contacts c where c.organization_id = o.id and c.is_organization)
  returning id, organization_id
)
insert into public.contact_roles (organization_id, contact_id, role)
select organization_id, id, 'owner' from created;

create trigger ownerships_set_updated_at     before update on public.ownerships     for each row execute function public.set_updated_at();
create trigger property_files_set_updated_at before update on public.property_files for each row execute function public.set_updated_at();
create trigger common_areas_set_updated_at   before update on public.common_areas   for each row execute function public.set_updated_at();

-- Who owns each unit today.
create view public.current_ownerships as
select o.*
from public.ownerships o
where o.starts_on <= current_date
  and (o.ends_on is null or o.ends_on >= current_date);

-- Per bien: each current owner and how many active units they hold.
create view public.property_owners as
select u.organization_id, u.property_id, co.contact_id, count(*)::integer as units_count
from public.current_ownerships co
join public.units u on u.id = co.unit_id and u.archived_at is null
group by u.organization_id, u.property_id, co.contact_id;

-- One row per missing piece of information, for the "Fiches incomplètes" page.
create view public.record_gaps as
with active_units as (
  select u.*, p.name as property_name
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.archived_at is null and p.archived_at is null
)
select au.organization_id, 'unit'::text as entity_type, au.id as entity_id, au.property_id,
       au.code as entity_label, au.property_name as property_label, 'no_owner'::text as gap_code
from active_units au
where not exists (select 1 from public.current_ownerships co where co.unit_id = au.id)
union all
select au.organization_id, 'unit', au.id, au.property_id, au.code, au.property_name, 'no_surface'
from active_units au
where au.surface_m2 is null
union all
select au.organization_id, 'unit', au.id, au.property_id, au.code, au.property_name, 'no_rent'
from active_units au
where au.rent_amount is null and au.status in ('vacant', 'rented')
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'no_address'
from public.properties p
where p.archived_at is null and (nullif(trim(p.address_line), '') is null or nullif(trim(p.city), '') is null)
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'no_position'
from public.properties p
where p.archived_at is null and (p.latitude is null or p.longitude is null)
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'shares_total'
from public.properties p
join public.units u on u.property_id = p.id and u.archived_at is null
where p.archived_at is null and p.type = 'building'
group by p.organization_id, p.id, p.name
having count(*) >= 2 and coalesce(sum(u.common_share), 0) <> 1000
union all
select c.organization_id, 'contact', c.id, null::uuid, c.full_name, null::text, 'no_contact_info'
from public.contacts c
where c.archived_at is null and not c.is_organization
  and nullif(trim(c.email), '') is null and nullif(trim(c.phone), '') is null;

-- Private bucket for photos and documents (10 MB per file, presigned downloads).
insert into storage.buckets (id, max_upload_file_size, min_upload_file_size, presigned_urls_enabled, download_expiration, cache_control)
values ('property-files', 10485760, 1, true, 300, 'max-age=3600')
on conflict (id) do nothing;
```

- [ ] **Step 4: Write the demo seed**

Create `db/seeds/0002_demo_core_records.sql`:

```sql
-- Demo data for 0002 (apply after db/seeds/0001_demo_data.sql and the 0002 migration).
-- Story: Sté Foncière Carthage owns the Résidence; B-101 sold to Hédi Ben Salem on 15/03/2026.
insert into public.ownerships (id, organization_id, unit_id, contact_id, share_percent, starts_on, ends_on) values
  ('61111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '41111111-1111-4111-8111-111111111111', '52222222-2222-4222-8222-222222222222', 100, '2026-01-01', '2026-03-14'),
  ('62222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '41111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111', 100, '2026-03-15', null),
  ('63333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '42222222-2222-4222-8222-222222222222', '52222222-2222-4222-8222-222222222222', 100, '2026-01-01', null),
  ('64444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '43333333-3333-4333-8333-333333333333', '52222222-2222-4222-8222-222222222222', 100, '2026-01-01', null),
  ('65555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '52222222-2222-4222-8222-222222222222', 100, '2026-01-01', null),
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', '45555555-5555-4555-8555-555555555555', '53333333-3333-4333-8333-333333333333', 100, '2025-06-01', null)
on conflict (id) do nothing;

-- Thousandths of the Résidence, from surfaces (92 / 110 / 118 / 96.5 m²), total 1000.
update public.units set common_share = 221 where id = '41111111-1111-4111-8111-111111111111';
update public.units set common_share = 264 where id = '42222222-2222-4222-8222-222222222222';
update public.units set common_share = 283 where id = '43333333-3333-4333-8333-333333333333';
update public.units set common_share = 232 where id = '44444444-4444-4444-8444-444444444444';

insert into public.common_areas (id, organization_id, property_id, name, kind) values
  ('71111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'Escaliers bloc B', 'stairs'),
  ('72222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'Ascenseur', 'lift'),
  ('73333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'Jardin intérieur', 'garden')
on conflict (id) do nothing;
```

- [ ] **Step 5: Review the SQL**

Run the `database-reviewer` agent with this brief: "Review db/migrations/0002_core_records.sql, db/seeds/0002_demo_core_records.sql and db/tests/0002_core_records.test.sql against docs/superpowers/specs/2026-10-14-core-records-design.md §3. Check multi-tenant composite FKs, the deferred share-cap trigger, the exclusion constraint, view correctness, indexes on FKs, and that nothing lets one organization reference another's rows." Fix every CRITICAL/HIGH finding in the files before continuing.

- [ ] **Step 6: Apply and run the tests**

Ask the user to run, in the Nhost dashboard SQL editor, in this order (leave "Track this" off — Task 2 tracks tables and views):
1. `db/migrations/0002_core_records.sql` → expected: success.
2. `db/tests/0002_core_records.test.sql` → expected: an error dialog reading `OK: all core-records tests passed`.
3. `db/seeds/0002_demo_core_records.sql` → expected: success.

If step 2 shows `FAIL n: …`, fix the migration (as a new `0003_…` migration if 0002 is already applied) and re-run.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/0002_core_records.sql db/seeds/0002_demo_core_records.sql db/tests/0002_core_records.test.sql
git commit -m "feat(db): ownership on units, files, common areas, record gaps"
```

---

### Task 2: Hasura tracking, relationships and permissions

**Files:**
- Modify: `scripts/apply-hasura-permissions.mjs` (full replacement below)

**Interfaces:**
- Consumes: Task 1 tables and views.
- Produces GraphQL names used by every UI task:
  - root fields `ownerships`, `insert_ownerships`, `insert_ownerships_one`, `update_ownerships`, `delete_ownerships_by_pk`, `current_ownerships`, `property_owners`, `record_gaps`, `record_gaps_aggregate`, `property_files`, `insert_property_files_one`, `update_property_files`, `update_property_files_by_pk`, `delete_property_files_by_pk`, `common_areas`, `insert_common_areas_one`, `update_common_areas_by_pk`, `delete_common_areas_by_pk`, `update_units_many`, `update_contacts_by_pk`, `delete_contact_roles`;
  - relationships `units.ownerships`, `units.current_owners`, `units.files`, `ownerships.unit`, `ownerships.contact`, `contacts.ownerships`, `contacts.current_ownerships`, `current_ownerships.contact`, `current_ownerships.unit`, `properties.owners`, `property_owners.contact`, `properties.files`, `properties.common_areas`, `storage.files.property_links`.

- [ ] **Step 1: Replace the script**

Write `scripts/apply-hasura-permissions.mjs`:

```js
// Applies table tracking, relationships and role permissions for the ERP tables through the
// Hasura Metadata API. Additive and idempotent: it drops then re-creates only the entries listed
// here, and never replaces the rest of the metadata (Nhost auth/storage stay untouched).
//
// Usage (PowerShell):
//   $env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
//   node scripts/apply-hasura-permissions.mjs
//
// Optional env: HASURA_URL (default: this project's Hasura endpoint).

const HASURA_URL =
  process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const ORG_VAR = 'X-Hasura-Org-Id';
const USER_VAR = 'X-Hasura-User-Id';
const orgFilter = (column) => ({ [column]: { _eq: ORG_VAR } });
const source = 'default';
const table = (name) => ({ schema: 'public', name });
const storageFiles = { schema: 'storage', name: 'files' };
const BUCKET = 'property-files';

// Roles: org_admin (everything inside the organization), manager (day-to-day work), viewer (read only).
const ROLES = ['org_admin', 'manager', 'viewer'];
const WRITERS = ['org_admin', 'manager'];

// Tables and views created after 0001 that Hasura must track (0001 tables were tracked in the dashboard).
const TRACK = ['ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps'];

const OWNERSHIP_COLUMNS = [
  'id', 'organization_id', 'unit_id', 'contact_id', 'share_percent', 'starts_on', 'ends_on', 'notes',
  'created_at', 'updated_at',
];

const SELECT_COLUMNS = {
  organizations: ['id', 'name', 'created_at', 'updated_at'],
  branches: ['id', 'organization_id', 'name', 'city', 'created_at', 'updated_at'],
  properties: [
    'id', 'organization_id', 'branch_id', 'name', 'type', 'address_line', 'city', 'governorate',
    'postal_code', 'latitude', 'longitude', 'archived_at', 'created_at', 'updated_at',
  ],
  units: [
    'id', 'organization_id', 'property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2',
    'rent_amount', 'status', 'common_share', 'archived_at', 'created_at', 'updated_at',
  ],
  contacts: [
    'id', 'organization_id', 'kind', 'full_name', 'email', 'phone', 'national_id', 'address',
    'notes', 'is_organization', 'archived_at', 'created_at', 'updated_at',
  ],
  contact_roles: ['organization_id', 'contact_id', 'role', 'created_at'],
  ownerships: OWNERSHIP_COLUMNS,
  current_ownerships: OWNERSHIP_COLUMNS,
  property_owners: ['organization_id', 'property_id', 'contact_id', 'units_count'],
  record_gaps: ['organization_id', 'entity_type', 'entity_id', 'property_id', 'entity_label', 'property_label', 'gap_code'],
  property_files: [
    'id', 'organization_id', 'property_id', 'unit_id', 'storage_file_id', 'kind', 'category', 'title',
    'is_cover', 'sort_order', 'created_at', 'updated_at',
  ],
  common_areas: ['id', 'organization_id', 'property_id', 'name', 'kind', 'notes', 'created_at', 'updated_at'],
};

// organization_id is never writable by clients: insert sets it from the JWT (preset), update excludes it.
// contacts.is_organization is never writable: only the database creates the self contact.
// properties.type is not updatable: changing it would leave a house's automatic unit wrong.
const WRITE_COLUMNS = {
  branches: { roles: ['org_admin'], insert: ['name', 'city'], update: ['name', 'city'] },
  properties: {
    roles: WRITERS,
    insert: ['branch_id', 'name', 'type', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude'],
    update: ['branch_id', 'name', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude', 'archived_at'],
  },
  units: {
    roles: WRITERS,
    insert: ['property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share'],
    update: ['code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share', 'archived_at'],
  },
  contacts: {
    roles: WRITERS,
    insert: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes'],
    update: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes', 'archived_at'],
  },
  contact_roles: { roles: WRITERS, insert: ['contact_id', 'role'], update: null, canDelete: true },
  ownerships: {
    roles: WRITERS,
    insert: ['unit_id', 'contact_id', 'share_percent', 'starts_on', 'ends_on', 'notes'],
    update: ['share_percent', 'starts_on', 'ends_on', 'notes'],
    canDelete: true,
  },
  property_files: {
    roles: WRITERS,
    insert: ['property_id', 'unit_id', 'storage_file_id', 'kind', 'category', 'title', 'is_cover', 'sort_order'],
    update: ['category', 'title', 'is_cover', 'sort_order'],
    canDelete: true,
  },
  common_areas: {
    roles: WRITERS,
    insert: ['property_id', 'name', 'kind', 'notes'],
    update: ['name', 'kind', 'notes'],
    canDelete: true,
  },
};

const tableOrgColumn = (name) => (name === 'organizations' ? 'id' : 'organization_id');

// Relationships (manual configuration because the foreign keys are composite, and views have none).
const RELATIONSHIPS = [
  { type: 'object', table: 'branches', name: 'organization', to: 'organizations', map: { organization_id: 'id' } },
  { type: 'array', table: 'organizations', name: 'branches', to: 'branches', map: { id: 'organization_id' } },
  { type: 'array', table: 'organizations', name: 'contacts', to: 'contacts', map: { id: 'organization_id' } },
  { type: 'object', table: 'properties', name: 'branch', to: 'branches', map: { branch_id: 'id' } },
  { type: 'array', table: 'branches', name: 'properties', to: 'properties', map: { id: 'branch_id' } },
  { type: 'object', table: 'units', name: 'property', to: 'properties', map: { property_id: 'id' } },
  { type: 'array', table: 'properties', name: 'units', to: 'units', map: { id: 'property_id' } },
  { type: 'object', table: 'contact_roles', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'contacts', name: 'roles', to: 'contact_roles', map: { id: 'contact_id' } },
  { type: 'array', table: 'units', name: 'ownerships', to: 'ownerships', map: { id: 'unit_id' } },
  { type: 'object', table: 'ownerships', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'ownerships', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'contacts', name: 'ownerships', to: 'ownerships', map: { id: 'contact_id' } },
  { type: 'array', table: 'units', name: 'current_owners', to: 'current_ownerships', map: { id: 'unit_id' } },
  { type: 'array', table: 'contacts', name: 'current_ownerships', to: 'current_ownerships', map: { id: 'contact_id' } },
  { type: 'object', table: 'current_ownerships', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'object', table: 'current_ownerships', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'properties', name: 'owners', to: 'property_owners', map: { id: 'property_id' } },
  { type: 'object', table: 'property_owners', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'properties', name: 'files', to: 'property_files', map: { id: 'property_id' } },
  { type: 'array', table: 'units', name: 'files', to: 'property_files', map: { id: 'unit_id' } },
  { type: 'array', table: 'properties', name: 'common_areas', to: 'common_areas', map: { id: 'property_id' } },
];

const tracks = TRACK.map((name) => ({ type: 'pg_track_table', args: { source, table: table(name) } }));
const drops = [];
const creates = [];

for (const r of RELATIONSHIPS) {
  drops.push({ type: 'pg_drop_relationship', args: { source, table: table(r.table), relationship: r.name } });
  creates.push({
    type: `pg_create_${r.type}_relationship`,
    args: {
      source,
      table: table(r.table),
      name: r.name,
      using: { manual_configuration: { remote_table: table(r.to), column_mapping: r.map } },
    },
  });
}

const permissionTypes = ['select', 'insert', 'update', 'delete'];
for (const name of Object.keys(SELECT_COLUMNS)) {
  for (const role of ROLES) {
    for (const t of permissionTypes) {
      drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: table(name), role } });
    }
  }
}

for (const [name, columns] of Object.entries(SELECT_COLUMNS)) {
  const orgColumn = tableOrgColumn(name);
  for (const role of ROLES) {
    creates.push({
      type: 'pg_create_select_permission',
      args: {
        source, table: table(name), role,
        permission: { columns, filter: orgFilter(orgColumn), allow_aggregations: true },
      },
    });
  }
}

for (const [name, w] of Object.entries(WRITE_COLUMNS)) {
  for (const role of w.roles) {
    creates.push({
      type: 'pg_create_insert_permission',
      args: {
        source, table: table(name), role,
        permission: {
          columns: w.insert,
          check: orgFilter('organization_id'),
          set: { organization_id: ORG_VAR.toLowerCase() },
        },
      },
    });
    if (w.update) {
      creates.push({
        type: 'pg_create_update_permission',
        args: {
          source, table: table(name), role,
          permission: { columns: w.update, filter: orgFilter('organization_id'), check: orgFilter('organization_id') },
        },
      });
    }
    if (w.canDelete) {
      creates.push({
        type: 'pg_create_delete_permission',
        args: { source, table: table(name), role, permission: { filter: orgFilter('organization_id') } },
      });
    }
  }
}

// The organization itself: only an org_admin may rename it. No insert/delete from clients.
creates.push({
  type: 'pg_create_update_permission',
  args: {
    source, table: table('organizations'), role: 'org_admin',
    permission: { columns: ['name'], filter: orgFilter('id'), check: orgFilter('id') },
  },
});

// Storage: our roles may upload into the property-files bucket, and read/delete a file only when it
// is linked to their organization through property_files (or right after uploading it themselves,
// before the link row exists). Nhost's own storage permissions for other roles are left untouched.
const FILE_COLUMNS = [
  'id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'uploaded_by_user_id',
  'metadata', 'created_at', 'updated_at',
];
const linkedToOrg = { property_links: { organization_id: { _eq: ORG_VAR } } };
const ownUpload = { _and: [{ bucket_id: { _eq: BUCKET } }, { uploaded_by_user_id: { _eq: USER_VAR } }] };

drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'property_links' } });
for (const role of ROLES) {
  for (const t of permissionTypes) {
    drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: storageFiles, role } });
  }
}
creates.push({
  type: 'pg_create_array_relationship',
  args: {
    source,
    table: storageFiles,
    name: 'property_links',
    using: { manual_configuration: { remote_table: table('property_files'), column_mapping: { id: 'storage_file_id' } } },
  },
});
creates.push({
  type: 'pg_create_select_permission',
  args: { source, table: storageFiles, role: 'viewer', permission: { columns: FILE_COLUMNS, filter: linkedToOrg } },
});
for (const role of WRITERS) {
  creates.push({
    type: 'pg_create_select_permission',
    args: { source, table: storageFiles, role, permission: { columns: FILE_COLUMNS, filter: { _or: [linkedToOrg, ownUpload] } } },
  });
  creates.push({
    type: 'pg_create_insert_permission',
    args: {
      source, table: storageFiles, role,
      permission: {
        columns: ['id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata'],
        check: { bucket_id: { _eq: BUCKET } },
        set: { uploaded_by_user_id: USER_VAR.toLowerCase() },
      },
    },
  });
  creates.push({
    type: 'pg_create_update_permission',
    args: {
      source, table: storageFiles, role,
      permission: { columns: ['name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata'], filter: ownUpload, check: ownUpload },
    },
  });
  creates.push({
    type: 'pg_create_delete_permission',
    args: { source, table: storageFiles, role, permission: { filter: { _or: [linkedToOrg, ownUpload] } } },
  });
}

async function metadata(body) {
  const res = await fetch(`${HASURA_URL}/v1/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Step 0: track new tables and views ("already tracked" errors are expected on later runs).
await metadata({ type: 'bulk_keep_going', args: tracks });

// Step 1: drop previous versions (errors for "does not exist" are expected on the first run).
await metadata({ type: 'bulk_keep_going', args: drops });

// Step 2: create everything atomically; any error rolls the whole step back.
const result = await metadata({ type: 'bulk', args: creates });
if (!result.ok) {
  console.error('Failed:', result.status, JSON.stringify(result.json, null, 2));
  process.exit(1);
}
const relationshipCount = RELATIONSHIPS.length + 1;
console.log(`Applied ${relationshipCount} relationships and ${creates.length - relationshipCount} permissions.`);
```

- [ ] **Step 2: Syntax check**

Run: `node --check scripts/apply-hasura-permissions.mjs`
Expected: no output, exit code 0.

- [ ] **Step 3: User applies it**

Ask the user to run, in their own PowerShell (never type the secret yourself):

```powershell
$env:HASURA_ADMIN_SECRET = "<secret>"
node scripts/apply-hasura-permissions.mjs
```

Expected: `Applied 23 relationships and N permissions.` If it fails, read the printed Hasura error (never ask for the secret) and fix the script.

- [ ] **Step 4: Verify as a manager**

Ask the user to open the Nhost dashboard GraphQL tab, add headers `x-hasura-role: manager` and `x-hasura-org-id: 11111111-1111-4111-8111-111111111111`, and run:

```graphql
query { current_ownerships { unit { code } contact { full_name } share_percent } record_gaps_aggregate { aggregate { count } } }
```

Expected: 6 ownership rows from the demo seed (B-101 → Hédi Ben Salem; B-102, B-203, A-204 → Sté Foncière Carthage; C-12 → Mehdi Trabelsi) and a gap count. Then change `x-hasura-org-id` to `a0000000-0000-4000-8000-000000000099` and re-run. Expected: no rows, count 0 (organization isolation).

- [ ] **Step 5: Commit**

```bash
git add scripts/apply-hasura-permissions.mjs
git commit -m "feat(hasura): track core-records tables, relationships and storage rules"
```

---

### Task 3: Test tooling, French error mapper, writer check

**Files:**
- Modify: `web/package.json` (scripts + dev dependencies via npm)
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/lib/errors.ts`, `web/src/lib/errors.test.ts`
- Create: `web/src/lib/use-can-edit.ts`

**Interfaces:**
- Produces:
  - `toFrenchError(error: unknown, context?: { unitCode?: string }): string`
  - `useCanEdit(): boolean` — true for `org_admin` and `manager`.
  - `npm test`, `npm run test:coverage`.

- [ ] **Step 1: Install test tools**

Run (in `web/`):

```bash
npm install -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event
```

Then add to `web/package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 2: Configure Vitest**

Create `web/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/errors.ts',
        'src/lib/ownership.ts',
        'src/lib/shares.ts',
        'src/lib/occupancy.ts',
        'src/lib/contact-duplicates.ts',
        'src/lib/files.ts',
        'src/lib/upload.ts',
        'src/lib/geocode.ts',
        'src/lib/gaps.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

Create `web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing test**

Create `web/src/lib/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toFrenchError } from './errors';

describe('toFrenchError', () => {
  it('explains a share total above 100 % with the date', () => {
    const error = new Error('Check constraint violation. ownership_shares_exceeded:15/03/2026');
    expect(toFrenchError(error)).toBe('Le total des parts dépasse 100 % à partir du 15/03/2026.');
  });

  it('explains an overlapping period for the same owner', () => {
    const error = new Error('conflicting key value violates exclusion constraint "ownerships_no_overlap"');
    expect(toFrenchError(error)).toBe('Ce propriétaire détient déjà cette unité sur cette période.');
  });

  it('explains an end date before the start date', () => {
    const error = new Error('new row violates check constraint "ownerships_dates_check"');
    expect(toFrenchError(error)).toBe('La date de fin doit suivre la date de début.');
  });

  it('names the duplicate unit reference when known', () => {
    const error = new Error('duplicate key value violates unique constraint "units_property_id_code_key"');
    expect(toFrenchError(error, { unitCode: 'B-101' })).toBe('La référence B-101 existe déjà dans ce bien.');
    expect(toFrenchError(error)).toBe('Cette référence existe déjà dans ce bien.');
  });

  it('explains a network failure', () => {
    expect(toFrenchError(new TypeError('Failed to fetch'))).toBe(
      'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    );
  });

  it('explains a permission refusal', () => {
    const error = new Error('check constraint of an insert permission has failed');
    expect(toFrenchError(error)).toBe('Vous n’avez pas les droits pour cette action.');
  });

  it('keeps an unknown message and handles non-errors', () => {
    expect(toFrenchError(new Error('Something odd'))).toBe('Something odd');
    expect(toFrenchError(new Error(''))).toBe('Erreur inconnue.');
    expect(toFrenchError('nope')).toBe('Erreur inconnue.');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/lib/errors.test.ts`
Expected: FAIL — `Failed to resolve import "./errors"`.

- [ ] **Step 5: Implement**

Create `web/src/lib/errors.ts`:

```ts
// Turns database and Hasura error messages into the French sentences staff see.
// One place, so every page words the same failure the same way.

type ErrorContext = { unitCode?: string };

const NETWORK = /failed to fetch|networkerror|network request failed|load failed/i;
const PERMISSION = /permission|not found in type|access-denied/i;

export function toFrenchError(error: unknown, context: ErrorContext = {}): string {
  if (!(error instanceof Error)) return 'Erreur inconnue.';
  const message = error.message;

  const shares = /ownership_shares_exceeded:(\d{2}\/\d{2}\/\d{4})/.exec(message);
  if (shares) return `Le total des parts dépasse 100 % à partir du ${shares[1]}.`;
  if (message.includes('ownerships_no_overlap')) return 'Ce propriétaire détient déjà cette unité sur cette période.';
  if (message.includes('ownerships_dates_check')) return 'La date de fin doit suivre la date de début.';
  if (message.includes('units_property_id_code_key')) {
    return context.unitCode
      ? `La référence ${context.unitCode} existe déjà dans ce bien.`
      : 'Cette référence existe déjà dans ce bien.';
  }
  if (NETWORK.test(message)) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (PERMISSION.test(message)) return 'Vous n’avez pas les droits pour cette action.';
  return message || 'Erreur inconnue.';
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/lib/errors.test.ts`
Expected: 7 passed.

- [ ] **Step 7: Add the writer check**

Create `web/src/lib/use-can-edit.ts`:

```ts
'use client';

import { useAuth } from '@/components/auth-provider';

const WRITER_ROLES = new Set(['org_admin', 'manager']);

/** True when the signed-in user's role may create and change records (viewers read only). */
export function useCanEdit(): boolean {
  const { session } = useAuth();
  return WRITER_ROLES.has(session?.user?.defaultRole ?? '');
}
```

- [ ] **Step 8: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/test/setup.ts web/src/lib/errors.ts web/src/lib/errors.test.ts web/src/lib/use-can-edit.ts
git commit -m "test: add Vitest; feat: French error mapper and writer check"
```

---

### Task 4: Ownership, shares and occupancy logic

**Files:**
- Create: `web/src/lib/ownership.ts`, `web/src/lib/ownership.test.ts`
- Create: `web/src/lib/shares.ts`, `web/src/lib/shares.test.ts`
- Create: `web/src/lib/occupancy.ts`, `web/src/lib/occupancy.test.ts`

**Interfaces:**
- Produces:
  - `type OwnershipRow = { id: string; unit_id: string; contact_id: string; share_percent: number | string; starts_on: string; ends_on: string | null }`
  - `type NewOwner = { contactId: string | null; sharePercent: number }`
  - `todayIso(now?: Date): string`, `dayBefore(iso: string): string`, `formatDateFr(iso: string): string`, `formatPercent(value: number | string): string` (e.g. `"33,33 %"`)
  - `isCurrent(row: { starts_on: string; ends_on: string | null }, today?: string): boolean`
  - `ownershipPhase(row, today?): 'past' | 'current' | 'upcoming'`
  - `validateNewOwners(owners: NewOwner[]): string | null`
  - `type TransferPlan = { endIds: string[]; endOn: string; objects: { unit_id: string; contact_id: string; share_percent: number; starts_on: string }[] }`
  - `planTransfer(unitIds: string[], rows: OwnershipRow[], date: string, owners: NewOwner[]): TransferPlan | { error: string }`
  - `SHARE_TOTAL = 1000`, `suggestShares(units: { id: string; surface: number | string | null }[]): Record<string, number>`, `sharesTotal(values: (number | null | undefined)[]): number`
  - `type OccupancyLevel = 'none' | 'empty' | 'partial' | 'full'`, `occupancyLevel(statuses: string[]): OccupancyLevel`, `OCCUPANCY: Record<OccupancyLevel, { label: string; color: string }>`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/ownership.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  dayBefore,
  formatDateFr,
  formatPercent,
  isCurrent,
  ownershipPhase,
  planTransfer,
  todayIso,
  validateNewOwners,
  type OwnershipRow,
} from './ownership';

const row = (over: Partial<OwnershipRow>): OwnershipRow => ({
  id: 'o1',
  unit_id: 'u1',
  contact_id: 'c1',
  share_percent: 100,
  starts_on: '2026-01-01',
  ends_on: null,
  ...over,
});

describe('dates', () => {
  it('formats today in local time as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
  it('gives the day before, across months and years', () => {
    expect(dayBefore('2026-03-15')).toBe('2026-03-14');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });
  it('formats dates the French way', () => {
    expect(formatDateFr('2026-03-15')).toBe('15/03/2026');
  });
  it('formats percents with a comma', () => {
    expect(formatPercent(33.333)).toBe('33,33 %');
    expect(formatPercent('100.00')).toBe('100 %');
  });
});

describe('isCurrent / ownershipPhase', () => {
  it('treats both ends as inclusive', () => {
    expect(isCurrent(row({ starts_on: '2026-03-15' }), '2026-03-15')).toBe(true);
    expect(isCurrent(row({ ends_on: '2026-03-14' }), '2026-03-14')).toBe(true);
    expect(isCurrent(row({ ends_on: '2026-03-14' }), '2026-03-15')).toBe(false);
  });
  it('classifies past, current and upcoming rows', () => {
    expect(ownershipPhase(row({ ends_on: '2026-01-31' }), '2026-02-01')).toBe('past');
    expect(ownershipPhase(row({}), '2026-02-01')).toBe('current');
    expect(ownershipPhase(row({ starts_on: '2026-05-01' }), '2026-02-01')).toBe('upcoming');
  });
});

describe('validateNewOwners', () => {
  it('accepts co-owners totalling 100 %', () => {
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 50 }, { contactId: 'b', sharePercent: 50 }])).toBeNull();
  });
  it('rejects empty, missing contact, duplicates, bad shares and wrong totals', () => {
    expect(validateNewOwners([])).toBe('Ajoutez au moins un propriétaire.');
    expect(validateNewOwners([{ contactId: null, sharePercent: 100 }])).toBe('Choisissez un contact pour chaque ligne.');
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 50 }, { contactId: 'a', sharePercent: 50 }])).toBe(
      'Un même contact apparaît deux fois.',
    );
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 0 }])).toBe('Chaque part doit être comprise entre 0 et 100 %.');
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 60 }])).toBe(
      'Le total des parts doit être 100 % (actuellement 60 %).',
    );
  });
});

describe('planTransfer', () => {
  it('ends current owners the day before and starts the new ones on the date', () => {
    const plan = planTransfer(['u1'], [row({ id: 'old' })], '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toEqual({
      endIds: ['old'],
      endOn: '2026-03-14',
      objects: [{ unit_id: 'u1', contact_id: 'c2', share_percent: 100, starts_on: '2026-03-15' }],
    });
  });
  it('ignores rows of other units and rows already ended before the date', () => {
    const rows = [row({ id: 'other', unit_id: 'u9' }), row({ id: 'ended', ends_on: '2026-02-01' })];
    const plan = planTransfer(['u1'], rows, '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toMatchObject({ endIds: [] });
  });
  it('creates rows for every selected unit (bulk "same owner for all units")', () => {
    const plan = planTransfer(['u1', 'u2'], [], '2026-01-01', [{ contactId: 'c1', sharePercent: 100 }]);
    expect('objects' in plan ? plan.objects : []).toHaveLength(2);
  });
  it('refuses a date on or before the start of a current holding', () => {
    const plan = planTransfer(['u1'], [row({ starts_on: '2026-03-15' })], '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toEqual({
      error: 'La date doit être postérieure au 15/03/2026, début de la détention actuelle.',
    });
  });
  it('returns the validation error when owners are invalid', () => {
    expect(planTransfer(['u1'], [], '2026-03-15', [])).toEqual({ error: 'Ajoutez au moins un propriétaire.' });
  });
});
```

Create `web/src/lib/shares.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sharesTotal, suggestShares } from './shares';

describe('suggestShares', () => {
  it('splits 1000 by surface with largest remainders (Résidence example)', () => {
    const result = suggestShares([
      { id: 'b101', surface: 92 },
      { id: 'b102', surface: '110.00' },
      { id: 'b203', surface: 118 },
      { id: 'a204', surface: 96.5 },
    ]);
    expect(result).toEqual({ b101: 221, b102: 264, b203: 283, a204: 232 });
    expect(sharesTotal(Object.values(result))).toBe(1000);
  });
  it('splits equally when no unit has a surface', () => {
    const result = suggestShares([{ id: 'a', surface: null }, { id: 'b', surface: null }, { id: 'c', surface: null }]);
    expect(sharesTotal(Object.values(result))).toBe(1000);
    expect(Object.values(result).sort()).toEqual([333, 333, 334]);
  });
  it('gives 0 to units without surface when others have one', () => {
    expect(suggestShares([{ id: 'a', surface: 50 }, { id: 'b', surface: null }])).toEqual({ a: 1000, b: 0 });
  });
  it('returns an empty object for no units', () => {
    expect(suggestShares([])).toEqual({});
  });
});

describe('sharesTotal', () => {
  it('ignores empty values', () => {
    expect(sharesTotal([500, null, undefined, 250])).toBe(750);
  });
});
```

Create `web/src/lib/occupancy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { occupancyLevel } from './occupancy';

describe('occupancyLevel', () => {
  it('classifies a bien by its units', () => {
    expect(occupancyLevel([])).toBe('none');
    expect(occupancyLevel(['vacant', 'for_sale'])).toBe('empty');
    expect(occupancyLevel(['rented', 'vacant'])).toBe('partial');
    expect(occupancyLevel(['rented', 'rented'])).toBe('full');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/ownership.test.ts src/lib/shares.test.ts src/lib/occupancy.test.ts`
Expected: FAIL — imports cannot be resolved.

- [ ] **Step 3: Implement**

Create `web/src/lib/ownership.ts`:

```ts
// Ownership rules the screens need before sending anything to the database.
// The database still enforces the 100 % cap; these checks give earlier, clearer messages.

export type OwnershipRow = {
  id: string;
  unit_id: string;
  contact_id: string;
  share_percent: number | string;
  starts_on: string;
  ends_on: string | null;
};

export type NewOwner = { contactId: string | null; sharePercent: number };

export type TransferPlan = {
  endIds: string[];
  endOn: string;
  objects: { unit_id: string; contact_id: string; share_percent: number; starts_on: string }[];
};

const pad = (n: number) => String(n).padStart(2, '0');

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dayBefore(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function formatDateFr(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatPercent(value: number | string): string {
  const rounded = Math.round(Number(value) * 100) / 100;
  return String(rounded).replace('.', ',') + ' %';
}

export function isCurrent(row: { starts_on: string; ends_on: string | null }, today: string = todayIso()): boolean {
  return row.starts_on <= today && (row.ends_on === null || row.ends_on >= today);
}

export function ownershipPhase(
  row: { starts_on: string; ends_on: string | null },
  today: string = todayIso(),
): 'past' | 'current' | 'upcoming' {
  if (row.starts_on > today) return 'upcoming';
  return isCurrent(row, today) ? 'current' : 'past';
}

export function validateNewOwners(owners: NewOwner[]): string | null {
  if (owners.length === 0) return 'Ajoutez au moins un propriétaire.';
  if (owners.some((owner) => !owner.contactId)) return 'Choisissez un contact pour chaque ligne.';
  const ids = owners.map((owner) => owner.contactId);
  if (new Set(ids).size !== ids.length) return 'Un même contact apparaît deux fois.';
  if (owners.some((owner) => !(owner.sharePercent > 0) || owner.sharePercent > 100)) {
    return 'Chaque part doit être comprise entre 0 et 100 %.';
  }
  const total = owners.reduce((sum, owner) => sum + owner.sharePercent, 0);
  if (Math.abs(total - 100) > 0.001) return `Le total des parts doit être 100 % (actuellement ${formatPercent(total)}).`;
  return null;
}

/** Ends every holding still running on `date` (day before) and starts `owners` on `date`, for each unit. */
export function planTransfer(
  unitIds: string[],
  rows: OwnershipRow[],
  date: string,
  owners: NewOwner[],
): TransferPlan | { error: string } {
  const invalid = validateNewOwners(owners);
  if (invalid) return { error: invalid };

  const running = rows.filter((row) => unitIds.includes(row.unit_id) && (row.ends_on === null || row.ends_on >= date));
  const blocking = running.find((row) => row.starts_on >= date);
  if (blocking) {
    return { error: `La date doit être postérieure au ${formatDateFr(blocking.starts_on)}, début de la détention actuelle.` };
  }

  return {
    endIds: running.map((row) => row.id),
    endOn: dayBefore(date),
    objects: unitIds.flatMap((unitId) =>
      owners.map((owner) => ({
        unit_id: unitId,
        contact_id: owner.contactId as string,
        share_percent: owner.sharePercent,
        starts_on: date,
      })),
    ),
  };
}
```

Create `web/src/lib/shares.ts`:

```ts
// Common-area shares in thousandths (tantièmes). The building total must be exactly 1000.

export const SHARE_TOTAL = 1000;

export type ShareInput = { id: string; surface: number | string | null };

/** Splits 1000 by surface with the largest-remainder method; equal split when no surface is known. */
export function suggestShares(units: ShareInput[]): Record<string, number> {
  if (units.length === 0) return {};
  const weights = units.map((unit) => {
    const surface = Number(unit.surface);
    return unit.surface !== null && Number.isFinite(surface) && surface > 0 ? surface : 0;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effective = weightSum > 0 ? weights : units.map(() => 1);
  const total = weightSum > 0 ? weightSum : units.length;

  const raw = effective.map((weight) => (weight / total) * SHARE_TOTAL);
  const shares = raw.map(Math.floor);
  let remaining = SHARE_TOTAL - shares.reduce((sum, share) => sum + share, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - shares[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    shares[index] += 1;
    remaining -= 1;
  }

  return Object.fromEntries(units.map((unit, index) => [unit.id, shares[index]]));
}

export function sharesTotal(values: (number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
```

Create `web/src/lib/occupancy.ts`:

```ts
export type OccupancyLevel = 'none' | 'empty' | 'partial' | 'full';

export const OCCUPANCY: Record<OccupancyLevel, { label: string; color: string }> = {
  full: { label: 'Entièrement loué', color: '#047857' },
  partial: { label: 'Partiellement loué', color: '#d97706' },
  empty: { label: 'Aucune unité louée', color: '#dc2626' },
  none: { label: 'Sans unité', color: '#6b7280' },
};

export function occupancyLevel(statuses: string[]): OccupancyLevel {
  if (statuses.length === 0) return 'none';
  const rented = statuses.filter((status) => status === 'rented').length;
  if (rented === 0) return 'empty';
  return rented === statuses.length ? 'full' : 'partial';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/ownership.test.ts src/lib/shares.test.ts src/lib/occupancy.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/ownership.ts web/src/lib/ownership.test.ts web/src/lib/shares.ts web/src/lib/shares.test.ts web/src/lib/occupancy.ts web/src/lib/occupancy.test.ts
git commit -m "feat: ownership transfer planning, thousandths suggestion, occupancy levels"
```

---

### Task 5: Hash-driven tabs, shared bien form, bien edit page

**Files:**
- Create: `web/src/lib/use-hash.ts`, `web/src/lib/use-hash.test.tsx`
- Create: `web/src/components/domain/property-form.tsx`
- Modify: `web/src/app/(app)/biens/nouveau/page.tsx` (full replacement)
- Create: `web/src/app/(app)/biens/[id]/modifier/page.tsx`
- Modify: `web/src/app/(app)/biens/[id]/page.tsx` (add "Modifier" button)
- Modify: `web/src/lib/navigation.ts:104` (crumb label)

**Interfaces:**
- Consumes: `toFrenchError` (Task 3), `useCanEdit` (Task 3), `GOVERNORATES`, `PROPERTY_TYPES` from `web/src/components/domain/labels.ts`.
- Produces:
  - `useHash(): [string, (value: string) => void]`, `useHashTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void]`
  - `type PropertyFormValues = { name: string; type: 'building' | 'house' | 'plot'; branch_id: string; address_line: string; city: string; governorate: string; postal_code: string; latitude: number | null; longitude: number | null }`
  - `PropertyForm(props: { mode: 'create' } | { mode: 'edit'; propertyId: string; initial: PropertyFormValues })`
  - route `/biens/[id]/modifier`

- [ ] **Step 1: Write the failing hook test**

Create `web/src/lib/use-hash.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHash, useHashTab } from './use-hash';

const TABS = ['apercu', 'proprietaires'] as const;

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useHash / useHashTab', () => {
  it('reads the current hash and falls back for unknown tabs', () => {
    window.history.replaceState(null, '', '/x#nope');
    const { result } = renderHook(() => useHashTab(TABS, 'apercu'));
    expect(result.current[0]).toBe('apercu');
  });

  it('switches tab and updates the URL without reloading', () => {
    const { result } = renderHook(() => useHashTab(TABS, 'apercu'));
    act(() => result.current[1]('proprietaires'));
    expect(result.current[0]).toBe('proprietaires');
    expect(window.location.hash).toBe('#proprietaires');
  });

  it('clears the hash with an empty value', () => {
    const { result } = renderHook(() => useHash());
    act(() => result.current[1]('modifier'));
    expect(result.current[0]).toBe('modifier');
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(window.location.hash).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/use-hash.test.tsx`
Expected: FAIL — cannot resolve `./use-hash`.

- [ ] **Step 3: Implement the hook**

Create `web/src/lib/use-hash.ts`:

```ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Tabs and dialogs follow the URL hash so other pages can link to the exact place to fix
// (for example /biens/<id>/unites/<unitId>#proprietaires). Reading it through
// useSyncExternalStore keeps server rendering (empty hash) and the browser in sync.

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const readHash = () => decodeURIComponent(window.location.hash.slice(1));
const serverHash = () => '';

export function useHash(): [string, (value: string) => void] {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const setHash = useCallback((value: string) => {
    const url = window.location.pathname + window.location.search + (value ? '#' + value : '');
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
  return [hash, setHash];
}

export function useHashTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [hash, setHash] = useHash();
  const current = (tabs as readonly string[]).includes(hash) ? (hash as T) : fallback;
  return [current, setHash];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/use-hash.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Create the shared bien form**

Create `web/src/components/domain/property-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { GOVERNORATES, PROPERTY_TYPES } from '@/components/domain/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';

const BRANCHES_QUERY = `query Branches { branches(order_by: { name: asc }) { id name city } }`;

const ADD_PROPERTY = `
  mutation AddProperty($object: properties_insert_input!) {
    insert_properties_one(object: $object) { id }
  }
`;

const UPDATE_PROPERTY = `
  mutation UpdateProperty($id: uuid!, $set: properties_set_input!) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const schema = z.object({
  name: z.string().trim().min(2, 'Saisissez le nom du bien (2 caractères minimum).'),
  type: z.enum(['building', 'house', 'plot']),
  branch_id: z.string().min(1, 'Choisissez la succursale responsable.'),
  address_line: z.string().trim(),
  city: z.string().trim(),
  governorate: z.string(),
  postal_code: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}$/.test(value), 'Code postal invalide : 4 chiffres attendus.'),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export type PropertyFormValues = z.infer<typeof schema>;

const EMPTY_PROPERTY: PropertyFormValues = {
  name: '',
  type: 'building',
  branch_id: '',
  address_line: '',
  city: '',
  governorate: '',
  postal_code: '',
  latitude: null,
  longitude: null,
};

const orNull = (value: string) => (value === '' ? null : value);

type Props = { mode: 'create' } | { mode: 'edit'; propertyId: string; initial: PropertyFormValues };

export function PropertyForm(props: Props) {
  const router = useRouter();
  const editing = props.mode === 'edit';
  const cancelHref = props.mode === 'edit' ? '/biens/' + props.propertyId : '/biens';
  const branches = useGraphql<{ branches: { id: string; name: string; city: string | null }[] }>(BRANCHES_QUERY);
  const { control, register, handleSubmit, formState, watch } = useForm<PropertyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.initial : EMPTY_PROPERTY,
  });
  const { errors, isSubmitting } = formState;
  const type = watch('type');

  async function onSubmit(values: PropertyFormValues) {
    const fields = {
      name: values.name,
      branch_id: values.branch_id,
      address_line: orNull(values.address_line),
      city: orNull(values.city),
      governorate: orNull(values.governorate),
      postal_code: orNull(values.postal_code),
      latitude: values.latitude,
      longitude: values.longitude,
    };
    try {
      if (props.mode === 'edit') {
        await graphql(UPDATE_PROPERTY, { id: props.propertyId, set: fields });
        toast.success('Bien mis à jour', { description: values.name });
        router.push('/biens/' + props.propertyId);
        return;
      }
      const created = await graphql<{ insert_properties_one: { id: string } }>(ADD_PROPERTY, {
        object: { ...fields, type: values.type },
      });
      toast.success('Bien créé', {
        description:
          values.type === 'building'
            ? values.name + ' a été ajouté. Ajoutez maintenant ses unités.'
            : values.name + ' a été ajouté avec son unité.',
      });
      router.push('/biens/' + created.insert_properties_one.id);
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Nom du bien *</FieldLabel>
              <Input
                id="name"
                placeholder="Ex. Résidence Les Jardins de Carthage"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                {...register('name')}
              />
              <FieldError id="name-error" errors={[errors.name]} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="type">Type de bien *</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                      <SelectTrigger id="type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editing ? (
                      <FieldDescription>Le type ne peut plus être modifié après la création.</FieldDescription>
                    ) : (
                      type !== 'building' && (
                        <FieldDescription>
                          Une unité « {type === 'house' ? 'MAISON' : 'TERRAIN'} » sera créée automatiquement pour suivre
                          propriétaires, loyers et ventes.
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="branch_id"
                render={({ field }) => (
                  <Field data-invalid={!!errors.branch_id}>
                    <FieldLabel htmlFor="branch_id">Succursale *</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={branches.status !== 'success'}>
                      <SelectTrigger id="branch_id" className="w-full" aria-invalid={!!errors.branch_id}>
                        <SelectValue placeholder={branches.status === 'loading' ? 'Chargement…' : 'Choisir une succursale'} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.status === 'success' &&
                          branches.data.branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                              {branch.city ? ' · ' + branch.city : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {branches.status === 'error' && (
                      <FieldDescription className="text-destructive">Impossible de charger les succursales.</FieldDescription>
                    )}
                    <FieldError errors={[errors.branch_id]} />
                  </Field>
                )}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="address_line">Adresse</FieldLabel>
              <Input id="address_line" placeholder="Ex. 14 Rue des Jardins" {...register('address_line')} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="city">Ville</FieldLabel>
                <Input id="city" placeholder="Ex. Carthage" {...register('city')} />
              </Field>
              <Controller
                control={control}
                name="governorate"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="governorate">Gouvernorat</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="governorate" className="w-full">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {GOVERNORATES.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Field data-invalid={!!errors.postal_code}>
                <FieldLabel htmlFor="postal_code">Code postal</FieldLabel>
                <Input
                  id="postal_code"
                  inputMode="numeric"
                  placeholder="2016"
                  aria-invalid={!!errors.postal_code}
                  aria-describedby={errors.postal_code ? 'postal_code-error' : undefined}
                  {...register('postal_code')}
                />
                <FieldError id="postal_code-error" errors={[errors.postal_code]} />
              </Field>
            </div>

            {/* LOCATION-PICKER: Task 13 inserts the map picker here. */}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer le bien'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

- [ ] **Step 6: Use the form on the create page**

Replace `web/src/app/(app)/biens/nouveau/page.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PropertyForm } from '@/components/domain/property-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/biens">
          <ArrowLeft data-icon="inline-start" />
          Retour aux biens
        </Link>
      </Button>
      <PageHeader
        title="Ajouter un bien"
        description="Créez la fiche d’un immeuble, d’une maison ou d’un terrain. Les unités d’un immeuble s’ajoutent ensuite depuis sa fiche."
      />
      <PropertyForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 7: Create the edit page**

Create `web/src/app/(app)/biens/[id]/modifier/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PropertyForm, type PropertyFormValues } from '@/components/domain/property-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useGraphql } from '@/lib/use-graphql';

const PROPERTY_QUERY = `
  query PropertyForEdit($id: uuid!) {
    property: properties_by_pk(id: $id) {
      id name type branch_id address_line city governorate postal_code latitude longitude
    }
  }
`;

type PropertyRow = {
  id: string;
  name: string;
  type: PropertyFormValues['type'];
  branch_id: string;
  address_line: string | null;
  city: string | null;
  governorate: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

const toNumber = (value: number | string | null) => (value === null ? null : Number(value));

function toFormValues(row: PropertyRow): PropertyFormValues {
  return {
    name: row.name,
    type: row.type,
    branch_id: row.branch_id,
    address_line: row.address_line ?? '',
    city: row.city ?? '',
    governorate: row.governorate ?? '',
    postal_code: row.postal_code ?? '',
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  };
}

export default function EditPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ property: PropertyRow | null }>(PROPERTY_QUERY, { id });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={'/biens/' + id}>
          <ArrowLeft data-icon="inline-start" />
          Retour au bien
        </Link>
      </Button>
      {result.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement du bien…</Pulse>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce bien : {result.message}
        </p>
      )}
      {result.status === 'success' && !result.data.property && (
        <p className="text-sm text-muted-foreground">Ce bien n’existe pas ou vous n’y avez pas accès.</p>
      )}
      {result.status === 'success' && result.data.property && (
        <>
          <PageHeader title={'Modifier ' + result.data.property.name} description="Corrigez les informations du bien." />
          <PropertyForm mode="edit" propertyId={id} initial={toFormValues(result.data.property)} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Link to it from the bien page and fix the crumb**

In `web/src/app/(app)/biens/[id]/page.tsx`:
- add `Pencil` to the `lucide-react` import list;
- replace

```tsx
            <>
              <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
```

with

```tsx
            <>
              <Button asChild variant="outline">
                <Link href={'/biens/' + current.id + '/modifier'}>
                  <Pencil data-icon="inline-start" />
                  Modifier
                </Link>
              </Button>
              <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
```

In `web/src/lib/navigation.ts` replace

```ts
const SEGMENT_LABELS: Record<string, string> = { nouveau: 'Nouveau' };
```

with

```ts
const SEGMENT_LABELS: Record<string, string> = { nouveau: 'Nouveau', modifier: 'Modifier' };
```

- [ ] **Step 9: Lint, build, check in the browser**

Run: `npm run lint && npm run build`
Expected: both succeed.
With the dev server running and the user signed in: open `/biens/31111111-1111-4111-8111-111111111111/modifier`, change the city, save → toast "Bien mis à jour", the bien page shows the new city; the type select is disabled. Open `/biens/nouveau`, choose "Maison" → the automatic-unit note appears.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/use-hash.ts web/src/lib/use-hash.test.tsx web/src/components/domain/property-form.tsx "web/src/app/(app)/biens/nouveau/page.tsx" "web/src/app/(app)/biens/[id]/modifier/page.tsx" "web/src/app/(app)/biens/[id]/page.tsx" web/src/lib/navigation.ts
git commit -m "feat(biens): shared bien form with edit page and hash-driven tabs"
```

---

### Task 6: Unit create/edit dialog

**Files:**
- Create: `web/src/components/domain/unit-dialog.tsx`
- Delete: `web/src/components/domain/add-unit-dialog.tsx`
- Modify: `web/src/components/domain/labels.ts` (unit types `house`, `land`)
- Modify: `web/src/app/(app)/biens/[id]/page.tsx` (use `UnitDialog`)
- Modify: `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx` (add "Modifier")

**Interfaces:**
- Consumes: `toFrenchError` (Task 3), `UNIT_TYPES`, `UNIT_STATUSES`.
- Produces:
  - `type UnitFormUnit = { id: string; code: string; type: string; status: string; floor: number | null; rooms: number | null; surface_m2: number | string | null; rent_amount: number | string | null }`
  - `UnitDialog(props: { propertyId: string; unit?: UnitFormUnit; trigger?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; onSaved: () => void })` — create when `unit` is absent, edit otherwise; controlled when `open` is passed.

- [ ] **Step 1: Add the new unit types to the labels**

In `web/src/components/domain/labels.ts` replace

```ts
  shop: 'Commerce',
  parking: 'Parking',
};
```

with

```ts
  shop: 'Commerce',
  parking: 'Parking',
  house: 'Maison',
  land: 'Terrain',
};
```

- [ ] **Step 2: Create the dialog**

Create `web/src/components/domain/unit-dialog.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { UNIT_STATUSES, UNIT_TYPES } from '@/components/domain/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

const ADD_UNIT = `
  mutation AddUnit($object: units_insert_input!) {
    insert_units_one(object: $object) { id }
  }
`;

const UPDATE_UNIT = `
  mutation UpdateUnit($id: uuid!, $set: units_set_input!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const optionalInt = (label: string, min: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (/^-?\d+$/.test(value) && Number(value) >= min), label);

const optionalNumber = (label: string, minExclusive: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (value === '') return true;
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) && (minExclusive ? parsed > 0 : parsed >= 0);
    }, label);

const schema = z.object({
  code: z.string().trim().min(1, 'Saisissez la référence de l’unité (ex. B-101).'),
  type: z.enum(['apartment', 'office', 'shop', 'parking', 'house', 'land']),
  status: z.enum(['vacant', 'rented', 'for_sale', 'sold', 'under_maintenance']),
  floor: optionalInt('Étage invalide : nombre entier attendu.', -10),
  rooms: optionalInt('Nombre de pièces invalide.', 0),
  surface_m2: optionalNumber('Surface invalide : nombre positif attendu.', true),
  rent_amount: optionalNumber('Loyer invalide : nombre positif ou nul attendu.', false),
});

type FormValues = z.infer<typeof schema>;

export type UnitFormUnit = {
  id: string;
  code: string;
  type: string;
  status: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
};

const EMPTY: FormValues = { code: '', type: 'apartment', status: 'vacant', floor: '', rooms: '', surface_m2: '', rent_amount: '' };

const asText = (value: number | string | null) => (value === null ? '' : String(value));
const toNumberOrNull = (value: string) => (value === '' ? null : Number(value.replace(',', '.')));

function toFormValues(unit: UnitFormUnit): FormValues {
  return {
    code: unit.code,
    type: unit.type as FormValues['type'],
    status: unit.status as FormValues['status'],
    floor: asText(unit.floor),
    rooms: asText(unit.rooms),
    surface_m2: asText(unit.surface_m2),
    rent_amount: asText(unit.rent_amount),
  };
}

type Props = {
  propertyId: string;
  unit?: UnitFormUnit;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
};

export function UnitDialog({ propertyId, unit, trigger, open, onOpenChange, onSaved }: Props) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInnerOpen(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{unit ? 'Modifier l’unité ' + unit.code : 'Ajouter une unité'}</DialogTitle>
          <DialogDescription>
            {unit ? 'Corrigez les caractéristiques de l’unité.' : 'Appartement, bureau, commerce ou parking rattaché à ce bien.'}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        <UnitForm
          propertyId={propertyId}
          unit={unit}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function UnitForm({
  propertyId,
  unit,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  unit?: UnitFormUnit;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: unit ? toFormValues(unit) : EMPTY,
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: FormValues) {
    const fields = {
      code: values.code,
      type: values.type,
      status: values.status,
      floor: toNumberOrNull(values.floor),
      rooms: toNumberOrNull(values.rooms),
      surface_m2: toNumberOrNull(values.surface_m2),
      rent_amount: toNumberOrNull(values.rent_amount),
    };
    try {
      if (unit) {
        await graphql(UPDATE_UNIT, { id: unit.id, set: fields });
        toast.success('Unité mise à jour', { description: values.code });
      } else {
        await graphql(ADD_UNIT, { object: { ...fields, property_id: propertyId } });
        toast.success('Unité créée', { description: values.code + ' a été ajoutée au bien.' });
      }
      onSaved();
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error, { unitCode: values.code }) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="unit-code">Référence *</FieldLabel>
            <Input
              id="unit-code"
              placeholder="Ex. B-101"
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? 'unit-code-error' : undefined}
              {...register('code')}
            />
            <FieldError id="unit-code-error" errors={[errors.code]} />
          </Field>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="unit-type">Type *</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_TYPES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field data-invalid={!!errors.floor}>
            <FieldLabel htmlFor="unit-floor">Étage</FieldLabel>
            <Input id="unit-floor" inputMode="numeric" placeholder="1" aria-invalid={!!errors.floor} {...register('floor')} />
            <FieldError errors={[errors.floor]} />
          </Field>
          <Field data-invalid={!!errors.rooms}>
            <FieldLabel htmlFor="unit-rooms">Pièces</FieldLabel>
            <Input id="unit-rooms" inputMode="numeric" placeholder="3" aria-invalid={!!errors.rooms} {...register('rooms')} />
            <FieldError errors={[errors.rooms]} />
          </Field>
          <Field data-invalid={!!errors.surface_m2}>
            <FieldLabel htmlFor="unit-surface">Surface</FieldLabel>
            <InputGroup>
              <InputGroupInput id="unit-surface" inputMode="decimal" placeholder="92" aria-invalid={!!errors.surface_m2} {...register('surface_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>m²</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.surface_m2]} />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.rent_amount}>
            <FieldLabel htmlFor="unit-rent">Loyer mensuel</FieldLabel>
            <InputGroup>
              <InputGroupInput id="unit-rent" inputMode="decimal" placeholder="980,000" aria-invalid={!!errors.rent_amount} {...register('rent_amount')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>TND</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.rent_amount]} />
          </Field>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="unit-status">Statut *</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_STATUSES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSubmitting ? 'Enregistrement…' : unit ? 'Enregistrer' : 'Ajouter l’unité'}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

- [ ] **Step 3: Switch the bien page to the new dialog**

In `web/src/app/(app)/biens/[id]/page.tsx`:
- replace `import { AddUnitDialog } from '@/components/domain/add-unit-dialog';` with `import { UnitDialog } from '@/components/domain/unit-dialog';`
- add `Plus` to the `lucide-react` import list;
- replace

```tsx
              {!archived && <AddUnitDialog propertyId={current.id} onCreated={() => setReload((value) => value + 1)} />}
```

with

```tsx
              {!archived && (
                <UnitDialog
                  propertyId={current.id}
                  trigger={
                    <Button>
                      <Plus data-icon="inline-start" />
                      Ajouter une unité
                    </Button>
                  }
                  onSaved={() => setReload((value) => value + 1)}
                />
              )}
```

Then delete `web/src/components/domain/add-unit-dialog.tsx` and confirm nothing imports it:

Run: `git rm web/src/components/domain/add-unit-dialog.tsx` then search `add-unit-dialog` in `web/src` — expected: no match.

- [ ] **Step 4: Add "Modifier" on the unit page**

In `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx`:
- add `Pencil` to the `lucide-react` import list and `import { UnitDialog } from '@/components/domain/unit-dialog';`;
- replace

```tsx
            <>
              <StatusBadge status={current.status} />
```

with

```tsx
            <>
              <StatusBadge status={current.status} />
              <UnitDialog
                propertyId={current.property.id}
                unit={current}
                trigger={
                  <Button variant="outline">
                    <Pencil data-icon="inline-start" />
                    Modifier
                  </Button>
                }
                onSaved={() => setReload((value) => value + 1)}
              />
```

- [ ] **Step 5: Lint, build, check in the browser**

Run: `npm run lint && npm run build`
Expected: both succeed.
In the browser: on the Résidence page add unit `B-301` → it appears; add `B-301` again → toast "La référence B-301 existe déjà dans ce bien."; open B-301 → "Modifier" → change rent → saved and shown.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/domain/unit-dialog.tsx web/src/components/domain/labels.ts "web/src/app/(app)/biens/[id]/page.tsx" "web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx"
git commit -m "feat(units): one dialog to create and edit units"
```

---

### Task 7: Contacts — shared form, duplicate warning, edit, archive, owned units

**Files:**
- Create: `web/src/lib/contact-duplicates.ts`, `web/src/lib/contact-duplicates.test.ts`
- Create: `web/src/components/domain/duplicate-notice.tsx`, `web/src/components/domain/duplicate-notice.test.tsx`
- Create: `web/src/components/domain/contact-form.tsx`
- Modify: `web/src/app/(app)/contacts/nouveau/page.tsx` (full replacement)
- Create: `web/src/app/(app)/contacts/[id]/modifier/page.tsx`
- Create: `web/src/components/ownership/contact-owned-units.tsx`
- Modify: `web/src/app/(app)/contacts/[id]/page.tsx` (full replacement)
- Modify: `web/src/app/(app)/contacts/page.tsx` (archived toggle, owned count)

**Interfaces:**
- Consumes: `toFrenchError`, `useCanEdit` (Task 3); `formatDateFr`, `formatPercent`, `ownershipPhase` (Task 4); `CONTACT_ROLES`, `RoleBadge`, `ContactRole` from `web/src/components/domain/badges.tsx`.
- Produces:
  - `normalizePhone(value: string | null | undefined): string` (8 local digits), `formatTnPhone(digits: string): string` (`"98 123 456"`)
  - `type DuplicateCandidate = { id: string; full_name: string; national_id: string | null; email: string | null; phone: string | null }`
  - `type DuplicateField = 'national_id' | 'email' | 'phone'`, `type DuplicateMatch = { contact: DuplicateCandidate; fields: DuplicateField[] }`
  - `findDuplicates(input: { national_id: string; email: string; phone: string }, candidates: DuplicateCandidate[], excludeId?: string): DuplicateMatch[]`
  - `duplicateWhere(input: { national_id: string; email: string; phone: string }): Record<string, unknown> | null`
  - `DuplicateNotice({ matches }: { matches: DuplicateMatch[] })`
  - `type ContactFormValues`, `ContactForm(props: { mode: 'create' } | { mode: 'edit'; contactId: string; initial: ContactFormValues; lockedRoles: ContactRole[] })`
  - `ContactOwnedUnits({ contactId }: { contactId: string })`
  - route `/contacts/[id]/modifier`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/contact-duplicates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { duplicateWhere, findDuplicates, formatTnPhone, normalizePhone, type DuplicateCandidate } from './contact-duplicates';

const hedi: DuplicateCandidate = {
  id: 'c1',
  full_name: 'Hédi Ben Salem',
  national_id: '08942155',
  email: 'Hedi.BenSalem@example.tn',
  phone: '+216 20 000 001',
};

describe('normalizePhone / formatTnPhone', () => {
  it('keeps the 8 local digits whatever the spacing or prefix', () => {
    expect(normalizePhone('+216 20 000 001')).toBe('20000001');
    expect(normalizePhone('20 000 001')).toBe('20000001');
    expect(normalizePhone('0021620000001')).toBe('20000001');
    expect(normalizePhone(null)).toBe('');
  });
  it('formats 8 digits as 2-3-3', () => {
    expect(formatTnPhone('20000001')).toBe('20 000 001');
  });
});

describe('findDuplicates', () => {
  it('matches on phone typed differently', () => {
    const matches = findDuplicates({ national_id: '', email: '', phone: '20000001' }, [hedi]);
    expect(matches).toEqual([{ contact: hedi, fields: ['phone'] }]);
  });
  it('matches e-mail without case and lists every matching field', () => {
    const matches = findDuplicates({ national_id: '08942155', email: 'hedi.bensalem@example.tn', phone: '' }, [hedi]);
    expect(matches[0].fields).toEqual(['national_id', 'email']);
  });
  it('ignores the contact being edited and empty inputs', () => {
    expect(findDuplicates({ national_id: '08942155', email: '', phone: '' }, [hedi], 'c1')).toEqual([]);
    expect(findDuplicates({ national_id: '', email: '', phone: '' }, [hedi])).toEqual([]);
  });
});

describe('duplicateWhere', () => {
  it('builds an _or filter only for filled fields', () => {
    expect(duplicateWhere({ national_id: '', email: '', phone: '' })).toBeNull();
    expect(duplicateWhere({ national_id: ' 08942155 ', email: '', phone: '20 000 001' })).toEqual({
      _or: [{ national_id: { _ilike: '08942155' } }, { phone: { _ilike: '%2%0%0%0%0%0%0%1' } }],
    });
  });
});
```

Create `web/src/components/domain/duplicate-notice.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DuplicateNotice } from './duplicate-notice';

describe('DuplicateNotice', () => {
  it('renders nothing without matches', () => {
    const { container } = render(<DuplicateNotice matches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the existing contact, the matching fields and links to it', () => {
    render(
      <DuplicateNotice
        matches={[
          {
            contact: { id: 'c1', full_name: 'Salma Gharbi', national_id: null, email: null, phone: '+216 25 000 005' },
            fields: ['phone', 'email'],
          },
        ]}
      />,
    );
    expect(screen.getByText(/Même téléphone, e-mail que/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Salma Gharbi' })).toHaveAttribute('href', '/contacts/c1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/contact-duplicates.test.ts src/components/domain/duplicate-notice.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the matching and the notice**

Create `web/src/lib/contact-duplicates.ts`:

```ts
// Finds contacts that look like the one being typed (same CIN, e-mail or phone).
// Staff are warned, never blocked: two people can share a phone or an e-mail.

export type DuplicateCandidate = {
  id: string;
  full_name: string;
  national_id: string | null;
  email: string | null;
  phone: string | null;
};

export type DuplicateField = 'national_id' | 'email' | 'phone';
export type DuplicateMatch = { contact: DuplicateCandidate; fields: DuplicateField[] };
type DuplicateInput = { national_id: string; email: string; phone: string };

const normalizeText = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Keeps the 8 local digits of a Tunisian number, whatever the spacing or +216 / 00216 prefix. */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length > 8 && digits.startsWith('00216')) return digits.slice(5);
  if (digits.length > 8 && digits.startsWith('216')) return digits.slice(3);
  return digits;
}

export function formatTnPhone(digits: string): string {
  return digits.length === 8 ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : digits;
}

export function findDuplicates(input: DuplicateInput, candidates: DuplicateCandidate[], excludeId?: string): DuplicateMatch[] {
  const nationalId = normalizeText(input.national_id);
  const email = normalizeText(input.email);
  const phone = normalizePhone(input.phone);

  return candidates
    .filter((candidate) => candidate.id !== excludeId)
    .map((candidate) => {
      const fields: DuplicateField[] = [];
      if (nationalId && normalizeText(candidate.national_id) === nationalId) fields.push('national_id');
      if (email && normalizeText(candidate.email) === email) fields.push('email');
      if (phone.length >= 8 && normalizePhone(candidate.phone) === phone) fields.push('phone');
      return { contact: candidate, fields };
    })
    .filter((match) => match.fields.length > 0);
}

/** Hasura filter that fetches possible duplicates; `findDuplicates` then keeps exact matches only. */
export function duplicateWhere(input: DuplicateInput): Record<string, unknown> | null {
  const conditions: Record<string, unknown>[] = [];
  if (input.national_id.trim()) conditions.push({ national_id: { _ilike: input.national_id.trim() } });
  if (input.email.trim()) conditions.push({ email: { _ilike: input.email.trim() } });
  const phone = normalizePhone(input.phone);
  if (phone.length >= 8) conditions.push({ phone: { _ilike: '%' + phone.split('').join('%') } });
  return conditions.length > 0 ? { _or: conditions } : null;
}
```

Create `web/src/components/domain/duplicate-notice.tsx`:

```tsx
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { DuplicateField, DuplicateMatch } from '@/lib/contact-duplicates';

const FIELD_LABELS: Record<DuplicateField, string> = {
  national_id: 'CIN / matricule',
  email: 'e-mail',
  phone: 'téléphone',
};

export function DuplicateNotice({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <div role="status" className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-warning" aria-hidden />
        Ce contact existe peut-être déjà
      </p>
      <ul className="space-y-1">
        {matches.map((match) => (
          <li key={match.contact.id}>
            Même {match.fields.map((field) => FIELD_LABELS[field]).join(', ')} que{' '}
            <Link href={'/contacts/' + match.contact.id} target="_blank" className="font-medium text-primary underline">
              {match.contact.full_name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Vous pouvez tout de même enregistrer.</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/contact-duplicates.test.ts src/components/domain/duplicate-notice.test.tsx`
Expected: all pass.

- [ ] **Step 5: Create the shared contact form**

Create `web/src/components/domain/contact-form.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Building2, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { CONTACT_ROLES, type ContactRole } from '@/components/domain/badges';
import { DuplicateNotice } from '@/components/domain/duplicate-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  duplicateWhere,
  findDuplicates,
  formatTnPhone,
  normalizePhone,
  type DuplicateCandidate,
  type DuplicateMatch,
} from '@/lib/contact-duplicates';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { cn } from '@/lib/utils';

const ADD_CONTACT = `
  mutation AddContact($object: contacts_insert_input!) {
    insert_contacts_one(object: $object) { id }
  }
`;

const ADD_ROLES = `
  mutation AddContactRoles($objects: [contact_roles_insert_input!]!) {
    insert_contact_roles(objects: $objects) { affected_rows }
  }
`;

const UPDATE_CONTACT = `
  mutation UpdateContact($id: uuid!, $set: contacts_set_input!, $removed: [String!]!, $added: [contact_roles_insert_input!]!) {
    update_contacts_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    delete_contact_roles(where: { contact_id: { _eq: $id }, role: { _in: $removed } }) { affected_rows }
    insert_contact_roles(objects: $added) { affected_rows }
  }
`;

const DUPLICATES_QUERY = `
  query ContactDuplicates($where: contacts_bool_exp!) {
    contacts(where: $where, limit: 10) { id full_name national_id email phone }
  }
`;

const schema = z.object({
  kind: z.enum(['person', 'company']),
  full_name: z.string().trim().min(2, 'Saisissez le nom complet (2 caractères minimum).'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || normalizePhone(value).length === 8, 'Numéro invalide : 8 chiffres attendus (ex. 98 123 456).'),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Adresse e-mail invalide.'),
  national_id: z.string().trim(),
  address: z.string().trim(),
  notes: z.string().trim(),
  roles: z.array(z.enum(['owner', 'renter', 'buyer'])).min(1, 'Choisissez au moins un rôle.'),
});

export type ContactFormValues = z.infer<typeof schema>;

const EMPTY: ContactFormValues = {
  kind: 'person',
  full_name: '',
  phone: '',
  email: '',
  national_id: '',
  address: '',
  notes: '',
  roles: [],
};

const orNull = (value: string) => (value === '' ? null : value);

/** Stored phones look like "+216 98 123 456"; the form shows the 8 local digits. */
export function phoneForForm(stored: string | null): string {
  return stored ? formatTnPhone(normalizePhone(stored)) : '';
}

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; contactId: string; initial: ContactFormValues; lockedRoles: ContactRole[] };

export function ContactForm(props: Props) {
  const router = useRouter();
  const createdId = useRef<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const editing = props.mode === 'edit';
  const lockedRoles = props.mode === 'edit' ? props.lockedRoles : [];
  const { control, register, handleSubmit, formState, getValues } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.initial : EMPTY,
  });
  const { errors, isSubmitting } = formState;

  async function checkDuplicates() {
    const input = { national_id: getValues('national_id'), email: getValues('email'), phone: getValues('phone') };
    const where = duplicateWhere(input);
    if (!where) {
      setDuplicates([]);
      return;
    }
    try {
      const data = await graphql<{ contacts: DuplicateCandidate[] }>(DUPLICATES_QUERY, { where });
      setDuplicates(findDuplicates(input, data.contacts, props.mode === 'edit' ? props.contactId : undefined));
    } catch {
      setDuplicates([]); // The warning is a help, never a blocker.
    }
  }

  async function onSubmit(values: ContactFormValues) {
    const fields = {
      kind: values.kind,
      full_name: values.full_name,
      email: orNull(values.email),
      phone: values.phone === '' ? null : '+216 ' + formatTnPhone(normalizePhone(values.phone)),
      national_id: orNull(values.national_id),
      address: orNull(values.address),
      notes: orNull(values.notes),
    };
    try {
      if (props.mode === 'edit') {
        const before = props.initial.roles;
        await graphql(UPDATE_CONTACT, {
          id: props.contactId,
          set: fields,
          removed: before.filter((role) => !values.roles.includes(role)),
          added: values.roles.filter((role) => !before.includes(role)).map((role) => ({ contact_id: props.contactId, role })),
        });
        toast.success('Contact mis à jour', { description: values.full_name });
        router.push('/contacts/' + props.contactId);
        return;
      }
      // Keep the id across retries so a failed role insert never creates a second contact.
      if (createdId.current === null) {
        const created = await graphql<{ insert_contacts_one: { id: string } }>(ADD_CONTACT, { object: fields });
        createdId.current = created.insert_contacts_one.id;
      }
      const contactId = createdId.current;
      await graphql(ADD_ROLES, { objects: values.roles.map((role) => ({ contact_id: contactId, role })) });
      toast.success('Contact créé', { description: values.full_name + ' a été ajouté.' });
      router.push('/contacts/' + contactId);
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error) });
    }
  }

  const cancelHref = props.mode === 'edit' ? '/contacts/' + props.contactId : '/contacts';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <FieldGroup>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Type de contact</FieldLegend>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="grid max-w-md grid-cols-2 gap-3">
                    {(
                      [
                        { value: 'person', label: 'Personne', icon: User },
                        { value: 'company', label: 'Société', icon: Building2 },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = field.value === option.value;
                      return (
                        <label
                          key={option.value}
                          htmlFor={'kind-' + option.value}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                            selected ? 'border-primary bg-accent text-accent-foreground' : 'hover:bg-muted',
                          )}
                        >
                          <RadioGroupItem id={'kind-' + option.value} value={option.value} />
                          <Icon className="size-4" aria-hidden />
                          {option.label}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </FieldSet>
              )}
            />

            <Field data-invalid={!!errors.full_name}>
              <FieldLabel htmlFor="full_name">Nom complet *</FieldLabel>
              <Input
                id="full_name"
                placeholder="Ex. Salma Gharbi"
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                {...register('full_name')}
              />
              <FieldError id="full_name-error" errors={[errors.full_name]} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Téléphone</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>+216</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="98 123 456"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                    {...register('phone', { onBlur: () => void checkDuplicates() })}
                  />
                </InputGroup>
                <FieldError id="phone-error" errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="salma.gharbi@email.tn"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email', { onBlur: () => void checkDuplicates() })}
                />
                <FieldError id="email-error" errors={[errors.email]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="national_id">CIN ou matricule fiscal</FieldLabel>
              <Input
                id="national_id"
                placeholder="Ex. 08942155 ou 1489201/A"
                {...register('national_id', { onBlur: () => void checkDuplicates() })}
              />
            </Field>

            <DuplicateNotice matches={duplicates} />

            <Field>
              <FieldLabel htmlFor="address">Adresse</FieldLabel>
              <Input id="address" placeholder="Ex. 14 Rue des Jardins, Carthage, Tunis" {...register('address')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Input id="notes" placeholder="Informations utiles pour l’équipe" {...register('notes')} />
            </Field>

            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <FieldSet data-invalid={!!errors.roles}>
                  <FieldLegend variant="label">Rôles *</FieldLegend>
                  <FieldDescription>Un contact peut avoir plusieurs rôles.</FieldDescription>
                  <div className="grid gap-3 md:grid-cols-3">
                    {CONTACT_ROLES.map((role) => {
                      const Icon = role.icon;
                      const selected = field.value.includes(role.value);
                      const locked = lockedRoles.includes(role.value);
                      return (
                        <label
                          key={role.value}
                          htmlFor={'role-' + role.value}
                          className={cn(
                            'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                            selected ? 'border-primary bg-accent/60' : 'hover:bg-muted',
                            locked && 'cursor-not-allowed opacity-80',
                          )}
                        >
                          <span className="flex items-center justify-between">
                            <span className={cn('flex size-8 items-center justify-center rounded-md', role.tile)}>
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <Checkbox
                              id={'role-' + role.value}
                              aria-invalid={!!errors.roles}
                              disabled={locked}
                              onBlur={field.onBlur}
                              checked={selected}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? [...field.value, role.value] : field.value.filter((item) => item !== role.value))
                              }
                            />
                          </span>
                          <span className="text-sm font-medium">{role.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {locked ? 'Ce contact détient des unités : ce rôle reste actif.' : role.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FieldError errors={[errors.roles]} />
                </FieldSet>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer le contact'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

- [ ] **Step 6: Use the form on the create page**

Replace `web/src/app/(app)/contacts/nouveau/page.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ContactForm } from '@/components/domain/contact-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/contacts">
          <ArrowLeft data-icon="inline-start" />
          Retour aux contacts
        </Link>
      </Button>
      <PageHeader
        title="Ajouter un contact"
        description="Créez la fiche d’un propriétaire, locataire ou acquéreur. Un contact peut cumuler plusieurs rôles."
      />
      <ContactForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 7: Create the contact edit page**

Create `web/src/app/(app)/contacts/[id]/modifier/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ContactRole } from '@/components/domain/badges';
import { ContactForm, phoneForForm, type ContactFormValues } from '@/components/domain/contact-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useGraphql } from '@/lib/use-graphql';

const CONTACT_QUERY = `
  query ContactForEdit($id: uuid!) {
    contact: contacts_by_pk(id: $id) {
      id kind full_name email phone national_id address notes
      roles { role }
      current_ownerships_aggregate { aggregate { count } }
    }
  }
`;

type ContactRow = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  roles: { role: ContactRole }[];
  current_ownerships_aggregate: { aggregate: { count: number } | null };
};

function toFormValues(row: ContactRow): ContactFormValues {
  return {
    kind: row.kind,
    full_name: row.full_name,
    phone: phoneForForm(row.phone),
    email: row.email ?? '',
    national_id: row.national_id ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    roles: row.roles.map((item) => item.role),
  };
}

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ contact: ContactRow | null }>(CONTACT_QUERY, { id });
  const contact = result.status === 'success' ? result.data.contact : null;
  const ownsUnits = (contact?.current_ownerships_aggregate.aggregate?.count ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={'/contacts/' + id}>
          <ArrowLeft data-icon="inline-start" />
          Retour au contact
        </Link>
      </Button>
      {result.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement du contact…</Pulse>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce contact : {result.message}
        </p>
      )}
      {result.status === 'success' && !contact && (
        <p className="text-sm text-muted-foreground">Ce contact n’existe pas ou vous n’y avez pas accès.</p>
      )}
      {contact && (
        <>
          <PageHeader title={'Modifier ' + contact.full_name} description="Corrigez les coordonnées et les rôles du contact." />
          <ContactForm
            mode="edit"
            contactId={id}
            initial={toFormValues(contact)}
            lockedRoles={ownsUnits ? ['owner'] : []}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create the owned-units card body**

Create `web/src/components/ownership/contact-owned-units.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Pulse } from '@/components/motion/primitives';
import { formatDateFr, formatPercent, ownershipPhase, todayIso } from '@/lib/ownership';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query ContactOwnerships($contactId: uuid!) {
    ownerships(where: { contact_id: { _eq: $contactId } }, order_by: [{ starts_on: desc }]) {
      id share_percent starts_on ends_on
      unit { id code property { id name } }
    }
  }
`;

type Row = {
  id: string;
  share_percent: number | string;
  starts_on: string;
  ends_on: string | null;
  unit: { id: string; code: string; property: { id: string; name: string } };
};

function UnitLine({ row, detail }: { row: Row; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <Link href={'/biens/' + row.unit.property.id + '/unites/' + row.unit.id} className="min-w-0 hover:text-primary hover:underline">
        <span className="font-medium">{row.unit.code}</span>
        <span className="text-muted-foreground"> · {row.unit.property.name}</span>
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detail}</span>
    </li>
  );
}

export function ContactOwnedUnits({ contactId }: { contactId: string }) {
  const result = useGraphql<{ ownerships: Row[] }>(QUERY, { contactId });
  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des unités…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les unités : {result.message}</p>;

  const today = todayIso();
  const active = result.data.ownerships.filter((row) => ownershipPhase(row, today) !== 'past');
  const past = result.data.ownerships.filter((row) => ownershipPhase(row, today) === 'past');
  if (active.length === 0 && past.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune unité détenue pour le moment.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {active.length > 0 && (
        <ul className="divide-y">
          {active.map((row) => (
            <UnitLine
              key={row.id}
              row={row}
              detail={
                formatPercent(row.share_percent) +
                (row.starts_on > today ? ' · à partir du ' : ' · depuis le ') +
                formatDateFr(row.starts_on)
              }
            />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Unités détenues auparavant</p>
          <ul className="divide-y opacity-80">
            {past.map((row) => (
              <UnitLine
                key={row.id}
                row={row}
                detail={formatDateFr(row.starts_on) + ' → ' + formatDateFr(row.ends_on as string)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Rewrite the contact page (edit, archive, owned units)**

Replace `web/src/app/(app)/contacts/[id]/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, ArrowLeft, Copy, FileText, IdCard, Loader2, Mail, MapPin, Pencil, Phone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT_ROLES, RoleBadge, type ContactRole } from '@/components/domain/badges';
import { HoverLift, Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { ContactOwnedUnits } from '@/components/ownership/contact-owned-units';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { springs } from '@/lib/motion-tokens';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const CONTACT_QUERY = `
  query Contact($id: uuid!) {
    contact: contacts_by_pk(id: $id) {
      id kind full_name email phone national_id address notes is_organization archived_at
      roles { role }
    }
  }
`;

const SET_ARCHIVED = `
  mutation SetContactArchived($id: uuid!, $archived_at: timestamptz) {
    update_contacts_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

type ContactDetails = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  is_organization: boolean;
  archived_at: string | null;
  roles: { role: ContactRole }[];
};

const LATER_MODULE: Record<Exclude<ContactRole, 'owner'>, string> = {
  renter: 'Les baux de ce locataire apparaîtront ici avec le module Baux.',
  buyer: 'Les offres et achats apparaîtront ici avec le module Ventes.',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label + ' copié');
  } catch {
    toast.error('Copie impossible', { description: 'Le navigateur a refusé l’accès au presse-papiers.' });
  }
}

function InfoRow({
  label,
  icon: Icon,
  value,
  href,
  copyLabel,
}: {
  label: string;
  icon: typeof Mail;
  value: string | null;
  href?: string;
  copyLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {value ? (
          <>
            {href ? (
              <a href={href} className="truncate font-medium text-primary hover:underline">
                {value}
              </a>
            ) : (
              <span className="truncate font-medium">{value}</span>
            )}
            {copyLabel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label={'Copier ' + copyLabel} onClick={() => void copy(value, copyLabel)}>
                    <Copy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copier</TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Non renseigné</span>
        )}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/contacts">
        <ArrowLeft data-icon="inline-start" />
        Retour aux contacts
      </Link>
    </Button>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const result = useGraphql<{ contact: ContactDetails | null }>(CONTACT_QUERY, { id }, reload);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">Chargement du contact…</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce contact : {result.message}
        </p>
      </div>
    );
  }

  const contact = result.data.contact;
  if (!contact) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserX className="size-5" />
            </span>
            <p className="font-medium">Contact introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou a été supprimée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = contact;
  const archived = current.archived_at !== null;
  const held = new Set(current.roles.map((item) => item.role));

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: current.id, archived_at: archived ? null : new Date().toISOString() });
      toast.success(archived ? 'Contact restauré' : 'Contact archivé', { description: current.full_name });
      setReload((value) => value + 1);
    } catch (error) {
      toast.error('Action impossible', { description: toFrenchError(error) });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...springs.bouncy, delay: 0.1 }}>
                <Avatar className="size-16">
                  <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">{initials(current.full_name)}</AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{current.full_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {current.kind === 'company' ? 'Société' : 'Personne'}
                    {current.is_organization && ' · votre société'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {current.roles.map((item) => (
                    <RoleBadge key={item.role} role={item.role} />
                  ))}
                  {archived && <Badge variant="secondary">Archivé</Badge>}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={'/contacts/' + current.id + '/modifier'}>
                    <Pencil data-icon="inline-start" />
                    Modifier
                  </Link>
                </Button>
                {!current.is_organization && (
                  <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
                    {archiving ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {archived ? 'Restaurer' : 'Archiver'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Téléphone" icon={Phone} value={current.phone} href={current.phone ? 'tel:' + current.phone.replace(/\s/g, '') : undefined} copyLabel="le téléphone" />
              <InfoRow label="E-mail" icon={Mail} value={current.email} href={current.email ? 'mailto:' + current.email : undefined} copyLabel="l’e-mail" />
              <InfoRow label={current.kind === 'company' ? 'Matricule fiscal' : 'CIN (identité)'} icon={IdCard} value={current.national_id} />
              <InfoRow label="Adresse" icon={MapPin} value={current.address} />
            </dl>
          </CardContent>
        </Card>
      </StaggerItem>

      <Stagger className="grid gap-4 lg:grid-cols-3">
        {CONTACT_ROLES.map((role) => {
          const Icon = role.icon;
          const active = held.has(role.value);
          return (
            <StaggerItem key={role.value} className={role.value === 'owner' ? 'h-full lg:col-span-3' : 'h-full'}>
              <HoverLift className="h-full">
                <Card className={'h-full ' + (active ? '' : 'bg-muted/40')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className={'flex size-7 items-center justify-center rounded-md ' + (active ? role.tile : 'bg-muted text-muted-foreground')}>
                        <Icon className="size-4" />
                      </span>
                      {role.label}
                    </CardTitle>
                    <CardDescription>{active ? 'Rôle actif' : 'Non applicable'}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {!active && 'Ce contact n’a pas ce rôle.'}
                    {active && role.value === 'owner' && <ContactOwnedUnits contactId={current.id} />}
                    {active && role.value !== 'owner' && LATER_MODULE[role.value]}
                  </CardContent>
                </Card>
              </HoverLift>
            </StaggerItem>
          );
        })}
      </Stagger>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {current.notes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{current.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune note pour ce contact.</p>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
```

- [ ] **Step 10: Contacts list — archived toggle and owned units**

In `web/src/app/(app)/contacts/page.tsx`:

1. Add imports `import { Checkbox } from '@/components/ui/checkbox';` and `import { Label } from '@/components/ui/label';`.
2. In `CONTACTS_QUERY` replace

```
      phone
      roles { role }
```

with

```
      phone
      archived_at
      is_organization
      roles { role }
      current_ownerships_aggregate { aggregate { count } }
```

3. In `type Contact` replace `  roles: { role: ContactRole }[];` with

```ts
  archived_at: string | null;
  is_organization: boolean;
  roles: { role: ContactRole }[];
  current_ownerships_aggregate: { aggregate: { count: number } | null };
```

4. Replace `  const [page, setPage] = useState(1);` with

```ts
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
```

5. Replace `  const all = result.status === 'success' ? result.data.contacts : [];` with

```ts
  const loaded = result.status === 'success' ? result.data.contacts : [];
  const all = loaded.filter((contact) => showArchived || !contact.archived_at);
```

6. Replace `            <InputGroup className="md:w-72">` with

```tsx
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="contacts-archived"
                  checked={showArchived}
                  onCheckedChange={(checked) => {
                    setShowArchived(checked === true);
                    setPage(1);
                  }}
                />
                <Label htmlFor="contacts-archived" className="text-sm font-normal text-muted-foreground">
                  Afficher les archivés
                </Label>
              </div>
            <InputGroup className="md:w-72">
```

and replace

```tsx
            </InputGroup>
          </div>
```

with

```tsx
            </InputGroup>
            </div>
          </div>
```

7. Replace `                      <TableHead className="hidden sm:table-cell">Téléphone</TableHead>` with

```tsx
                      <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Unités</TableHead>
```

8. Replace

```tsx
                          <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">{contact.phone ?? '—'}</TableCell>
```

with

```tsx
                          <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">{contact.phone ?? '—'}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">
                            {contact.current_ownerships_aggregate.aggregate?.count || '—'}
                          </TableCell>
```

9. Replace `                                  {contact.kind === 'company' ? 'Société' : 'Personne'}` with

```tsx
                                  {contact.kind === 'company' ? 'Société' : 'Personne'}
                                  {contact.is_organization && ' · votre société'}
                                  {contact.archived_at && ' · archivé'}
```

- [ ] **Step 11: Run tests, lint, build, check in the browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed.
In the browser: open Hédi Ben Salem → Propriétaire card lists "B-101 · Résidence Les Jardins de Carthage — 100 % · depuis le 15/03/2026"; Sté Foncière lists B-101 under "Unités détenues auparavant". Modifier → Propriétaire checkbox is disabled with the explanation. In "Ajouter un contact", type phone `20 000 001` and leave the field → warning naming Hédi Ben Salem with a link. Archive a contact → it disappears from the list until "Afficher les archivés" is ticked. The self contact "Immobilière Carthage · votre société" has no Archiver button.

- [ ] **Step 12: Commit**

```bash
git add web/src/lib/contact-duplicates.ts web/src/lib/contact-duplicates.test.ts web/src/components/domain/duplicate-notice.tsx web/src/components/domain/duplicate-notice.test.tsx web/src/components/domain/contact-form.tsx "web/src/app/(app)/contacts" web/src/components/ownership/contact-owned-units.tsx
git commit -m "feat(contacts): edit, archive, duplicate warning and owned units"
```

---

### Task 8: Ownership building blocks (picker, owners editor, dialogs)

**Files:**
- Create: `web/src/components/ui/popover.tsx` (shadcn CLI)
- Create: `web/src/components/confirm-dialog.tsx`
- Create: `web/src/components/ownership/use-contact-options.ts`
- Create: `web/src/components/ownership/contact-picker.tsx`
- Create: `web/src/components/ownership/owners-editor.tsx`, `web/src/components/ownership/owners-editor.test.tsx`
- Create: `web/src/components/ownership/transfer-dialog.tsx`
- Create: `web/src/components/ownership/add-coowner-dialog.tsx`

**Interfaces:**
- Consumes: `NewOwner`, `OwnershipRow`, `planTransfer`, `todayIso`, `formatDateFr`, `formatPercent` (Task 4); `toFrenchError` (Task 3); `QueryState`, `useGraphql` from `web/src/lib/use-graphql.ts`.
- Produces:
  - `type ContactOption = { id: string; full_name: string; kind: 'person' | 'company'; is_organization: boolean }`
  - `useContactOptions(): QueryState<ContactOption[]>`
  - `ContactPicker(props: { id?: string; options: ContactOption[]; value: string | null; onChange: (id: string) => void; excludeIds?: string[]; invalid?: boolean })`
  - `OwnersEditor(props: { value: NewOwner[]; onChange: (next: NewOwner[]) => void; options: ContactOption[] })`
  - `TransferDialog(props: { unitIds: string[]; rows: OwnershipRow[]; title: string; description: string; trigger: ReactNode; onDone: () => void })`
  - `AddCoOwnerDialog(props: { unitId: string; remaining: number; onDone: () => void })`
  - `ConfirmDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel?: string; onConfirm: () => Promise<void> })`

- [ ] **Step 1: Add the popover component**

Run (in `web/`): `npx shadcn@latest add popover`
Expected: `src/components/ui/popover.tsx` created, exporting `Popover`, `PopoverTrigger`, `PopoverContent`. Confirm with a search for `export {` in that file.

- [ ] **Step 2: Write the failing owners-editor test**

Create `web/src/components/ownership/owners-editor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContactOption } from './contact-picker';
import { OwnersEditor } from './owners-editor';

const OPTIONS: ContactOption[] = [
  { id: 'c1', full_name: 'Hédi Ben Salem', kind: 'person', is_organization: false },
  { id: 'c2', full_name: 'Salma Gharbi', kind: 'person', is_organization: false },
];

describe('OwnersEditor', () => {
  it('shows a red total when shares do not reach 100 %', () => {
    render(
      <OwnersEditor
        value={[{ contactId: 'c1', sharePercent: 60 }, { contactId: 'c2', sharePercent: 30 }]}
        onChange={() => {}}
        options={OPTIONS}
      />,
    );
    const total = screen.getByText('Total : 90 %');
    expect(total).toHaveClass('text-destructive');
  });

  it('adds a co-owner row pre-filled with the remaining share', async () => {
    const onChange = vi.fn();
    render(<OwnersEditor value={[{ contactId: 'c1', sharePercent: 60 }]} onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un copropriétaire/ }));
    expect(onChange).toHaveBeenCalledWith([
      { contactId: 'c1', sharePercent: 60 },
      { contactId: null, sharePercent: 40 },
    ]);
  });

  it('never removes the last row', () => {
    render(<OwnersEditor value={[{ contactId: 'c1', sharePercent: 100 }]} onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('button', { name: 'Retirer la ligne 1' })).toBeDisabled();
    expect(screen.getByText('Total : 100 %')).toHaveClass('text-success');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/ownership/owners-editor.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the contact options hook and picker**

Create `web/src/components/ownership/use-contact-options.ts`:

```ts
'use client';

import type { ContactOption } from '@/components/ownership/contact-picker';
import { useGraphql, type QueryState } from '@/lib/use-graphql';

const QUERY = `
  query ContactOptions {
    contacts(where: { archived_at: { _is_null: true } }, order_by: [{ is_organization: desc }, { full_name: asc }]) {
      id full_name kind is_organization
    }
  }
`;

/** Active contacts for owner pickers; the organization's own contact comes first. */
export function useContactOptions(): QueryState<ContactOption[]> {
  const result = useGraphql<{ contacts: ContactOption[] }>(QUERY);
  return result.status === 'success' ? { status: 'success', data: result.data.contacts } : result;
}
```

Create `web/src/components/ownership/contact-picker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ContactOption = { id: string; full_name: string; kind: 'person' | 'company'; is_organization: boolean };

export function optionLabel(option: ContactOption): string {
  return option.is_organization ? option.full_name + ' (votre société)' : option.full_name;
}

type Props = {
  id?: string;
  options: ContactOption[];
  value: string | null;
  onChange: (id: string) => void;
  excludeIds?: string[];
  invalid?: boolean;
};

export function ContactPicker({ id, options, value, onChange, excludeIds = [], invalid = false }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  const available = options.filter((option) => option.id === value || !excludeIds.includes(option.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? optionLabel(selected) : 'Choisir un contact'}
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un contact…" />
          <CommandList>
            <CommandEmpty>Aucun contact trouvé.</CommandEmpty>
            <CommandGroup>
              {available.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.full_name + ' ' + option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(option.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  {optionLabel(option)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-1">
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link href="/contacts/nouveau" target="_blank">
                <Plus data-icon="inline-start" />
                Nouveau contact (nouvel onglet)
              </Link>
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 5: Implement the owners editor**

Create `web/src/components/ownership/owners-editor.tsx`:

```tsx
'use client';

import { Plus, X } from 'lucide-react';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { formatPercent, type NewOwner } from '@/lib/ownership';
import { cn } from '@/lib/utils';

type Props = { value: NewOwner[]; onChange: (next: NewOwner[]) => void; options: ContactOption[] };

export function OwnersEditor({ value, onChange, options }: Props) {
  const total = value.reduce((sum, owner) => sum + (Number.isFinite(owner.sharePercent) ? owner.sharePercent : 0), 0);
  const complete = Math.abs(total - 100) <= 0.001;
  const chosen = value.map((owner) => owner.contactId).filter((id): id is string => id !== null);

  const update = (index: number, patch: Partial<NewOwner>) =>
    onChange(value.map((owner, position) => (position === index ? { ...owner, ...patch } : owner)));

  return (
    <div className="space-y-3">
      {value.map((owner, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ContactPicker
              id={'owner-' + index}
              options={options}
              value={owner.contactId}
              excludeIds={chosen}
              onChange={(contactId) => update(index, { contactId })}
            />
          </div>
          <InputGroup className="w-28 shrink-0">
            <InputGroupInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              aria-label={'Part du propriétaire ' + (index + 1)}
              value={Number.isFinite(owner.sharePercent) ? owner.sharePercent : ''}
              onChange={(event) => update(index, { sharePercent: event.target.valueAsNumber })}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={'Retirer la ligne ' + (index + 1)}
            disabled={value.length === 1}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { contactId: null, sharePercent: Math.max(0, Math.round((100 - total) * 100) / 100) }])}
        >
          <Plus data-icon="inline-start" />
          Ajouter un copropriétaire
        </Button>
        <p aria-live="polite" className={cn('text-sm font-medium tabular-nums', complete ? 'text-success' : 'text-destructive')}>
          Total : {formatPercent(total)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/components/ownership/owners-editor.test.tsx`
Expected: 3 passed.

- [ ] **Step 7: Implement the dialogs**

Create `web/src/components/confirm-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
};

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Supprimer', onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Create `web/src/components/ownership/transfer-dialog.tsx`:

```tsx
'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Pulse } from '@/components/motion/primitives';
import { OwnersEditor } from '@/components/ownership/owners-editor';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatDateFr, planTransfer, todayIso, type NewOwner, type OwnershipRow } from '@/lib/ownership';

const TRANSFER = `
  mutation TransferOwnership($endIds: [uuid!]!, $endOn: date!, $objects: [ownerships_insert_input!]!) {
    update_ownerships(where: { id: { _in: $endIds } }, _set: { ends_on: $endOn }) { affected_rows }
    insert_ownerships(objects: $objects) { affected_rows }
  }
`;

type Props = {
  unitIds: string[];
  rows: OwnershipRow[];
  title: string;
  description: string;
  trigger: ReactNode;
  onDone: () => void;
};

export function TransferDialog({ unitIds, rows, title, description, trigger, onDone }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TransferForm
          unitIds={unitIds}
          rows={rows}
          onCancel={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({
  unitIds,
  rows,
  onCancel,
  onDone,
}: {
  unitIds: string[];
  rows: OwnershipRow[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const contacts = useContactOptions();
  const [date, setDate] = useState(todayIso());
  const [owners, setOwners] = useState<NewOwner[]>([{ contactId: null, sharePercent: 100 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const plan = planTransfer(unitIds, rows, date, owners);
    if ('error' in plan) {
      setError(plan.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await graphql(TRANSFER, plan);
      toast.success(unitIds.length > 1 ? `Propriétaire défini pour ${unitIds.length} unités` : 'Propriété enregistrée', {
        description: 'À partir du ' + formatDateFr(date),
      });
      onDone();
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field>
        <FieldLabel htmlFor="transfer-date">À partir du</FieldLabel>
        <Input id="transfer-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-48" />
        <FieldDescription>Les propriétaires actuels cessent de détenir l’unité la veille de cette date.</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Propriétaires à partir de cette date</FieldLegend>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement des contacts…</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">Impossible de charger les contacts : {contacts.message}</p>}
        {contacts.status === 'success' && <OwnersEditor value={owners} onChange={setOwners} options={contacts.data} />}
      </FieldSet>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving || !date || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
```

Create `web/src/components/ownership/add-coowner-dialog.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Pulse } from '@/components/motion/primitives';
import { ContactPicker } from '@/components/ownership/contact-picker';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatPercent, todayIso } from '@/lib/ownership';

const ADD_OWNERSHIP = `
  mutation AddOwnership($object: ownerships_insert_input!) {
    insert_ownerships_one(object: $object) { id }
  }
`;

type Props = { unitId: string; remaining: number; onDone: () => void };

export function AddCoOwnerDialog({ unitId, remaining, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const full = remaining <= 0.001;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={full} title={full ? 'Les parts atteignent déjà 100 %' : undefined}>
          <UserPlus data-icon="inline-start" />
          Ajouter un copropriétaire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un copropriétaire</DialogTitle>
          <DialogDescription>Part encore libre : {formatPercent(remaining)}.</DialogDescription>
        </DialogHeader>
        <CoOwnerForm
          unitId={unitId}
          remaining={remaining}
          onCancel={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CoOwnerForm({ unitId, remaining, onCancel, onDone }: { unitId: string; remaining: number; onCancel: () => void; onDone: () => void }) {
  const contacts = useContactOptions();
  const [contactId, setContactId] = useState<string | null>(null);
  const [share, setShare] = useState(Math.round(remaining * 100) / 100);
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contactId) return setError('Choisissez un contact.');
    if (!(share > 0) || share > remaining + 0.001) return setError(`La part doit être comprise entre 0 et ${formatPercent(remaining)}.`);
    setError(null);
    setSaving(true);
    try {
      await graphql(ADD_OWNERSHIP, { object: { unit_id: unitId, contact_id: contactId, share_percent: share, starts_on: date } });
      toast.success('Copropriétaire ajouté');
      onDone();
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field>
        <FieldLabel htmlFor="coowner-contact">Contact</FieldLabel>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement des contacts…</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">Impossible de charger les contacts : {contacts.message}</p>}
        {contacts.status === 'success' && (
          <ContactPicker id="coowner-contact" options={contacts.data} value={contactId} onChange={setContactId} invalid={error !== null && !contactId} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="coowner-share">Part</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="coowner-share"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={Number.isFinite(share) ? share : ''}
              onChange={(event) => setShare(event.target.valueAsNumber)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="coowner-date">À partir du</FieldLabel>
          <Input id="coowner-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <FieldDescription>Pour remplacer un propriétaire, utilisez plutôt « Transférer la propriété ».</FieldDescription>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Ajouter
        </Button>
      </DialogFooter>
    </form>
  );
}
```

- [ ] **Step 8: Run tests, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed (the new components are not used by a page yet; Task 9 uses them).

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ui/popover.tsx web/src/components/confirm-dialog.tsx web/src/components/ownership web/package.json web/package-lock.json
git commit -m "feat(ownership): contact picker, owners editor, transfer and co-owner dialogs"
```

---

### Task 9: Unit page with tabs and the "Propriétaires" tab

**Files:**
- Create: `web/src/components/ownership/unit-owners-tab.tsx`
- Modify: `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `useHash`, `useHashTab` (Task 5); `UnitDialog`, `UnitFormUnit` (Task 6); `TransferDialog`, `AddCoOwnerDialog`, `ConfirmDialog` (Task 8); `ownershipPhase`, `formatDateFr`, `formatPercent`, `todayIso`, `OwnershipRow` (Task 4); `useCanEdit`, `toFrenchError` (Task 3).
- Produces:
  - `UnitOwnersTab({ unitId }: { unitId: string })`
  - Unit page tabs `apercu`, `proprietaires` (Task 12 appends `photos`, `documents`); `#modifier` opens the edit dialog.

- [ ] **Step 1: Create the owners tab**

Create `web/src/components/ownership/unit-owners-tab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Pulse } from '@/components/motion/primitives';
import { AddCoOwnerDialog } from '@/components/ownership/add-coowner-dialog';
import { TransferDialog } from '@/components/ownership/transfer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatDateFr, formatPercent, ownershipPhase, todayIso, type OwnershipRow } from '@/lib/ownership';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query UnitOwnerships($unitId: uuid!) {
    ownerships(where: { unit_id: { _eq: $unitId } }, order_by: [{ starts_on: desc }]) {
      id unit_id contact_id share_percent starts_on ends_on notes
      contact { id full_name is_organization }
    }
  }
`;

const DELETE_OWNERSHIP = `
  mutation DeleteOwnership($id: uuid!) { delete_ownerships_by_pk(id: $id) { id } }
`;

type Row = OwnershipRow & { notes: string | null; contact: { id: string; full_name: string; is_organization: boolean } };

function OwnerLine({ row, detail, onDelete }: { row: Row; detail: string; onDelete?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link href={'/contacts/' + row.contact.id} className="font-medium hover:text-primary hover:underline">
          {row.contact.full_name}
        </Link>
        {row.contact.is_organization && (
          <Badge variant="secondary" className="ml-2">
            Votre société
          </Badge>
        )}
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{formatPercent(row.share_percent)}</span>
        {onDelete && (
          <Button variant="ghost" size="icon-sm" aria-label={'Supprimer la ligne de ' + row.contact.full_name} onClick={onDelete}>
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}

export function UnitOwnersTab({ unitId }: { unitId: string }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const result = useGraphql<{ ownerships: Row[] }>(QUERY, { unitId }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des propriétaires…</Pulse>;
  if (result.status === 'error') {
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Impossible de charger les propriétaires : {result.message}
      </p>
    );
  }

  const rows = result.data.ownerships;
  const today = todayIso();
  const current = rows.filter((row) => ownershipPhase(row, today) === 'current');
  const upcoming = rows.filter((row) => ownershipPhase(row, today) === 'upcoming');
  const past = rows.filter((row) => ownershipPhase(row, today) === 'past');
  const held = current.reduce((sum, row) => sum + Number(row.share_percent), 0);
  const askDelete = canEdit ? (row: Row) => () => setToDelete(row) : () => undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Propriétaires actuels</CardTitle>
          <CardDescription>
            {current.length === 0 ? 'Aucun propriétaire enregistré pour cette unité.' : 'Part totale détenue : ' + formatPercent(held)}
          </CardDescription>
          {canEdit && (
            <CardAction className="flex flex-wrap gap-2">
              {current.length > 0 && <AddCoOwnerDialog unitId={unitId} remaining={100 - held} onDone={refresh} />}
              <TransferDialog
                unitIds={[unitId]}
                rows={rows}
                title={current.length === 0 ? 'Définir le propriétaire' : 'Transférer la propriété'}
                description="Choisissez la date et les nouveaux propriétaires avec leur part. Le total doit faire 100 %."
                trigger={
                  <Button>
                    <ArrowRightLeft data-icon="inline-start" />
                    {current.length === 0 ? 'Définir le propriétaire' : 'Transférer la propriété'}
                  </Button>
                }
                onDone={refresh}
              />
            </CardAction>
          )}
        </CardHeader>
        {current.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {current.map((row) => (
                <OwnerLine key={row.id} row={row} detail={'Depuis le ' + formatDateFr(row.starts_on)} />
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">À venir</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {upcoming.map((row) => (
                <OwnerLine key={row.id} row={row} detail={'À partir du ' + formatDateFr(row.starts_on)} onDelete={canEdit ? askDelete(row) : undefined} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
          <CardDescription>Propriétaires précédents de l’unité.</CardDescription>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore d’historique.</p>
          ) : (
            <ul className="divide-y">
              {past.map((row) => (
                <OwnerLine
                  key={row.id}
                  row={row}
                  detail={'Du ' + formatDateFr(row.starts_on) + ' au ' + formatDateFr(row.ends_on as string)}
                  onDelete={canEdit ? askDelete(row) : undefined}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette ligne ?"
        description={
          toDelete
            ? `La détention de ${toDelete.contact.full_name} sera effacée de l’historique. À utiliser seulement pour corriger une erreur de saisie.`
            : ''
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await graphql(DELETE_OWNERSHIP, { id: toDelete.id });
            toast.success('Ligne supprimée');
            refresh();
          } catch (error) {
            toast.error('Suppression impossible', { description: toFrenchError(error) });
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the unit page with tabs**

Replace `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Banknote, DoorOpen, Layers, Loader2, Maximize2, Pencil, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/domain/badges';
import { UNIT_STATUSES, UNIT_TYPES } from '@/components/domain/labels';
import { UnitDialog, type UnitFormUnit } from '@/components/domain/unit-dialog';
import { HoverLift, Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { UnitOwnersTab } from '@/components/ownership/unit-owners-tab';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toFrenchError } from '@/lib/errors';
import { formatArea, formatTnd } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHash, useHashTab } from '@/lib/use-hash';

const UNIT_QUERY = `
  query Unit($id: uuid!) {
    unit: units_by_pk(id: $id) {
      id code type floor rooms surface_m2 rent_amount status archived_at
      property { id name }
    }
  }
`;

const UPDATE_UNIT = `
  mutation UpdateUnit($id: uuid!, $set: units_set_input!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const UNIT_TABS = ['apercu', 'proprietaires'] as const;

type UnitDetails = UnitFormUnit & { archived_at: string | null; property: { id: string; name: string } };

function Fact({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <HoverLift className="h-full rounded-xl">
      <Card className="h-full py-4">
        <CardContent className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}

export default function UnitDetailPage() {
  const { id, unitId } = useParams<{ id: string; unitId: string }>();
  const canEdit = useCanEdit();
  const [hash, setHash] = useHash();
  const [tab, setTab] = useHashTab(UNIT_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const result = useGraphql<{ unit: UnitDetails | null }>(UNIT_QUERY, { id: unitId }, reload);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={'/biens/' + id}>
        <ArrowLeft data-icon="inline-start" />
        Retour au bien
      </Link>
    </Button>
  );

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <Pulse className="text-sm text-muted-foreground">Chargement de l’unité…</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        {back}
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger cette unité : {result.message}
        </p>
      </div>
    );
  }

  const unit = result.data.unit;
  if (!unit) {
    return (
      <div className="space-y-6">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Unité introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou vous n’y avez pas accès.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = unit;
  const archived = current.archived_at !== null;

  async function update(set: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      await graphql(UPDATE_UNIT, { id: current.id, set });
      toast.success(success, { description: current.code });
      setReload((value) => value + 1);
    } catch (error) {
      toast.error('Modification impossible', { description: toFrenchError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={'/biens/' + current.property.id}>
            <ArrowLeft data-icon="inline-start" />
            Retour à {current.property.name}
          </Link>
        </Button>
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={'Unité ' + current.code}
          description={(UNIT_TYPES[current.type] ?? current.type) + ' · ' + current.property.name + (archived ? ' · Archivée' : '')}
          actions={
            <>
              <StatusBadge status={current.status} />
              {canEdit && (
                <>
                  <UnitDialog
                    propertyId={current.property.id}
                    unit={current}
                    open={hash === 'modifier'}
                    onOpenChange={(open) => setHash(open ? 'modifier' : tab)}
                    trigger={
                      <Button variant="outline">
                        <Pencil data-icon="inline-start" />
                        Modifier
                      </Button>
                    }
                    onSaved={() => setReload((value) => value + 1)}
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void update({ archived_at: archived ? null : new Date().toISOString() }, archived ? 'Unité restaurée' : 'Unité archivée')
                    }
                  >
                    {saving ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {archived ? 'Restaurer' : 'Archiver'}
                  </Button>
                </>
              )}
            </>
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof UNIT_TABS)[number])}>
          <TabsList>
            <TabsTrigger value="apercu">Aperçu</TabsTrigger>
            <TabsTrigger value="proprietaires">Propriétaires</TabsTrigger>
            {/* UNIT-TABS-TRIGGERS: Task 12 adds Photos and Documents here. */}
          </TabsList>

          <TabsContent value="apercu" className="space-y-6 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={Banknote} label="Loyer mensuel" value={formatTnd(current.rent_amount)} />
              <Fact icon={Maximize2} label="Surface" value={formatArea(current.surface_m2)} />
              <Fact icon={DoorOpen} label="Pièces" value={current.rooms === null ? '—' : String(current.rooms)} />
              <Fact icon={Layers} label="Étage" value={current.floor === null ? '—' : String(current.floor)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statut de l’unité</CardTitle>
                <CardDescription>Le statut suivra automatiquement les baux et les ventes. En attendant, vous pouvez le corriger ici.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={current.status} disabled={saving || archived || !canEdit} onValueChange={(value) => void update({ status: value }, 'Statut mis à jour')}>
                  <SelectTrigger className="w-full sm:w-64" aria-label="Statut de l’unité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_STATUSES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proprietaires" className="pt-4">
            <UnitOwnersTab unitId={current.id} />
          </TabsContent>
          {/* UNIT-TABS-CONTENT: Task 12 adds the Photos and Documents panels here. */}
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
```

- [ ] **Step 3: Lint, build, check in the browser**

Run: `npm run lint && npm run build`
Expected: both succeed.
In the browser on unit B-101:
1. "Propriétaires" tab → current: Hédi Ben Salem 100 % since 15/03/2026; history: Sté Foncière 01/01/2026 → 14/03/2026; the URL ends with `#proprietaires`.
2. "Transférer la propriété" → date = today, owners Hédi 50 % + Salma Gharbi 50 % → saved; current shows both; Hédi's previous line ended yesterday.
3. Transfer again with the same date → French error about the date (Review Focus 1).
4. "Ajouter un copropriétaire" is disabled at 100 %.
5. Open `/biens/<id>/unites/<B-101 id>#modifier` directly → the edit dialog opens; closing it keeps you on the page.
6. Sign in as a viewer (if available) → no Modifier/Archiver/Transférer buttons.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ownership/unit-owners-tab.tsx "web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx"
git commit -m "feat(units): tabs with owners, history, transfer and co-owners"
```

---

### Task 10: Bien page with tabs, owners summary, bulk owner, list owner column

**Files:**
- Create: `web/src/components/property/types.ts`
- Create: `web/src/components/property/property-overview.tsx`
- Create: `web/src/components/property/property-units-table.tsx`
- Modify: `web/src/app/(app)/biens/[id]/page.tsx` (full replacement)
- Modify: `web/src/app/(app)/biens/page.tsx` (owner column, owner filter, map link)

**Interfaces:**
- Consumes: `UnitDialog` (Task 6), `TransferDialog` (Task 8), `useHashTab` (Task 5), `OwnershipRow` (Task 4), `useCanEdit`, `toFrenchError` (Task 3).
- Produces:
  - `type PropertyUnit`, `type PropertyDetails` (below)
  - `PropertyOverview({ property, units }: { property: PropertyDetails; units: PropertyUnit[] })`
  - `PropertyUnitsTable({ propertyId, units, canEdit, onChanged }: { propertyId: string; units: PropertyUnit[]; canEdit: boolean; onChanged: () => void })`
  - Bien page tabs `apercu`, `unites` (+ `parties-communes` in Task 11, `photos`, `documents` in Task 12), anchors `{/* PROPERTY-TABS-TRIGGERS */}` and `{/* PROPERTY-TABS-CONTENT */}`.

- [ ] **Step 1: Shared types**

Create `web/src/components/property/types.ts`:

```ts
import type { OwnershipRow } from '@/lib/ownership';

export type PropertyUnit = {
  id: string;
  code: string;
  type: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
  status: string;
  archived_at: string | null;
  common_share: number | null;
  ownerships: OwnershipRow[];
  current_owners: { share_percent: number | string; contact: { id: string; full_name: string } }[];
};

export type PropertyDetails = {
  id: string;
  name: string;
  type: 'building' | 'house' | 'plot';
  address_line: string | null;
  city: string | null;
  governorate: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  archived_at: string | null;
  branch: { id: string; name: string } | null;
  owners: { units_count: number; contact: { id: string; full_name: string; is_organization: boolean } }[];
  units: PropertyUnit[];
};
```

- [ ] **Step 2: Overview tab**

Create `web/src/components/property/property-overview.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';
import { AnimatedNumber, GrowBar, HoverLift } from '@/components/motion/primitives';
import type { PropertyDetails, PropertyUnit } from '@/components/property/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatArea, formatTnd } from '@/lib/format';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HoverLift className="h-full rounded-xl">
      <Card className="h-full py-4">
        <CardContent className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="text-2xl font-semibold tabular-nums tracking-tight">{children}</div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}

export function PropertyOverview({ property, units }: { property: PropertyDetails; units: PropertyUnit[] }) {
  const rented = units.filter((unit) => unit.status === 'rented');
  const occupancy = units.length === 0 ? 0 : Math.round((rented.length / units.length) * 100);
  const rentTotal = rented.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
  const surfaceTotal = units.reduce((sum, unit) => sum + Number(unit.surface_m2 ?? 0), 0);
  const address = [property.address_line, property.postal_code, property.city, property.governorate].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unités">
          <AnimatedNumber value={units.length} />
        </Stat>
        <Stat label="Taux d’occupation">
          <AnimatedNumber value={occupancy} format={(n) => Math.round(n) + ' %'} />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <GrowBar percent={occupancy} className="bg-primary" />
          </div>
        </Stat>
        <Stat label="Loyers mensuels">{formatTnd(rentTotal)}</Stat>
        <Stat label="Surface totale">{formatArea(surfaceTotal)}</Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              Adresse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {address ? <p className="font-medium">{address}</p> : <p className="text-muted-foreground">Adresse non renseignée.</p>}
            {/* PROPERTY-MAP-PREVIEW: Task 13 adds the small map here. */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              Propriétaires
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {property.owners.length === 0 ? (
              <p className="text-muted-foreground">Aucun propriétaire enregistré. Définissez-le depuis l’onglet Unités.</p>
            ) : (
              <ul className="divide-y">
                {property.owners.map((owner) => (
                  <li key={owner.contact.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link href={'/contacts/' + owner.contact.id} className="font-medium hover:text-primary hover:underline">
                        {owner.contact.full_name}
                      </Link>
                      {owner.contact.is_organization && (
                        <Badge variant="secondary" className="ml-2">
                          Votre société
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {owner.units_count} unité{owner.units_count > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Units tab with owner column and bulk owner**

Create `web/src/components/property/property-units-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { StatusBadge } from '@/components/domain/badges';
import { UNIT_TYPES } from '@/components/domain/labels';
import { TransferDialog } from '@/components/ownership/transfer-dialog';
import type { PropertyUnit } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatArea, formatTnd } from '@/lib/format';

type Props = { propertyId: string; units: PropertyUnit[]; canEdit: boolean; onChanged: () => void };

function OwnerCell({ owners }: { owners: PropertyUnit['current_owners'] }) {
  if (owners.length === 0) return <span className="text-xs font-medium text-warning">Aucun</span>;
  const [first, ...others] = owners;
  return (
    <span className="text-sm">
      <Link href={'/contacts/' + first.contact.id} className="hover:text-primary hover:underline">
        {first.contact.full_name}
      </Link>
      {others.length > 0 && <span className="text-muted-foreground"> +{others.length}</span>}
    </span>
  );
}

export function PropertyUnitsTable({ propertyId, units, canEdit, onChanged }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const allIds = units.map((unit) => unit.id);
  const chosen = selected.filter((id) => allIds.includes(id));
  const targetIds = chosen.length > 0 ? chosen : allIds;
  const rows = units.flatMap((unit) => unit.ownerships);
  const headerState = chosen.length === 0 ? false : chosen.length === allIds.length ? true : 'indeterminate';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/30 py-4">
        <CardTitle className="text-base">Unités ({units.length})</CardTitle>
        {canEdit && units.length > 0 && (
          <CardAction>
            <TransferDialog
              unitIds={targetIds}
              rows={rows}
              title={chosen.length > 0 ? `Définir le propriétaire de ${chosen.length} unité(s)` : 'Définir le propriétaire de toutes les unités'}
              description="Les propriétaires actuels de ces unités cessent de les détenir la veille de la date choisie."
              trigger={
                <Button variant="outline" size="sm">
                  <Users data-icon="inline-start" />
                  {chosen.length > 0 ? `Définir le propriétaire (${chosen.length})` : 'Même propriétaire pour toutes'}
                </Button>
              }
              onDone={() => {
                setSelected([]);
                onChanged();
              }}
            />
          </CardAction>
        )}
      </CardHeader>
      {units.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-medium">Aucune unité pour ce bien</p>
          <p className="text-sm text-muted-foreground">Ajoutez les appartements, bureaux ou commerces pour suivre loyers, occupation et propriétaires.</p>
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canEdit && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Sélectionner toutes les unités"
                    checked={headerState}
                    onCheckedChange={(checked) => setSelected(checked === true ? allIds : [])}
                  />
                </TableHead>
              )}
              <TableHead className={canEdit ? '' : 'pl-4'}>Unité</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="hidden md:table-cell">Étage</TableHead>
              <TableHead className="hidden sm:table-cell">Surface</TableHead>
              <TableHead className="text-right">Loyer</TableHead>
              <TableHead className="pr-4">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id} data-state={chosen.includes(unit.id) ? 'selected' : undefined}>
                {canEdit && (
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={'Sélectionner ' + unit.code}
                      checked={chosen.includes(unit.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => (checked === true ? [...current, unit.id] : current.filter((id) => id !== unit.id)))
                      }
                    />
                  </TableCell>
                )}
                <TableCell className={canEdit ? '' : 'pl-4'}>
                  <Link href={'/biens/' + propertyId + '/unites/' + unit.id} className="font-medium hover:text-primary hover:underline">
                    {unit.code}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{UNIT_TYPES[unit.type] ?? unit.type}</span>
                </TableCell>
                <TableCell>
                  <OwnerCell owners={unit.current_owners} />
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{unit.floor ?? '—'}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{formatArea(unit.surface_m2)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatTnd(unit.rent_amount)}</TableCell>
                <TableCell className="pr-4">
                  <StatusBadge status={unit.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Rewrite the bien page with tabs**

Replace `web/src/app/(app)/biens/[id]/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Loader2, Pencil, Plus, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { PROPERTY_TYPES } from '@/components/domain/labels';
import { UnitDialog } from '@/components/domain/unit-dialog';
import { Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { PropertyOverview } from '@/components/property/property-overview';
import { PropertyUnitsTable } from '@/components/property/property-units-table';
import type { PropertyDetails } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHashTab } from '@/lib/use-hash';

const PROPERTY_QUERY = `
  query Property($id: uuid!) {
    property: properties_by_pk(id: $id) {
      id name type address_line city governorate postal_code latitude longitude archived_at
      branch { id name }
      owners(order_by: { units_count: desc }) { units_count contact { id full_name is_organization } }
      units(order_by: { code: asc }) {
        id code type floor rooms surface_m2 rent_amount status archived_at common_share
        ownerships { id unit_id contact_id share_percent starts_on ends_on }
        current_owners { share_percent contact { id full_name } }
      }
    }
  }
`;

const SET_ARCHIVED = `
  mutation SetPropertyArchived($id: uuid!, $archived_at: timestamptz) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

const PROPERTY_TABS = ['apercu', 'unites'] as const;
type PropertyTab = (typeof PROPERTY_TABS)[number];

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/biens">
        <ArrowLeft data-icon="inline-start" />
        Retour aux biens
      </Link>
    </Button>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [tab, setTab] = useHashTab(PROPERTY_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const result = useGraphql<{ property: PropertyDetails | null }>(PROPERTY_QUERY, { id }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">Chargement du bien…</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce bien : {result.message}
        </p>
      </div>
    );
  }

  const property = result.data.property;
  if (!property) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Bien introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou vous n’y avez pas accès.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = property;
  const archived = current.archived_at !== null;
  const units = current.units.filter((unit) => !unit.archived_at);

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: current.id, archived_at: archived ? null : new Date().toISOString() });
      toast.success(archived ? 'Bien restauré' : 'Bien archivé', { description: current.name });
      refresh();
    } catch (error) {
      toast.error('Action impossible', { description: toFrenchError(error) });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={current.name}
          description={
            (PROPERTY_TYPES[current.type] ?? current.type) +
            (current.branch ? ' · Succursale ' + current.branch.name : '') +
            (archived ? ' · Archivé' : '')
          }
          actions={
            canEdit && (
              <>
                <Button asChild variant="outline">
                  <Link href={'/biens/' + current.id + '/modifier'}>
                    <Pencil data-icon="inline-start" />
                    Modifier
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
                  {archiving ? (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  ) : archived ? (
                    <ArchiveRestore data-icon="inline-start" />
                  ) : (
                    <Archive data-icon="inline-start" />
                  )}
                  {archived ? 'Restaurer' : 'Archiver'}
                </Button>
                {!archived && current.type === 'building' && (
                  <UnitDialog
                    propertyId={current.id}
                    trigger={
                      <Button>
                        <Plus data-icon="inline-start" />
                        Ajouter une unité
                      </Button>
                    }
                    onSaved={refresh}
                  />
                )}
              </>
            )
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as PropertyTab)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="apercu">Aperçu</TabsTrigger>
            <TabsTrigger value="unites">Unités ({units.length})</TabsTrigger>
            {/* PROPERTY-TABS-TRIGGERS */}
          </TabsList>

          <TabsContent value="apercu" className="pt-4">
            <PropertyOverview property={current} units={units} />
          </TabsContent>
          <TabsContent value="unites" className="pt-4">
            <PropertyUnitsTable propertyId={current.id} units={units} canEdit={canEdit && !archived} onChanged={refresh} />
          </TabsContent>
          {/* PROPERTY-TABS-CONTENT */}
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
```

- [ ] **Step 5: Owner column, owner filter and map link on the biens list**

In `web/src/app/(app)/biens/page.tsx`:

1. Add `Map as MapIcon` to the `lucide-react` import list and `import { useCanEdit } from '@/lib/use-can-edit';`.
2. In `PROPERTIES_QUERY` replace

```
        status
        archived_at
      }
    }
  }
```

with

```
        status
        archived_at
        current_owners { contact { id full_name } }
      }
    }
  }
```

3. Replace

```ts
  archived_at: string | null;
};

type Property = {
```

with

```ts
  archived_at: string | null;
  current_owners: { contact: { id: string; full_name: string } }[];
};

type Property = {
```

4. Replace `  const [showArchived, setShowArchived] = useState(false);` with

```ts
  const [showArchived, setShowArchived] = useState(false);
  const [owner, setOwner] = useState('all');
  const canEdit = useCanEdit();
```

5. Replace

```ts
  const needle = search.trim().toLowerCase();
```

with

```ts
  const owners = [
    ...new Map(
      properties.flatMap((property) =>
        property.units.flatMap((unit) => unit.current_owners.map((item) => [item.contact.id, item.contact.full_name] as const)),
      ),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], 'fr'));

  const needle = search.trim().toLowerCase();
```

6. Replace

```ts
      units: property.units.filter((unit) => (showArchived || !unit.archived_at) && (status === 'all' || unit.status === status)),
    }))
    .filter(({ units }) => status === 'all' || units.length > 0);
```

with

```ts
      units: property.units.filter(
        (unit) =>
          (showArchived || !unit.archived_at) &&
          (status === 'all' || unit.status === status) &&
          (owner === 'all' || unit.current_owners.some((item) => item.contact.id === owner)),
      ),
    }))
    .filter(({ units }) => (status === 'all' && owner === 'all') || units.length > 0);
```

7. Replace `  const hasFilters = search !== '' || city !== 'all' || type !== 'all' || branch !== 'all' || status !== 'all' || showArchived;` with

```ts
  const hasFilters =
    search !== '' || city !== 'all' || type !== 'all' || branch !== 'all' || status !== 'all' || owner !== 'all' || showArchived;
```

8. Replace

```ts
    setStatus('all');
    setShowArchived(false);
```

with

```ts
    setStatus('all');
    setOwner('all');
    setShowArchived(false);
```

9. Replace the header actions

```tsx
          actions={
            <Button asChild>
              <Link href="/biens/nouveau">
                <Plus data-icon="inline-start" />
                Ajouter un bien
              </Link>
            </Button>
          }
```

with

```tsx
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/biens/carte">
                  <MapIcon data-icon="inline-start" />
                  Carte
                </Link>
              </Button>
              {canEdit && (
                <Button asChild>
                  <Link href="/biens/nouveau">
                    <Plus data-icon="inline-start" />
                    Ajouter un bien
                  </Link>
                </Button>
              )}
            </>
          }
```

10. Replace

```tsx
              <div className="flex items-center gap-2">
                <Checkbox id="archived"
```

with

```tsx
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="w-48" aria-label="Propriétaire">
                  <SelectValue placeholder="Propriétaire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les propriétaires</SelectItem>
                  {owners.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox id="archived"
```

11. Replace `                          <TableHead className="pl-4">Unité</TableHead>` with

```tsx
                          <TableHead className="pl-4">Unité</TableHead>
                          <TableHead className="hidden lg:table-cell">Propriétaire</TableHead>
```

12. Replace

```tsx
                              <span className="ml-2 text-xs text-muted-foreground">{UNIT_TYPES[unit.type] ?? unit.type}</span>
                            </TableCell>
```

with

```tsx
                              <span className="ml-2 text-xs text-muted-foreground">{UNIT_TYPES[unit.type] ?? unit.type}</span>
                            </TableCell>
                            <TableCell className="hidden text-sm lg:table-cell">
                              {unit.current_owners.length === 0 ? (
                                <span className="text-xs font-medium text-warning">Aucun</span>
                              ) : (
                                unit.current_owners.map((item) => item.contact.full_name).join(', ')
                              )}
                            </TableCell>
```

13. Replace `<TableCell colSpan={6}` with `<TableCell colSpan={7}`.

- [ ] **Step 6: Lint, build, check in the browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed.
In the browser: Résidence → Aperçu shows "Sté Foncière Carthage — 3 unités", "Hédi Ben Salem — 1 unité"; Unités tab shows owner column; tick B-102 and B-203 → "Définir le propriétaire (2)" → choose Salma Gharbi from today → both rows show Salma; `/biens` list: owner filter "Salma Gharbi" shows only those units; "Carte" button visible.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/property "web/src/app/(app)/biens/[id]/page.tsx" "web/src/app/(app)/biens/page.tsx"
git commit -m "feat(biens): tabs with owners summary, bulk owner and owner filter"
```

---

### Task 11: Common areas and thousandths

**Files:**
- Modify: `web/src/components/domain/labels.ts` (area kinds)
- Create: `web/src/components/common-areas/shares-table.tsx`, `web/src/components/common-areas/shares-table.test.tsx`
- Create: `web/src/components/common-areas/common-areas-list.tsx`
- Create: `web/src/components/common-areas/common-areas-tab.tsx`
- Modify: `web/src/app/(app)/biens/[id]/page.tsx` (tab)
- Modify: `web/src/app/(app)/biens/parties-communes/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `suggestShares`, `sharesTotal`, `SHARE_TOTAL` (Task 4); `ConfirmDialog` (Task 8); `useCanEdit`, `toFrenchError` (Task 3); `PropertyUnit` (Task 10).
- Produces:
  - `AREA_KINDS: Record<string, string>`
  - `type ShareUnit = { id: string; code: string; surface_m2: number | string | null; common_share: number | null }`
  - `SharesTable({ units, canEdit, onSaved })`, `CommonAreasList({ propertyId, areas, canEdit, onChanged })`, `CommonAreasTab({ propertyId, units, onUnitsChanged })`

- [ ] **Step 1: Add area kinds**

Append to `web/src/components/domain/labels.ts`:

```ts
export const AREA_KINDS: Record<string, string> = {
  stairs: 'Escaliers',
  lift: 'Ascenseur',
  garden: 'Jardin',
  roof: 'Toiture / terrasse',
  parking: 'Parking commun',
  other: 'Autre',
};
```

- [ ] **Step 2: Write the failing shares-table test**

Create `web/src/components/common-areas/shares-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SharesTable } from './shares-table';

const UNITS = [
  { id: 'a', code: 'A-1', surface_m2: 50, common_share: 500 },
  { id: 'b', code: 'B-1', surface_m2: '50.00', common_share: 400 },
];

describe('SharesTable', () => {
  it('shows a red total when the building does not reach 1000', () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    expect(screen.getByText('Total : 900 / 1000')).toHaveClass('text-destructive');
  });

  it('suggests thousandths from surfaces', async () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Proposer selon les surfaces' }));
    expect(screen.getByLabelText('Tantièmes de A-1')).toHaveValue('500');
    expect(screen.getByLabelText('Tantièmes de B-1')).toHaveValue('500');
    expect(screen.getByText('Total : 1000 / 1000')).toHaveClass('text-success');
  });

  it('flags a value above 1000 as invalid', async () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    const input = screen.getByLabelText('Tantièmes de A-1');
    await userEvent.clear(input);
    await userEvent.type(input, '1200');
    expect(screen.getByText('Valeurs entières de 0 à 1000 uniquement.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer les tantièmes' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/common-areas/shares-table.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the shares table**

Create `web/src/components/common-areas/shares-table.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toFrenchError } from '@/lib/errors';
import { formatArea } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { SHARE_TOTAL, sharesTotal, suggestShares } from '@/lib/shares';
import { cn } from '@/lib/utils';

const SAVE_SHARES = `
  mutation SaveShares($updates: [units_updates!]!) {
    update_units_many(updates: $updates) { affected_rows }
  }
`;

export type ShareUnit = { id: string; code: string; surface_m2: number | string | null; common_share: number | null };

type Parsed = number | null | 'invalid';

function parseShare(raw: string): Parsed {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return 'invalid';
  const value = Number(text);
  return value <= SHARE_TOTAL ? value : 'invalid';
}

const asText = (value: number | null) => (value === null ? '' : String(value));

export function SharesTable({ units, canEdit, onSaved }: { units: ShareUnit[]; canEdit: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(units.map((unit) => [unit.id, asText(unit.common_share)])),
  );
  const [saving, setSaving] = useState(false);

  const parsed = units.map((unit) => parseShare(draft[unit.id] ?? ''));
  const invalid = parsed.some((value) => value === 'invalid');
  const total = sharesTotal(parsed.map((value) => (typeof value === 'number' ? value : null)));
  const complete = !invalid && total === SHARE_TOTAL;
  const dirty = units.some((unit) => (draft[unit.id] ?? '') !== asText(unit.common_share));

  function suggest() {
    const shares = suggestShares(units.map((unit) => ({ id: unit.id, surface: unit.surface_m2 })));
    setDraft(Object.fromEntries(units.map((unit) => [unit.id, String(shares[unit.id])])));
  }

  async function save() {
    setSaving(true);
    try {
      await graphql(SAVE_SHARES, {
        updates: units.map((unit, index) => {
          const value = parsed[index];
          return { where: { id: { _eq: unit.id } }, _set: { common_share: typeof value === 'number' ? value : null } };
        }),
      });
      toast.success('Tantièmes enregistrés');
      onSaved();
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/30 py-4">
        <CardTitle className="text-base">Tantièmes des unités</CardTitle>
        <CardDescription>Part de chaque unité dans les parties communes, en millièmes. Le total doit faire 1000.</CardDescription>
        {canEdit && units.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={suggest}>
              <Sparkles data-icon="inline-start" />
              Proposer selon les surfaces
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {units.length === 0 ? (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Ajoutez d’abord les unités du bien.</CardContent>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Unité</TableHead>
                <TableHead>Surface</TableHead>
                <TableHead className="w-40 pr-4 text-right">Tantièmes (‰)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit, index) => (
                <TableRow key={unit.id}>
                  <TableCell className="pl-4 font-medium">{unit.code}</TableCell>
                  <TableCell className="tabular-nums">{formatArea(unit.surface_m2)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Input
                      aria-label={'Tantièmes de ' + unit.code}
                      inputMode="numeric"
                      className="ml-auto w-28 text-right tabular-nums"
                      value={draft[unit.id] ?? ''}
                      disabled={!canEdit}
                      aria-invalid={parsed[index] === 'invalid'}
                      onChange={(event) => setDraft((current) => ({ ...current, [unit.id]: event.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
            <div aria-live="polite" className="space-y-1">
              <p className={cn('text-sm font-semibold tabular-nums', complete ? 'text-success' : 'text-destructive')}>
                Total : {total} / {SHARE_TOTAL}
              </p>
              {invalid && <p className="text-xs text-destructive">Valeurs entières de 0 à 1000 uniquement.</p>}
            </div>
            {canEdit && (
              <Button onClick={() => void save()} disabled={saving || invalid || !dirty}>
                {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
                Enregistrer les tantièmes
              </Button>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/common-areas/shares-table.test.tsx`
Expected: 3 passed.

- [ ] **Step 6: Areas list and tab**

Create `web/src/components/common-areas/common-areas-list.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AREA_KINDS } from '@/components/domain/labels';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

const ADD_AREA = `mutation AddArea($object: common_areas_insert_input!) { insert_common_areas_one(object: $object) { id } }`;
const UPDATE_AREA = `mutation UpdateArea($id: uuid!, $set: common_areas_set_input!) { update_common_areas_by_pk(pk_columns: { id: $id }, _set: $set) { id } }`;
const DELETE_AREA = `mutation DeleteArea($id: uuid!) { delete_common_areas_by_pk(id: $id) { id } }`;

export type CommonArea = { id: string; name: string; kind: string; notes: string | null };

type Editing = { mode: 'create' } | { mode: 'edit'; area: CommonArea } | null;

export function CommonAreasList({
  propertyId,
  areas,
  canEdit,
  onChanged,
}: {
  propertyId: string;
  areas: CommonArea[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [toDelete, setToDelete] = useState<CommonArea | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parties communes</CardTitle>
        <CardDescription>Escaliers, ascenseur, jardin, toiture… partagés par les propriétaires de l’immeuble.</CardDescription>
        {canEdit && (
          <CardAction>
            <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
              <Plus data-icon="inline-start" />
              Ajouter
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune partie commune enregistrée.</p>
        ) : (
          <ul className="divide-y">
            {areas.map((area) => (
              <li key={area.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{area.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {AREA_KINDS[area.kind] ?? area.kind}
                    {area.notes ? ' · ' + area.notes : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={'Modifier ' + area.name} onClick={() => setEditing({ mode: 'edit', area })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={'Supprimer ' + area.name} onClick={() => setToDelete(area)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.mode === 'edit' ? 'Modifier la partie commune' : 'Ajouter une partie commune'}</DialogTitle>
            <DialogDescription>Nom, type et remarques éventuelles.</DialogDescription>
          </DialogHeader>
          {editing && (
            <AreaForm
              propertyId={propertyId}
              area={editing.mode === 'edit' ? editing.area : undefined}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette partie commune ?"
        description={toDelete ? `« ${toDelete.name} » sera retirée de l’immeuble.` : ''}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await graphql(DELETE_AREA, { id: toDelete.id });
            toast.success('Partie commune supprimée');
            onChanged();
          } catch (error) {
            toast.error('Suppression impossible', { description: toFrenchError(error) });
          }
        }}
      />
    </Card>
  );
}

function AreaForm({
  propertyId,
  area,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  area?: CommonArea;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(area?.name ?? '');
  const [kind, setKind] = useState(area?.kind ?? 'stairs');
  const [notes, setNotes] = useState(area?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return setError('Saisissez un nom.');
    setError(null);
    setSaving(true);
    const fields = { name: name.trim(), kind, notes: notes.trim() === '' ? null : notes.trim() };
    try {
      if (area) await graphql(UPDATE_AREA, { id: area.id, set: fields });
      else await graphql(ADD_AREA, { object: { ...fields, property_id: propertyId } });
      toast.success(area ? 'Partie commune mise à jour' : 'Partie commune ajoutée');
      onSaved();
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field data-invalid={error !== null && name.trim() === ''}>
        <FieldLabel htmlFor="area-name">Nom *</FieldLabel>
        <Input id="area-name" value={name} placeholder="Ex. Escaliers bloc B" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="area-kind">Type</FieldLabel>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger id="area-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(AREA_KINDS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="area-notes">Remarques</FieldLabel>
        <Textarea id="area-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
```

Create `web/src/components/common-areas/common-areas-tab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CommonAreasList, type CommonArea } from '@/components/common-areas/common-areas-list';
import { SharesTable, type ShareUnit } from '@/components/common-areas/shares-table';
import { Pulse } from '@/components/motion/primitives';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const AREAS_QUERY = `
  query CommonAreas($propertyId: uuid!) {
    common_areas(where: { property_id: { _eq: $propertyId } }, order_by: { name: asc }) { id name kind notes }
  }
`;

export function CommonAreasTab({
  propertyId,
  units,
  onUnitsChanged,
}: {
  propertyId: string;
  units: ShareUnit[];
  onUnitsChanged: () => void;
}) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const areas = useGraphql<{ common_areas: CommonArea[] }>(AREAS_QUERY, { propertyId }, reload);
  // A new key resets the draft once saved values come back from the server.
  const sharesKey = units.map((unit) => unit.id + ':' + unit.common_share).join('|');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {areas.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement des parties communes…</Pulse>}
      {areas.status === 'error' && <p role="alert" className="text-sm text-destructive">Impossible de charger les parties communes : {areas.message}</p>}
      {areas.status === 'success' && (
        <CommonAreasList propertyId={propertyId} areas={areas.data.common_areas} canEdit={canEdit} onChanged={() => setReload((value) => value + 1)} />
      )}
      <SharesTable key={sharesKey} units={units} canEdit={canEdit} onSaved={onUnitsChanged} />
    </div>
  );
}
```

- [ ] **Step 7: Add the tab to the bien page**

In `web/src/app/(app)/biens/[id]/page.tsx`:
- add `import { CommonAreasTab } from '@/components/common-areas/common-areas-tab';`
- replace `const PROPERTY_TABS = ['apercu', 'unites'] as const;` with `const PROPERTY_TABS = ['apercu', 'unites', 'parties-communes'] as const;`
- replace `            {/* PROPERTY-TABS-TRIGGERS */}` with

```tsx
            {/* PROPERTY-TABS-TRIGGERS */}
            {current.type === 'building' && <TabsTrigger value="parties-communes">Parties communes</TabsTrigger>}
```

- replace `          {/* PROPERTY-TABS-CONTENT */}` with

```tsx
          {/* PROPERTY-TABS-CONTENT */}
          {current.type === 'building' && (
            <TabsContent value="parties-communes" className="pt-4">
              <CommonAreasTab propertyId={current.id} units={units} onUnitsChanged={refresh} />
            </TabsContent>
          )}
```

- [ ] **Step 8: Replace the "Parties communes" placeholder page**

Replace `web/src/app/(app)/biens/parties-communes/page.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SHARE_TOTAL, sharesTotal } from '@/lib/shares';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query CommonAreasOverview {
    properties(where: { archived_at: { _is_null: true }, type: { _eq: "building" } }, order_by: { name: asc }) {
      id name city
      common_areas_aggregate { aggregate { count } }
      units(where: { archived_at: { _is_null: true } }) { common_share }
    }
  }
`;

type Row = {
  id: string;
  name: string;
  city: string | null;
  common_areas_aggregate: { aggregate: { count: number } | null };
  units: { common_share: number | null }[];
};

export default function CommonAreasOverviewPage() {
  const result = useGraphql<{ properties: Row[] }>(QUERY);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader title="Parties communes" description="Parties communes et tantièmes de chaque immeuble." />
      </StaggerItem>
      {result.status === 'loading' && <SkeletonList count={3} className="space-y-3" itemClassName="h-14 rounded-lg bg-muted" label="Chargement…" />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les immeubles : {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <StaggerItem>
          <Card className="gap-0 overflow-hidden py-0">
            {result.data.properties.length === 0 ? (
              <CardContent className="py-12 text-center text-sm text-muted-foreground">Aucun immeuble pour le moment.</CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Immeuble</TableHead>
                    <TableHead className="hidden sm:table-cell">Ville</TableHead>
                    <TableHead>Parties communes</TableHead>
                    <TableHead>Tantièmes</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.properties.map((property) => {
                    const total = sharesTotal(property.units.map((unit) => unit.common_share));
                    const complete = property.units.length < 2 || total === SHARE_TOTAL;
                    return (
                      <TableRow key={property.id}>
                        <TableCell className="pl-4 font-medium">{property.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{property.city ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{property.common_areas_aggregate.aggregate?.count ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={complete ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'}>
                            {complete ? 'Complets' : `${total} / ${SHARE_TOTAL}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={'/biens/' + property.id + '#parties-communes'}>
                              Ouvrir
                              <ChevronRight data-icon="inline-end" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </StaggerItem>
      )}
    </Stagger>
  );
}
```

- [ ] **Step 9: Tests, lint, build, browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed.
In the browser: Résidence → "Parties communes" tab lists Escaliers bloc B, Ascenseur, Jardin intérieur; shares total "Total : 1000 / 1000" (green); change B-101 to 200 → red "979 / 1000"; "Proposer selon les surfaces" → back to 1000; Enregistrer → toast. `/biens/parties-communes` shows Résidence "Complets" and the Belvédère row.

- [ ] **Step 10: Commit**

```bash
git add web/src/components/domain/labels.ts web/src/components/common-areas "web/src/app/(app)/biens/[id]/page.tsx" "web/src/app/(app)/biens/parties-communes/page.tsx"
git commit -m "feat(biens): common areas and thousandths per unit"
```

---

### Task 12: Photos and documents

**Files:**
- Create: `web/src/lib/files.ts`, `web/src/lib/files.test.ts`
- Create: `web/src/lib/upload.ts`, `web/src/lib/upload.test.ts`
- Create: `web/src/lib/storage.ts`
- Create: `web/src/components/files/file-drop.tsx`, `web/src/components/files/file-uploader.tsx`, `web/src/components/files/storage-image.tsx`, `web/src/components/files/photo-viewer.tsx`, `web/src/components/files/photo-gallery.tsx`, `web/src/components/files/document-list.tsx`
- Modify: `web/src/app/(app)/biens/[id]/page.tsx` (Photos, Documents tabs)
- Modify: `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx` (Photos, Documents tabs)
- Modify: `web/src/app/(app)/biens/page.tsx` (cover thumbnail)

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 8), `useCanEdit`, `toFrenchError` (Task 3), `nhost` from `web/src/lib/nhost.ts`, `graphql`.
- Produces:
  - `MAX_FILE_BYTES`, `type FileKind = 'photo' | 'document'`, `ACCEPT_ATTR`, `DOCUMENT_CATEGORIES`, `type DocumentCategory`, `validateFile(file, kind): string | null`, `titleFromFileName(name): string`
  - `type FileTarget = { propertyId: string } | { unitId: string }`, `fileTargetWhere(target, kind): Record<string, unknown>`, `type UploadDeps`, `uploadAndLink(file, target, meta, deps): Promise<void>`
  - `uploadToBucket`, `deleteStoredFile`, `presignedUrl`, `imageObjectUrl`, `downloadStoredFile`, `storageDeps`
  - `PhotoGallery({ target })`, `DocumentList({ target })`, `StorageImage({ fileId, width, alt, className })`

Note: deleting goes through the storage file (`deleteStoredFile`); the `property_files` row disappears by `on delete cascade`. Deleting the row first would remove the link that grants permission to delete the file.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, titleFromFileName, validateFile } from './files';

describe('validateFile', () => {
  it('accepts allowed types under 10 MB', () => {
    expect(validateFile({ name: 'a.jpg', size: 1000, type: 'image/jpeg' }, 'photo')).toBeNull();
    expect(validateFile({ name: 'acte.pdf', size: 1000, type: 'application/pdf' }, 'document')).toBeNull();
  });
  it('refuses a PDF as a photo', () => {
    expect(validateFile({ name: 'acte.pdf', size: 1000, type: 'application/pdf' }, 'photo')).toBe(
      'Format non accepté pour « acte.pdf » (JPG, PNG ou WebP).',
    );
  });
  it('refuses files above 10 MB and empty files', () => {
    expect(validateFile({ name: 'big.png', size: MAX_FILE_BYTES + 1, type: 'image/png' }, 'photo')).toBe(
      'Fichier trop lourd : « big.png » (max 10 Mo).',
    );
    expect(validateFile({ name: 'vide.png', size: 0, type: 'image/png' }, 'photo')).toBe('Fichier vide : « vide.png ».');
  });
});

describe('titleFromFileName', () => {
  it('turns a file name into a readable title', () => {
    expect(titleFromFileName('facade_nord-2026.jpg')).toBe('Facade nord 2026');
    expect(titleFromFileName('.png')).toBe('Sans titre');
  });
});
```

Create `web/src/lib/upload.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fileTargetWhere, uploadAndLink, type UploadDeps } from './upload';

const file = new File(['x'], 'facade.png', { type: 'image/png' });
const meta = { kind: 'photo' as const, category: null, title: 'Facade', sortOrder: 3 };

function deps(over: Partial<UploadDeps> = {}): UploadDeps {
  return {
    upload: vi.fn().mockResolvedValue('file-1'),
    remove: vi.fn().mockResolvedValue(undefined),
    link: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('uploadAndLink', () => {
  it('uploads then links the file to a bien', async () => {
    const d = deps();
    await uploadAndLink(file, { propertyId: 'p1' }, meta, d);
    expect(d.link).toHaveBeenCalledWith({
      property_id: 'p1',
      storage_file_id: 'file-1',
      kind: 'photo',
      category: null,
      title: 'Facade',
      sort_order: 3,
    });
    expect(d.remove).not.toHaveBeenCalled();
  });

  it('defaults a document category to "other" and links to a unit', async () => {
    const d = deps();
    await uploadAndLink(file, { unitId: 'u1' }, { ...meta, kind: 'document' }, d);
    expect(d.link).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 'u1', kind: 'document', category: 'other' }));
  });

  it('deletes the stored file when linking fails, and rethrows the original error', async () => {
    const failure = new Error('permission denied');
    const d = deps({ link: vi.fn().mockRejectedValue(failure), remove: vi.fn().mockRejectedValue(new Error('also down')) });
    await expect(uploadAndLink(file, { propertyId: 'p1' }, meta, d)).rejects.toBe(failure);
    expect(d.remove).toHaveBeenCalledWith('file-1');
  });
});

describe('fileTargetWhere', () => {
  it('filters by kind and target', () => {
    expect(fileTargetWhere({ propertyId: 'p1' }, 'photo')).toEqual({ kind: { _eq: 'photo' }, property_id: { _eq: 'p1' } });
    expect(fileTargetWhere({ unitId: 'u1' }, 'document')).toEqual({ kind: { _eq: 'document' }, unit_id: { _eq: 'u1' } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/files.test.ts src/lib/upload.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement files and upload logic**

Create `web/src/lib/files.ts`:

```ts
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileKind = 'photo' | 'document';

const ACCEPTED: Record<FileKind, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'image/jpeg', 'image/png'],
};

const FORMATS: Record<FileKind, string> = { photo: 'JPG, PNG ou WebP', document: 'PDF, JPG ou PNG' };

export const ACCEPT_ATTR: Record<FileKind, string> = {
  photo: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  document: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
};

export const DOCUMENT_CATEGORIES = {
  title_deed: 'Titre foncier',
  plan: 'Plans',
  certificate: 'Certificats',
  contract: 'Contrats',
  other: 'Autres',
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export function formatsLabel(kind: FileKind): string {
  return FORMATS[kind];
}

export function validateFile(file: { name: string; size: number; type: string }, kind: FileKind): string | null {
  if (!ACCEPTED[kind].includes(file.type)) return `Format non accepté pour « ${file.name} » (${FORMATS[kind]}).`;
  if (file.size === 0) return `Fichier vide : « ${file.name} ».`;
  if (file.size > MAX_FILE_BYTES) return `Fichier trop lourd : « ${file.name} » (max 10 Mo).`;
  return null;
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Sans titre';
}
```

Create `web/src/lib/upload.ts`:

```ts
import type { DocumentCategory, FileKind } from '@/lib/files';

export type FileTarget = { propertyId: string } | { unitId: string };

export type UploadDeps = {
  upload: (file: File) => Promise<string>;
  remove: (storageFileId: string) => Promise<void>;
  link: (object: Record<string, unknown>) => Promise<void>;
};

export type UploadMeta = { kind: FileKind; category: DocumentCategory | null; title: string; sortOrder: number };

const targetColumns = (target: FileTarget) =>
  'propertyId' in target ? { property_id: target.propertyId } : { unit_id: target.unitId };

export function fileTargetWhere(target: FileTarget, kind: FileKind): Record<string, unknown> {
  const columns = targetColumns(target);
  return {
    kind: { _eq: kind },
    ...Object.fromEntries(Object.entries(columns).map(([column, value]) => [column, { _eq: value }])),
  };
}

/** Stores the file, then links it to the bien or unit; removes the stored file if the link fails. */
export async function uploadAndLink(file: File, target: FileTarget, meta: UploadMeta, deps: UploadDeps): Promise<void> {
  const storageFileId = await deps.upload(file);
  try {
    await deps.link({
      ...targetColumns(target),
      storage_file_id: storageFileId,
      kind: meta.kind,
      category: meta.kind === 'document' ? (meta.category ?? 'other') : null,
      title: meta.title,
      sort_order: meta.sortOrder,
    });
  } catch (error) {
    await deps.remove(storageFileId).catch(() => undefined);
    throw error;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/files.test.ts src/lib/upload.test.ts`
Expected: all pass.

- [ ] **Step 5: Storage wrapper**

Create `web/src/lib/storage.ts`:

```ts
import { graphql } from '@/lib/graphql';
import { nhost } from '@/lib/nhost';
import type { UploadDeps } from '@/lib/upload';

export const BUCKET = 'property-files';

const LINK_FILE = `
  mutation LinkFile($object: property_files_insert_input!) {
    insert_property_files_one(object: $object) { id }
  }
`;

export async function uploadToBucket(file: File): Promise<string> {
  const response = await nhost.storage.uploadFiles({ 'bucket-id': BUCKET, 'file[]': [file] });
  const id = response.body.processedFiles[0]?.id;
  if (!id) throw new Error('Le fichier n’a pas pu être envoyé.');
  return id;
}

export async function deleteStoredFile(id: string): Promise<void> {
  await nhost.storage.deleteFile(id);
}

export async function presignedUrl(id: string): Promise<string> {
  const response = await nhost.storage.getFilePresignedURL(id);
  return response.body.url;
}

/** Resized image as a local object URL (private files cannot be used directly in <img src>). */
export async function imageObjectUrl(id: string, width: number): Promise<string> {
  const response = await nhost.storage.getFile(id, { w: width, q: 80 });
  return URL.createObjectURL(response.body);
}

export async function downloadStoredFile(id: string, fileName: string): Promise<void> {
  const response = await nhost.storage.getFile(id);
  const url = URL.createObjectURL(response.body);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const storageDeps: UploadDeps = {
  upload: uploadToBucket,
  remove: deleteStoredFile,
  link: async (object) => {
    await graphql(LINK_FILE, { object });
  },
};
```

- [ ] **Step 6: Drop zone, uploader, image**

Create `web/src/components/files/file-drop.tsx`:

```tsx
'use client';

import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTR, formatsLabel, type FileKind } from '@/lib/files';
import { cn } from '@/lib/utils';

export function FileDrop({ kind, disabled = false, onFiles }: { kind: FileKind; disabled?: boolean; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const inputId = useId();

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        over ? 'border-primary bg-accent/50' : 'hover:bg-muted/50',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <Upload className="size-6 text-muted-foreground" aria-hidden />
      <span className="font-medium">Déposez vos fichiers ici ou cliquez pour choisir</span>
      <span className="text-xs text-muted-foreground">{formatsLabel(kind)} · 10 Mo maximum par fichier</span>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTR[kind]}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </label>
  );
}
```

Create `web/src/components/files/file-uploader.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { FileDrop } from '@/components/files/file-drop';
import { toFrenchError } from '@/lib/errors';
import { titleFromFileName, validateFile, type DocumentCategory, type FileKind } from '@/lib/files';
import { storageDeps } from '@/lib/storage';
import { uploadAndLink, type FileTarget } from '@/lib/upload';

type Item = { key: string; name: string; status: 'waiting' | 'sending' | 'done' | 'error'; message?: string };

type Props = {
  target: FileTarget;
  kind: FileKind;
  category?: DocumentCategory;
  nextSortOrder: number;
  onUploaded: () => void;
};

export function FileUploader({ target, kind, category, nextSortOrder, onUploaded }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((item) => item.status === 'waiting' || item.status === 'sending');
  const setStatus = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function handle(files: File[]) {
    const queue = files.map((file, index) => ({ file, key: `${Date.now()}-${index}-${file.name}`, error: validateFile(file, kind) }));
    setItems(queue.map((entry) => ({ key: entry.key, name: entry.file.name, status: entry.error ? 'error' : 'waiting', message: entry.error ?? undefined })));

    let order = nextSortOrder;
    let uploaded = 0;
    for (const entry of queue) {
      if (entry.error) continue;
      setStatus(entry.key, { status: 'sending' });
      try {
        await uploadAndLink(
          entry.file,
          target,
          { kind, category: category ?? null, title: titleFromFileName(entry.file.name), sortOrder: order },
          storageDeps,
        );
        order += 1;
        uploaded += 1;
        setStatus(entry.key, { status: 'done' });
      } catch (error) {
        setStatus(entry.key, { status: 'error', message: toFrenchError(error) });
      }
    }
    if (uploaded > 0) {
      toast.success(uploaded > 1 ? `${uploaded} fichiers ajoutés` : 'Fichier ajouté');
      onUploaded();
    }
  }

  return (
    <div className="space-y-3">
      <FileDrop kind={kind} disabled={busy} onFiles={(files) => void handle(files)} />
      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {item.status === 'waiting' && 'En attente'}
                  {item.status === 'sending' && 'Envoi…'}
                  {item.status === 'done' && (
                    <>
                      <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Envoyé
                    </>
                  )}
                  {item.status === 'error' && (
                    <>
                      <CircleAlert className="size-3.5 text-destructive" aria-hidden /> Échec
                    </>
                  )}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    item.status === 'done'
                      ? 'h-full w-full bg-success'
                      : item.status === 'sending'
                        ? 'h-full w-1/2 animate-pulse bg-primary'
                        : item.status === 'error'
                          ? 'h-full w-full bg-destructive'
                          : 'h-full w-0'
                  }
                />
              </div>
              {item.message && <p className="text-xs text-destructive">{item.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

The Nhost client gives no upload progress events, so each file shows its state (waiting, sending, sent, failed) with an activity bar instead of a percentage.

Create `web/src/components/files/storage-image.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { imageObjectUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

type Loaded = { fileId: string; width: number; url: string | null };

export function StorageImage({ fileId, width, alt, className }: { fileId: string; width: number; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    imageObjectUrl(fileId, width)
      .then((url) => {
        objectUrl = url;
        if (active) setLoaded({ fileId, width, url });
        else URL.revokeObjectURL(url);
      })
      .catch(() => active && setLoaded({ fileId, width, url: null }));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, width]);

  const current = loaded && loaded.fileId === fileId && loaded.width === width ? loaded : null;
  if (!current) return <div role="img" aria-label={alt} className={cn('animate-pulse bg-muted', className)} />;
  if (!current.url) {
    return (
      <div role="img" aria-label={alt} className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL of a private file; next/image cannot optimise it
  return <img src={current.url} alt={alt} className={className} />;
}
```

- [ ] **Step 7: Gallery, viewer and documents**

Create `web/src/components/files/photo-viewer.tsx`:

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StorageImage } from '@/components/files/storage-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Photo = { id: string; storage_file_id: string; title: string };

export function PhotoViewer({
  photos,
  index,
  onIndexChange,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const photo = index === null ? undefined : photos[index];
  const go = (step: number) => index !== null && onIndexChange((index + step + photos.length) % photos.length);

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-w-5xl gap-3 p-3 sm:max-w-5xl"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(1);
          if (event.key === 'ArrowLeft') go(-1);
        }}
      >
        {photo && index !== null && (
          <>
            <DialogTitle className="pr-8 text-base">{photo.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Photo {index + 1} sur {photos.length}. Flèches gauche et droite pour naviguer.
            </DialogDescription>
            <StorageImage fileId={photo.storage_file_id} width={1600} alt={photo.title} className="max-h-[75vh] w-full rounded-md bg-black object-contain" />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={photos.length < 2}>
                <ChevronLeft data-icon="inline-start" />
                Précédente
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {index + 1} / {photos.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => go(1)} disabled={photos.length < 2}>
                Suivante
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Create `web/src/components/files/photo-gallery.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FileUploader } from '@/components/files/file-uploader';
import { PhotoViewer } from '@/components/files/photo-viewer';
import { StorageImage } from '@/components/files/storage-image';
import { Pulse } from '@/components/motion/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { deleteStoredFile } from '@/lib/storage';
import { fileTargetWhere, type FileTarget } from '@/lib/upload';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const PHOTOS_QUERY = `
  query Photos($where: property_files_bool_exp!) {
    property_files(where: $where, order_by: [{ sort_order: asc }, { created_at: asc }]) {
      id storage_file_id title is_cover sort_order
    }
  }
`;

const SET_COVER = `
  mutation SetCover($others: property_files_bool_exp!, $id: uuid!) {
    update_property_files(where: $others, _set: { is_cover: false }) { affected_rows }
    update_property_files_by_pk(pk_columns: { id: $id }, _set: { is_cover: true }) { id }
  }
`;

const SWAP_ORDER = `
  mutation SwapOrder($a: uuid!, $aOrder: Int!, $b: uuid!, $bOrder: Int!) {
    first: update_property_files_by_pk(pk_columns: { id: $a }, _set: { sort_order: $aOrder }) { id }
    second: update_property_files_by_pk(pk_columns: { id: $b }, _set: { sort_order: $bOrder }) { id }
  }
`;

type Photo = { id: string; storage_file_id: string; title: string; is_cover: boolean; sort_order: number };

export function PhotoGallery({ target }: { target: FileTarget }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const where = fileTargetWhere(target, 'photo');
  const result = useGraphql<{ property_files: Photo[] }>(PHOTOS_QUERY, { where }, reload);
  const refresh = () => setReload((value) => value + 1);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (error) {
      toast.error('Action impossible', { description: toFrenchError(error) });
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des photos…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les photos : {result.message}</p>;
  const photos = result.data.property_files;

  return (
    <div className="space-y-4">
      {canEdit && <FileUploader target={target} kind="photo" nextSortOrder={photos.length} onUploaded={refresh} />}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <ImageIcon className="size-6" aria-hidden />
          Aucune photo pour le moment.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg border bg-card">
              <button type="button" onClick={() => setViewer(index)} className="block aspect-[4/3] w-full" aria-label={'Agrandir ' + photo.title}>
                <StorageImage fileId={photo.storage_file_id} width={480} alt={photo.title} className="size-full object-cover" />
              </button>
              {photo.is_cover && <Badge className="absolute left-2 top-2">Couverture</Badge>}
              <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                <span className="truncate text-xs">{photo.title}</span>
                {canEdit && (
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Utiliser ' + photo.title + ' comme couverture'}
                      disabled={photo.is_cover}
                      onClick={() =>
                        void run(() => graphql(SET_COVER, { others: { ...where, is_cover: { _eq: true } }, id: photo.id }), 'Photo de couverture définie')
                      }
                    >
                      <Star />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Déplacer ' + photo.title + ' vers la gauche'}
                      disabled={index === 0}
                      onClick={() =>
                        void run(
                          () => graphql(SWAP_ORDER, { a: photo.id, aOrder: index - 1, b: photos[index - 1].id, bOrder: index }),
                          'Ordre mis à jour',
                        )
                      }
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Déplacer ' + photo.title + ' vers la droite'}
                      disabled={index === photos.length - 1}
                      onClick={() =>
                        void run(
                          () => graphql(SWAP_ORDER, { a: photo.id, aOrder: index + 1, b: photos[index + 1].id, bOrder: index }),
                          'Ordre mis à jour',
                        )
                      }
                    >
                      <ChevronRight />
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={'Supprimer ' + photo.title} onClick={() => setToDelete(photo)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <PhotoViewer photos={photos} index={viewer} onIndexChange={setViewer} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette photo ?"
        description={toDelete ? `« ${toDelete.title} » sera supprimée définitivement.` : ''}
        onConfirm={async () => {
          if (toDelete) await run(() => deleteStoredFile(toDelete.storage_file_id), 'Photo supprimée');
        }}
      />
    </div>
  );
}
```

Create `web/src/components/files/document-list.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FileUploader } from '@/components/files/file-uploader';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/lib/files';
import { deleteStoredFile, downloadStoredFile, presignedUrl } from '@/lib/storage';
import { fileTargetWhere, type FileTarget } from '@/lib/upload';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const DOCUMENTS_QUERY = `
  query Documents($where: property_files_bool_exp!) {
    property_files(where: $where, order_by: [{ created_at: desc }]) { id storage_file_id title category created_at }
  }
`;

type Doc = { id: string; storage_file_id: string; title: string; category: DocumentCategory; created_at: string };

const dateFormat = new Intl.DateTimeFormat('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function DocumentList({ target }: { target: FileTarget }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<DocumentCategory>('title_deed');
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const result = useGraphql<{ property_files: Doc[] }>(DOCUMENTS_QUERY, { where: fileTargetWhere(target, 'document') }, reload);
  const refresh = () => setReload((value) => value + 1);

  async function openDocument(doc: Doc) {
    // Open the tab during the click, then point it at the signed link (avoids popup blockers).
    const tab = window.open('', '_blank');
    try {
      const url = await presignedUrl(doc.storage_file_id);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      }
    } catch (error) {
      tab?.close();
      toast.error('Ouverture impossible', { description: toFrenchError(error) });
    }
  }

  async function download(doc: Doc) {
    try {
      await downloadStoredFile(doc.storage_file_id, doc.title);
    } catch (error) {
      toast.error('Téléchargement impossible', { description: toFrenchError(error) });
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des documents…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les documents : {result.message}</p>;
  const docs = result.data.property_files;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajouter des documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="max-w-xs">
              <FieldLabel htmlFor="document-category">Catégorie</FieldLabel>
              <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
                <SelectTrigger id="document-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FileUploader target={target} kind="document" category={category} nextSortOrder={docs.length} onUploaded={refresh} />
          </CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <FileText className="size-6" aria-hidden />
          Aucun document pour le moment.
        </div>
      ) : (
        (Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[])
          .filter((key) => docs.some((doc) => doc.category === key))
          .map((key) => (
            <Card key={key} className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">{DOCUMENT_CATEGORIES[key]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {docs
                    .filter((doc) => doc.category === key)
                    .map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate text-sm font-medium">{doc.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(new Date(doc.created_at))}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={'Ouvrir ' + doc.title} onClick={() => void openDocument(doc)}>
                            <ExternalLink />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={'Télécharger ' + doc.title} onClick={() => void download(doc)}>
                            <Download />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon-sm" aria-label={'Supprimer ' + doc.title} onClick={() => setToDelete(doc)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer ce document ?"
        description={toDelete ? `« ${toDelete.title} » sera supprimé définitivement.` : ''}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteStoredFile(toDelete.storage_file_id);
            toast.success('Document supprimé');
            refresh();
          } catch (error) {
            toast.error('Suppression impossible', { description: toFrenchError(error) });
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 8: Add the tabs to the bien and unit pages, and the cover on the list**

In `web/src/app/(app)/biens/[id]/page.tsx`:
- add imports `import { DocumentList } from '@/components/files/document-list';` and `import { PhotoGallery } from '@/components/files/photo-gallery';`
- replace `const PROPERTY_TABS = ['apercu', 'unites', 'parties-communes'] as const;` with `const PROPERTY_TABS = ['apercu', 'unites', 'photos', 'documents', 'parties-communes'] as const;`
- replace `            {/* PROPERTY-TABS-TRIGGERS */}` with

```tsx
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
```

- replace `          {/* PROPERTY-TABS-CONTENT */}` with

```tsx
          <TabsContent value="photos" className="pt-4">
            <PhotoGallery target={{ propertyId: current.id }} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <DocumentList target={{ propertyId: current.id }} />
          </TabsContent>
```

In `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx`:
- add the same two imports;
- replace `const UNIT_TABS = ['apercu', 'proprietaires'] as const;` with `const UNIT_TABS = ['apercu', 'proprietaires', 'photos', 'documents'] as const;`
- replace `            {/* UNIT-TABS-TRIGGERS: Task 12 adds Photos and Documents here. */}` with

```tsx
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
```

- replace `          {/* UNIT-TABS-CONTENT: Task 12 adds the Photos and Documents panels here. */}` with

```tsx
          <TabsContent value="photos" className="pt-4">
            <PhotoGallery target={{ unitId: current.id }} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <DocumentList target={{ unitId: current.id }} />
          </TabsContent>
```

In `web/src/app/(app)/biens/page.tsx`:
- add `import { StorageImage } from '@/components/files/storage-image';`
- in `PROPERTIES_QUERY` replace

```
      city
      archived_at
      branch { id name }
```

with

```
      city
      archived_at
      branch { id name }
      files(where: { is_cover: { _eq: true } }, limit: 1) { storage_file_id }
```

- replace

```ts
  branch: { id: string; name: string } | null;
  units: Unit[];
```

with

```ts
  branch: { id: string; name: string } | null;
  files: { storage_file_id: string }[];
  units: Unit[];
```

- replace

```tsx
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Building2 className="size-5" />
                        </span>
```

with

```tsx
                        {property.files[0] ? (
                          <StorageImage
                            fileId={property.files[0].storage_file_id}
                            width={96}
                            alt={'Photo de ' + property.name}
                            className="size-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                            <Building2 className="size-5" />
                          </span>
                        )}
```

- [ ] **Step 9: Tests, lint, build, browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed.
In the browser (signed in as manager): Résidence → Photos → drop two JPGs → both appear with "Envoyé"; star one → "Couverture" badge, and `/biens` shows it as the thumbnail; move right/left changes order after reload; click a photo → viewer, arrow keys switch photos; drop a PDF → "Format non accepté…" and nothing uploaded. Documents → choose "Titre foncier", drop a PDF → listed under "Titre foncier"; "Ouvrir" opens it in a new tab; "Télécharger" saves it; delete → gone. Unit B-101 → Photos/Documents tabs work the same.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/files.ts web/src/lib/files.test.ts web/src/lib/upload.ts web/src/lib/upload.test.ts web/src/lib/storage.ts web/src/components/files "web/src/app/(app)/biens"
git commit -m "feat(biens): photos and documents for biens and units"
```

---

### Task 13: Map — address search, pin placement, map of biens

**Files:**
- Modify: `web/package.json` (leaflet, react-leaflet, @types/leaflet)
- Create: `web/src/lib/map-config.ts`
- Create: `web/src/lib/geocode.ts`, `web/src/lib/geocode.test.ts`
- Create: `web/src/components/map/pin.ts`, `web/src/components/map/location-picker-inner.tsx`, `web/src/components/map/properties-map-inner.tsx`, `web/src/components/map/index.tsx`, `web/src/components/map/location-field.tsx`
- Modify: `web/src/components/domain/property-form.tsx` (location field)
- Modify: `web/src/components/property/property-overview.tsx` (map preview)
- Modify: `web/src/app/(app)/biens/carte/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `occupancyLevel`, `OCCUPANCY`, `OccupancyLevel` (Task 4).
- Produces:
  - `TILE_URL`, `TILE_ATTRIBUTION`, `TUNISIA_CENTER: [number, number]`, `TUNISIA_ZOOM`, `DETAIL_ZOOM`
  - `type GeocodeResult = { label: string; lat: number; lon: number }`, `buildGeocodeUrl(query): string`, `geocodeAddress(query, fetcher?): Promise<GeocodeResult[]>`, `addressQuery(parts): string`, `type LatLon = { lat: number; lon: number }`, `roundPosition(value: LatLon): LatLon`
  - `LocationPicker({ value, onChange?, className? })`, `PropertiesMap({ points, className? })`, `type MapPoint`, `LocationField({ query, latitude, longitude, onChange })`

- [ ] **Step 1: Install the map packages**

Run (in `web/`):

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

- [ ] **Step 2: Write the failing geocoding test**

Create `web/src/lib/geocode.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { addressQuery, buildGeocodeUrl, geocodeAddress, roundPosition } from './geocode';

const okResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('buildGeocodeUrl', () => {
  it('limits the search to Tunisia, 5 results, French labels', () => {
    const url = new URL(buildGeocodeUrl('Avenue Habib Bourguiba, Carthage'));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('countrycodes')).toBe('tn');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('accept-language')).toBe('fr');
    expect(url.searchParams.get('q')).toBe('Avenue Habib Bourguiba, Carthage');
  });
});

describe('geocodeAddress', () => {
  it('parses results', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse([{ display_name: 'Carthage, Tunis', lat: '36.8528', lon: '10.3233' }]));
    await expect(geocodeAddress('Carthage', fetcher)).resolves.toEqual([{ label: 'Carthage, Tunis', lat: 36.8528, lon: 10.3233 }]);
  });
  it('returns no result when the service refuses (HTTP 429) or is unreachable', async () => {
    await expect(geocodeAddress('Carthage', vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })))).resolves.toEqual([]);
    await expect(geocodeAddress('Carthage', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).resolves.toEqual([]);
  });
  it('skips malformed rows and too-short queries', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse([{ display_name: 'x', lat: 'n/a', lon: '1' }, { foo: 1 }]));
    await expect(geocodeAddress('Carthage', fetcher)).resolves.toEqual([]);
    const unused = vi.fn();
    await expect(geocodeAddress('ab', unused)).resolves.toEqual([]);
    expect(unused).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('joins address parts and rounds positions to 6 decimals', () => {
    expect(addressQuery([' 14 Rue des Jardins ', '', null, 'Carthage'])).toBe('14 Rue des Jardins, Carthage');
    expect(roundPosition({ lat: 36.85280049, lon: 10.32331951 })).toEqual({ lat: 36.8528, lon: 10.32332 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/geocode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement map config and geocoding**

Create `web/src/lib/map-config.ts`:

```ts
// The single place that knows the map provider; swap these to change tiles later.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const TUNISIA_CENTER: [number, number] = [34.0, 9.6];
export const TUNISIA_ZOOM = 6;
export const DETAIL_ZOOM = 16;
```

Create `web/src/lib/geocode.ts`:

```ts
// Address search through OpenStreetMap Nominatim, used only on an explicit click
// (fair-use policy: no per-keystroke requests). Any failure means "no result":
// staff then place the pin by hand.

export type GeocodeResult = { label: string; lat: number; lon: number };
export type LatLon = { lat: number; lon: number };
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export function buildGeocodeUrl(query: string): string {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'tn', limit: '5', 'accept-language': 'fr' });
  return `${ENDPOINT}?${params.toString()}`;
}

export async function geocodeAddress(
  query: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<GeocodeResult[]> {
  const term = query.trim();
  if (term.length < 3) return [];
  let response: Response;
  try {
    response = await fetcher(buildGeocodeUrl(term), { headers: { Accept: 'application/json' } });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((item: { display_name?: unknown; lat?: unknown; lon?: unknown }) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      return typeof item?.display_name === 'string' && Number.isFinite(lat) && Number.isFinite(lon)
        ? [{ label: item.display_name, lat, lon }]
        : [];
    })
    .slice(0, 5);
}

export function addressQuery(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/** The database stores positions as numeric(9,6). */
export function roundPosition(value: LatLon): LatLon {
  return { lat: Math.round(value.lat * 1e6) / 1e6, lon: Math.round(value.lon * 1e6) / 1e6 };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/geocode.test.ts`
Expected: all pass.

- [ ] **Step 6: Map components**

Create `web/src/components/map/pin.ts`:

```ts
import L from 'leaflet';

/** Coloured map pin drawn in SVG (Leaflet's default image icons break with bundlers). */
export function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 36 14 36s14-11.7 14-22.1C28 6.2 21.7 0 14 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/><circle cx="14" cy="14" r="5.5" fill="#ffffff"/></svg>`,
  });
}
```

Create `web/src/components/map/location-picker-inner.tsx`:

```tsx
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { pinIcon } from '@/components/map/pin';
import type { LatLon } from '@/lib/geocode';
import { DETAIL_ZOOM, TILE_ATTRIBUTION, TILE_URL, TUNISIA_CENTER, TUNISIA_ZOOM } from '@/lib/map-config';
import { cn } from '@/lib/utils';

function ClickToPlace({ onChange }: { onChange: (value: LatLon) => void }) {
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lon: event.latlng.lng }) });
  return null;
}

/** Re-centres the map when the position changes (search result, drag). */
function Follow({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lon !== null) map.setView([lat, lon], Math.max(map.getZoom(), DETAIL_ZOOM));
  }, [map, lat, lon]);
  return null;
}

export function LocationPickerInner({
  value,
  onChange,
  className,
}: {
  value: LatLon | null;
  onChange?: (value: LatLon) => void;
  className?: string;
}) {
  const editable = onChange !== undefined;
  return (
    <div className={cn('isolate overflow-hidden rounded-lg border', className ?? 'h-64')}>
      <MapContainer
        center={value ? [value.lat, value.lon] : TUNISIA_CENTER}
        zoom={value ? DETAIL_ZOOM : TUNISIA_ZOOM}
        scrollWheelZoom={editable}
        className="size-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {editable && <ClickToPlace onChange={onChange} />}
        <Follow lat={value?.lat ?? null} lon={value?.lon ?? null} />
        {value && (
          <Marker
            position={[value.lat, value.lon]}
            icon={pinIcon('#047857')}
            draggable={editable}
            eventHandlers={
              editable
                ? {
                    dragend: (event) => {
                      const position = event.target.getLatLng();
                      onChange({ lat: position.lat, lon: position.lng });
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>
    </div>
  );
}
```

Create `web/src/components/map/properties-map-inner.tsx`:

```tsx
'use client';

import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { pinIcon } from '@/components/map/pin';
import { TILE_ATTRIBUTION, TILE_URL, TUNISIA_CENTER, TUNISIA_ZOOM } from '@/lib/map-config';
import { OCCUPANCY, type OccupancyLevel } from '@/lib/occupancy';
import { cn } from '@/lib/utils';

export type MapPoint = {
  id: string;
  name: string;
  city: string | null;
  lat: number;
  lon: number;
  level: OccupancyLevel;
  units: number;
  rented: number;
};

export function PropertiesMapInner({ points, className }: { points: MapPoint[]; className?: string }) {
  const bounds = points.length > 0 ? L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number])) : undefined;
  // A new key re-creates the map so it fits the filtered biens.
  const key = points.map((point) => point.id).join('|') || 'empty';

  return (
    <div className={cn('isolate overflow-hidden rounded-xl border', className ?? 'h-[60vh]')}>
      <MapContainer
        key={key}
        bounds={bounds}
        boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
        center={bounds ? undefined : TUNISIA_CENTER}
        zoom={bounds ? undefined : TUNISIA_ZOOM}
        className="size-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {points.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lon]} icon={pinIcon(OCCUPANCY[point.level].color)}>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{point.name}</p>
                {point.city && <p className="text-muted-foreground">{point.city}</p>}
                <p>
                  {point.rented} / {point.units} unités louées
                </p>
                <Link href={'/biens/' + point.id} className="font-medium text-primary underline">
                  Ouvrir la fiche
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

Create `web/src/components/map/index.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';

// Leaflet needs `window`: load the map only in the browser.
export const LocationPicker = dynamic(() => import('./location-picker-inner').then((module) => module.LocationPickerInner), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
});

export const PropertiesMap = dynamic(() => import('./properties-map-inner').then((module) => module.PropertiesMapInner), {
  ssr: false,
  loading: () => <div className="h-[60vh] animate-pulse rounded-xl bg-muted" />,
});

export type { MapPoint } from './properties-map-inner';
```

Create `web/src/components/map/location-field.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2, MapPinOff, Search } from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { geocodeAddress, roundPosition, type GeocodeResult, type LatLon } from '@/lib/geocode';

type Props = {
  query: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (value: LatLon | null) => void;
};

export function LocationField({ query, latitude, longitude, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const value = latitude !== null && longitude !== null ? { lat: latitude, lon: longitude } : null;

  const place = (position: LatLon) => {
    onChange(roundPosition(position));
    setResults(null);
  };

  async function run() {
    const term = search.trim() || query;
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await geocodeAddress(term);
    setSearching(false);
    if (found.length === 1) place(found[0]);
    else setResults(found);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Rechercher l’adresse sur la carte"
            value={search}
            placeholder={query || 'Ex. Avenue Habib Bourguiba, Carthage'}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void run();
              }
            }}
          />
        </InputGroup>
        <Button type="button" variant="outline" onClick={() => void run()} disabled={searching}>
          {searching && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Rechercher
        </Button>
      </div>

      {results !== null &&
        (results.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            Adresse introuvable, placez le repère sur la carte.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {results.map((result) => (
              <li key={result.lat + ',' + result.lon}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => place(result)}>
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        ))}

      <LocationPicker value={value} onChange={place} className="h-72" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {value
            ? `Position : ${String(value.lat).replace('.', ',')} · ${String(value.lon).replace('.', ',')}`
            : 'Cliquez sur la carte pour placer le repère, puis faites-le glisser pour ajuster.'}
        </span>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <MapPinOff data-icon="inline-start" />
            Retirer la position
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Put the location field in the bien form**

In `web/src/components/domain/property-form.tsx`:
- add `import { LocationField } from '@/components/map/location-field';` and `import { addressQuery } from '@/lib/geocode';`
- replace `  const { control, register, handleSubmit, formState, watch } = useForm<PropertyFormValues>({` with `  const { control, register, handleSubmit, formState, watch, setValue } = useForm<PropertyFormValues>({`
- replace `            {/* LOCATION-PICKER: Task 13 inserts the map picker here. */}` with

```tsx
            <Field>
              <FieldLabel>Position sur la carte</FieldLabel>
              <LocationField
                query={addressQuery([watch('address_line'), watch('postal_code'), watch('city'), watch('governorate')])}
                latitude={watch('latitude')}
                longitude={watch('longitude')}
                onChange={(position) => {
                  setValue('latitude', position?.lat ?? null, { shouldDirty: true });
                  setValue('longitude', position?.lon ?? null, { shouldDirty: true });
                }}
              />
            </Field>
```

- [ ] **Step 8: Map preview on the bien overview**

In `web/src/components/property/property-overview.tsx`:
- add `import { LocationPicker } from '@/components/map';` and `import { Button } from '@/components/ui/button';`
- replace `            {/* PROPERTY-MAP-PREVIEW: Task 13 adds the small map here. */}` with

```tsx
            {property.latitude !== null && property.longitude !== null ? (
              <LocationPicker value={{ lat: Number(property.latitude), lon: Number(property.longitude) }} className="h-48" />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={'/biens/' + property.id + '/modifier'}>Placer sur la carte</Link>
              </Button>
            )}
```

- [ ] **Step 9: Replace the map page placeholder**

Replace `web/src/app/(app)/biens/carte/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { PropertiesMap, type MapPoint } from '@/components/map';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OCCUPANCY, occupancyLevel, type OccupancyLevel } from '@/lib/occupancy';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query PropertiesMap {
    properties(where: { archived_at: { _is_null: true } }, order_by: { name: asc }) {
      id name city latitude longitude
      branch { id name }
      units(where: { archived_at: { _is_null: true } }) { status }
    }
  }
`;

type Row = {
  id: string;
  name: string;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  branch: { id: string; name: string } | null;
  units: { status: string }[];
};

export default function PropertiesMapPage() {
  const result = useGraphql<{ properties: Row[] }>(QUERY);
  const [city, setCity] = useState('all');
  const [branch, setBranch] = useState('all');
  const rows = result.status === 'success' ? result.data.properties : [];
  const cities = [...new Set(rows.map((row) => row.city).filter((value): value is string => !!value))].sort();
  const branches = [...new Map(rows.flatMap((row) => (row.branch ? [[row.branch.id, row.branch.name] as const] : [])))];
  const filtered = rows.filter((row) => (city === 'all' || row.city === city) && (branch === 'all' || row.branch?.id === branch));
  const placed = filtered.filter((row) => row.latitude !== null && row.longitude !== null);
  const missing = filtered.filter((row) => row.latitude === null || row.longitude === null);
  const points: MapPoint[] = placed.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    level: occupancyLevel(row.units.map((unit) => unit.status)),
    units: row.units.length,
    rented: row.units.filter((unit) => unit.status === 'rented').length,
  }));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader title="Carte des biens" description="Les biens placés sur la carte, colorés selon leur occupation." />
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-44" aria-label="Ville">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {cities.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-48" aria-label="Succursale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les succursales</SelectItem>
              {branches.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Légende">
            {(Object.keys(OCCUPANCY) as OccupancyLevel[]).map((level) => (
              <li key={level} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: OCCUPANCY[level].color }} aria-hidden />
                {OCCUPANCY[level].label}
              </li>
            ))}
          </ul>
        </div>
      </StaggerItem>

      {result.status === 'loading' && <SkeletonList count={1} itemClassName="h-[60vh] rounded-xl bg-muted" label="Chargement de la carte…" />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les biens : {result.message}
        </p>
      )}

      {result.status === 'success' && (
        <StaggerItem>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <PropertiesMap points={points} />
            <div className="space-y-4">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-3">
                  <CardTitle className="text-sm">Sur la carte ({points.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto p-0">
                  <ul className="divide-y text-sm">
                    {points.map((point) => (
                      <li key={point.id} className="flex items-center gap-2 px-4 py-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: OCCUPANCY[point.level].color }} aria-hidden />
                        <Link href={'/biens/' + point.id} className="truncate hover:text-primary hover:underline">
                          {point.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              {missing.length > 0 && (
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MapPinOff className="size-4 text-muted-foreground" aria-hidden />
                      Sans position ({missing.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y text-sm">
                      {missing.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-2 px-4 py-2">
                          <span className="truncate">{row.name}</span>
                          <Link href={'/biens/' + row.id + '/modifier'} className="shrink-0 text-xs font-medium text-primary hover:underline">
                            Placer sur la carte
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </StaggerItem>
      )}
    </Stagger>
  );
}
```

- [ ] **Step 10: Tests, lint, build, browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed (the build must not fail on `window is not defined`; the map is client-only).
In the browser: `/biens/carte` shows the two seeded biens as pins (Résidence orange/green depending on occupancy); click a pin → popup with "Ouvrir la fiche". Edit Le Belvédère → type "Rue du Belvédère, Tunis" → Rechercher → pick a result → pin moves; drag it; save → Aperçu shows the small map. Type "zzzz" → "Adresse introuvable, placez le repère sur la carte." Resize to mobile: map and side list stack, no horizontal scroll.

- [ ] **Step 11: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/map-config.ts web/src/lib/geocode.ts web/src/lib/geocode.test.ts web/src/components/map web/src/components/domain/property-form.tsx web/src/components/property/property-overview.tsx "web/src/app/(app)/biens/carte/page.tsx"
git commit -m "feat(biens): address search, pin placement and map of biens"
```

---

### Task 14: Incomplete records page, navigation entry, dashboard tile

**Files:**
- Create: `web/src/lib/gaps.ts`, `web/src/lib/gaps.test.ts`
- Create: `web/src/app/(app)/biens/fiches-incompletes/page.tsx`
- Modify: `web/src/lib/navigation.ts` (menu entry)
- Modify: `web/src/app/(app)/page.tsx` (dashboard tile)

**Interfaces:**
- Consumes: `record_gaps` view (Task 1/2); hash targets `#proprietaires`, `#modifier`, `#parties-communes` (Tasks 9–11).
- Produces:
  - `type GapEntity = 'property' | 'unit' | 'contact'`, `type GapRow = { entity_type: GapEntity; entity_id: string; property_id: string | null; entity_label: string; property_label: string | null; gap_code: string }`
  - `gapLabel(code: string): string`, `gapLink(row: GapRow): string`
  - `type GapGroup = { entityId: string; label: string; context: string | null; gaps: GapRow[] }`, `groupGaps(rows: GapRow[]): Record<GapEntity, GapGroup[]>`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/gaps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gapLabel, gapLink, groupGaps, type GapRow } from './gaps';

const unitGap = (code: string): GapRow => ({
  entity_type: 'unit',
  entity_id: 'u1',
  property_id: 'p1',
  entity_label: 'B-101',
  property_label: 'Résidence',
  gap_code: code,
});

describe('gapLink', () => {
  it('sends each gap to the exact place to fix it', () => {
    expect(gapLink(unitGap('no_owner'))).toBe('/biens/p1/unites/u1#proprietaires');
    expect(gapLink(unitGap('no_surface'))).toBe('/biens/p1/unites/u1#modifier');
    const property = { entity_type: 'property', entity_id: 'p1', property_id: 'p1', entity_label: 'Résidence', property_label: null } as const;
    expect(gapLink({ ...property, gap_code: 'no_position' })).toBe('/biens/p1/modifier');
    expect(gapLink({ ...property, gap_code: 'shares_total' })).toBe('/biens/p1#parties-communes');
    expect(
      gapLink({ entity_type: 'contact', entity_id: 'c1', property_id: null, entity_label: 'X', property_label: null, gap_code: 'no_contact_info' }),
    ).toBe('/contacts/c1/modifier');
  });
});

describe('gapLabel', () => {
  it('names known gaps and keeps unknown codes', () => {
    expect(gapLabel('no_owner')).toBe('Aucun propriétaire');
    expect(gapLabel('mystery')).toBe('mystery');
  });
});

describe('groupGaps', () => {
  it('groups gaps per record inside each entity type', () => {
    const groups = groupGaps([unitGap('no_owner'), unitGap('no_rent')]);
    expect(groups.unit).toEqual([
      { entityId: 'u1', label: 'B-101', context: 'Résidence', gaps: [unitGap('no_owner'), unitGap('no_rent')] },
    ]);
    expect(groups.property).toEqual([]);
    expect(groups.contact).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/gaps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `web/src/lib/gaps.ts`:

```ts
export type GapEntity = 'property' | 'unit' | 'contact';

export type GapRow = {
  entity_type: GapEntity;
  entity_id: string;
  property_id: string | null;
  entity_label: string;
  property_label: string | null;
  gap_code: string;
};

export type GapGroup = { entityId: string; label: string; context: string | null; gaps: GapRow[] };

const LABELS: Record<string, string> = {
  no_owner: 'Aucun propriétaire',
  no_surface: 'Surface manquante',
  no_rent: 'Loyer manquant',
  no_address: 'Adresse incomplète',
  no_position: 'Position sur la carte manquante',
  shares_total: 'Tantièmes différents de 1000',
  no_contact_info: 'Ni téléphone ni e-mail',
};

export function gapLabel(code: string): string {
  return LABELS[code] ?? code;
}

/** Where to go to fix the gap: the exact form, tab or dialog. */
export function gapLink(row: GapRow): string {
  switch (row.entity_type) {
    case 'unit': {
      const base = `/biens/${row.property_id}/unites/${row.entity_id}`;
      return row.gap_code === 'no_owner' ? base + '#proprietaires' : base + '#modifier';
    }
    case 'property':
      return row.gap_code === 'shares_total' ? `/biens/${row.entity_id}#parties-communes` : `/biens/${row.entity_id}/modifier`;
    case 'contact':
      return `/contacts/${row.entity_id}/modifier`;
  }
}

export function groupGaps(rows: GapRow[]): Record<GapEntity, GapGroup[]> {
  const result: Record<GapEntity, GapGroup[]> = { property: [], unit: [], contact: [] };
  const index = new Map<string, GapGroup>();
  for (const row of rows) {
    const key = row.entity_type + ':' + row.entity_id;
    let group = index.get(key);
    if (!group) {
      group = { entityId: row.entity_id, label: row.entity_label, context: row.property_label, gaps: [] };
      index.set(key, group);
      result[row.entity_type].push(group);
    }
    group.gaps.push(row);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/gaps.test.ts`
Expected: all pass.

- [ ] **Step 5: The page**

Create `web/src/app/(app)/biens/fiches-incompletes/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Building2, CheckCircle2, DoorOpen, Users } from 'lucide-react';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { gapLabel, gapLink, groupGaps, type GapEntity, type GapRow } from '@/lib/gaps';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query RecordGaps {
    record_gaps(order_by: [{ entity_type: asc }, { entity_label: asc }]) {
      entity_type entity_id property_id entity_label property_label gap_code
    }
  }
`;

const SECTIONS: { entity: GapEntity; title: string; icon: typeof Building2 }[] = [
  { entity: 'property', title: 'Biens', icon: Building2 },
  { entity: 'unit', title: 'Unités', icon: DoorOpen },
  { entity: 'contact', title: 'Contacts', icon: Users },
];

export default function IncompleteRecordsPage() {
  const result = useGraphql<{ record_gaps: GapRow[] }>(QUERY);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title="Fiches incomplètes"
          description="Les informations manquantes sur les biens, unités et contacts. Chaque ligne mène à l’endroit exact où la compléter."
        />
      </StaggerItem>

      {result.status === 'loading' && <SkeletonList count={3} className="space-y-3" itemClassName="h-24 rounded-xl bg-muted" label="Chargement…" />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les fiches incomplètes : {result.message}
        </p>
      )}

      {result.status === 'success' && result.data.record_gaps.length === 0 && (
        <StaggerItem>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <CheckCircle2 className="size-8 text-success" aria-hidden />
              <p className="font-medium">Toutes les fiches sont complètes</p>
              <p className="text-sm text-muted-foreground">Rien à compléter pour le moment.</p>
            </CardContent>
          </Card>
        </StaggerItem>
      )}

      {result.status === 'success' &&
        result.data.record_gaps.length > 0 &&
        (() => {
          const groups = groupGaps(result.data.record_gaps);
          return SECTIONS.filter((section) => groups[section.entity].length > 0).map((section) => {
            const Icon = section.icon;
            return (
              <StaggerItem key={section.entity}>
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      {section.title}
                    </CardTitle>
                    <CardDescription>{groups[section.entity].length} fiche(s) à compléter</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {groups[section.entity].map((group) => (
                        <li key={group.entityId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{group.label}</p>
                            {group.context && <p className="text-xs text-muted-foreground">{group.context}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {group.gaps.map((gap) => (
                              <Button key={gap.gap_code} asChild variant="outline" size="sm" className="h-7">
                                <Link href={gapLink(gap)}>
                                  <Badge variant="secondary" className="mr-1 bg-warning/15 text-warning">
                                    !
                                  </Badge>
                                  {gapLabel(gap.gap_code)} · Compléter
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          });
        })()}
    </Stagger>
  );
}
```

- [ ] **Step 6: Menu entry**

In `web/src/lib/navigation.ts` replace

```ts
          { label: 'Parties communes', href: '/biens/parties-communes' },
          { label: 'Biens archivés', href: '/biens/archives' },
```

with

```ts
          { label: 'Parties communes', href: '/biens/parties-communes' },
          { label: 'Fiches incomplètes', href: '/biens/fiches-incompletes' },
          { label: 'Biens archivés', href: '/biens/archives' },
```

- [ ] **Step 7: Dashboard tile**

In `web/src/app/(app)/page.tsx`:
- add `ClipboardList` to the `lucide-react` import list;
- in `DASHBOARD_QUERY` replace `    contacts_aggregate { aggregate { count } }` with

```
    contacts_aggregate { aggregate { count } }
    record_gaps_aggregate { aggregate { count } }
```

- in `type DashboardData` replace `  contacts_aggregate: { aggregate: { count: number } };` with

```ts
  contacts_aggregate: { aggregate: { count: number } };
  record_gaps_aggregate: { aggregate: { count: number } };
```

- replace `  const { units, properties, contacts_aggregate } = result.data;` with `  const { units, properties, contacts_aggregate, record_gaps_aggregate } = result.data;`
- replace `      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">` with

```tsx
      {record_gaps_aggregate.aggregate.count > 0 && (
        <Link
          href="/biens/fiches-incompletes"
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
        >
          <span className="flex items-center gap-2 font-medium">
            <ClipboardList className="size-4 text-warning" aria-hidden />
            Fiches incomplètes : {record_gaps_aggregate.aggregate.count}
          </span>
          <span className="text-muted-foreground">Compléter →</span>
        </Link>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
```

- [ ] **Step 8: Tests, lint, build, browser**

Run: `npm test && npm run lint && npm run build`
Expected: all succeed.
In the browser: the dashboard shows "Fiches incomplètes : N"; the menu shows "Fiches incomplètes" under Biens; the page lists A-204 "Loyer manquant" only if its status is vacant/rented (seed: for_sale → not listed), Le Belvédère "Tantièmes différents de 1000" is not listed (only 1 unit). Click a "Compléter" on a unit gap → the unit page opens with the edit dialog; fix the value → back on the page, the line is gone.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/gaps.ts web/src/lib/gaps.test.ts "web/src/app/(app)/biens/fiches-incompletes/page.tsx" web/src/lib/navigation.ts "web/src/app/(app)/page.tsx"
git commit -m "feat(biens): incomplete records page, menu entry and dashboard tile"
```

---

### Task 15: End-to-end flow and coverage gate

**Files:**
- Modify: `web/package.json` (Playwright)
- Create: `web/playwright.config.ts`
- Create: `web/e2e/core-records.spec.ts`
- Modify: `web/vitest.config.ts` only if coverage is below 80 % (add tests, never lower the threshold)

**Interfaces:**
- Consumes: every page from Tasks 5–14; credentials `E2E_EMAIL`, `E2E_PASSWORD` from `web/.env.test.local` (git-ignored by `.env*` in `web/.gitignore`), written by the user, never by the agent.

- [ ] **Step 1: Install Playwright**

Run (in `web/`):

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Add to `web/package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Configure**

Create `web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// Test credentials live in web/.env.test.local (git-ignored), written by the user.
try {
  process.loadEnvFile('.env.test.local');
} catch {
  // Credentials can also come from the environment.
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/connexion',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 3: Write the flow**

Create `web/e2e/core-records.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function isoInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function signIn(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail professionnelle').fill(EMAIL as string);
  await page.getByLabel('Mot de passe').fill(PASSWORD as string);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/connexion/);
}

async function pickContact(page: Page, name: string) {
  await page.getByRole('combobox').filter({ hasText: 'Choisir un contact' }).first().click();
  await page.getByPlaceholder('Rechercher un contact…').fill(name);
  await page.getByRole('option', { name: new RegExp(name) }).first().click();
}

test('bien → units → owner for all → transfer → contact → photo → pin → incomplete list', async ({ page }) => {
  const bienName = `E2E Résidence ${Date.now().toString().slice(-6)}`;
  await signIn(page);

  // 1. Create a bien.
  await page.goto('/biens/nouveau');
  await page.getByLabel('Nom du bien *').fill(bienName);
  await page.getByRole('combobox', { name: 'Succursale *' }).click();
  await page.getByRole('option', { name: /Tunis Nord/ }).click();
  await page.getByLabel('Adresse', { exact: true }).fill('Rue E2E');
  await page.getByLabel('Ville').fill('Tunis');
  await page.getByRole('button', { name: 'Enregistrer le bien' }).click();
  await expect(page.getByRole('heading', { name: bienName })).toBeVisible();
  const bienUrl = page.url().split('#')[0];

  // The new bien has no position yet: it is listed as incomplete.
  await page.goto('/biens/fiches-incompletes');
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
  await page.locator('input[type=file]').setInputFiles({ name: 'facade-e2e.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Facade e2e')).toBeVisible();

  // 7. Place the pin and save.
  await page.goto(bienUrl + '/modifier');
  await page.locator('.leaflet-container').click({ position: { x: 160, y: 120 } });
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByRole('heading', { name: bienName })).toBeVisible();

  // 8. The "position" gap is gone for this bien.
  await page.goto('/biens/fiches-incompletes');
  const row = page.getByRole('listitem').filter({ hasText: bienName });
  await expect(row.getByText('Position sur la carte manquante')).toHaveCount(0);

  // Clean up: archive the test bien (history is kept, nothing is hard-deleted).
  await page.goto(bienUrl);
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page.getByText('Bien archivé')).toBeVisible();
});
```

- [ ] **Step 4: Ask the user for test credentials, then run**

Ask the user to create `web/.env.test.local` containing `E2E_EMAIL=` and `E2E_PASSWORD=` for their test user (a manager of the demo organization). Never read the values back or print them.

Run: `npm run test:e2e`
Expected: 1 passed. On failure open the trace (`npx playwright show-trace test-results/**/trace.zip`), fix the code (not the test, unless the test is wrong), re-run.

- [ ] **Step 5: Coverage gate**

Run: `npm run test:coverage`
Expected: thresholds met (≥ 80 % lines, functions, branches, statements on the files listed in `vitest.config.ts`). If below, add the missing test cases in the matching `*.test.ts` — do not lower the thresholds.

- [ ] **Step 6: Final review and verification**

1. Run the `typescript-reviewer` and `react-reviewer` agents on `git diff main...HEAD -- web/` and the `security-reviewer` agent on `scripts/apply-hasura-permissions.mjs`, `web/src/lib/storage.ts`, `web/src/lib/upload.ts`, `web/src/components/files/`. Fix CRITICAL/HIGH findings.
2. Browser pass on desktop and mobile (375 px) for `/biens`, a bien (all tabs), a unit (all tabs), `/contacts`, a contact, `/biens/carte`, `/biens/parties-communes`, `/biens/fiches-incompletes`: no console errors, no horizontal scroll.
3. Run `npm test && npm run lint && npm run build` one last time.

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/playwright.config.ts web/e2e
git commit -m "test(e2e): core records flow from bien creation to incomplete list"
```

---

## After this plan

Project 1 is done when Task 15 passes. Then, as recorded in memory (`project-biens-contacts-roadmap`), **ask the user whether to start project 2 (Leases)**.
