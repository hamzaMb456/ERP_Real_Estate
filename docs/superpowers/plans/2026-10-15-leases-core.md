# Leases — Plan A: core leases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff can create, activate, renew, end and follow leases (several renters, guarantors and units per lease, rent history, registration at the tax office, documents), with the unit status following the lease, a lease card on the unit and contact pages, and dashboard tiles for leases to renew and registrations due.

**Architecture:** Rules live in Postgres (constraints, triggers, `SECURITY DEFINER` functions that take the Hasura session), exactly like Project 1. The web app is Next.js pages that call Hasura GraphQL; a lease is created with several insert fields in one request (one transaction). A local Postgres in Docker runs every migration, seed and SQL test before anything touches the live Nhost database.

**Tech Stack:** Postgres 16 (Nhost), Hasura metadata API, Next.js 16 / React 19 / TypeScript, shadcn/ui, plain React state in forms and dialogs (like Project 1), Vitest + Testing Library, Playwright, Docker (local SQL tests only).

**Spec:** `docs/superpowers/specs/2026-10-15-leases-design.md` (sections 2, 3.1, 4, 6, 7, 9, 10, 11). This plan is **Plan A of four**: A core leases (migration `0003`), B calendar, notifications and email (`0004`), C rent requests (`0005`), D inspections and deposit (`0006`). Plans B–D are written when A is built, against the real interfaces A leaves behind.

## Deviations from the spec (decided while planning; Task 1 patches the spec)

1. **Four plans and four migrations** instead of one plan and `0003`–`0005`: `0003_leases.sql`, `0004_calendar_notifications.sql`, `0005_rent_requests.sql`, `0006_inspections_deposit.sql`. Smaller migrations are easier to apply and review.
2. **Creating a lease** sends four insert fields in one GraphQL request (lease, units, parties, first rents), not a nested insert: Hasura's nested inserts do not support the manual, composite-key relationships used here. Hasura runs the fields of one mutation in one transaction, in order.
3. **Webhook secret:** event and cron triggers use Nhost's built-in `x-nhost-webhook-secret` header and `NHOST_WEBHOOK_SECRET` variable, so no extra secret is needed (Plan B).
4. **Staff list:** a `staff_members` view over `auth.users` is added upfront (Plan B) instead of exposing `auth.users` to Hasura.
5. **Draft edit** deletes and re-inserts a draft's units, parties and first rents in one request (Task 10); a guard trigger allows this only on drafts.
6. **Branch filter** of the lease list is deferred (it needs a branch column on `lease_overview`); the five tabs and the search ship now.
7. **Optional function arguments have SQL defaults** (`default null`) because Hasura makes arguments without a default required in GraphQL.

## Global Constraints

- Money is `numeric(12,3)` TND; the UI shows it with `formatTnd` (`1 250,000 TND`).
- "Today" is always `Africa/Tunis`: `public.today_tunis()` in SQL, `todayTunis()` in TypeScript. Never `now()::date` and never the browser's local date for lease logic.
- The day thresholds exist once, in `public.lease_rule(name)`: `grace_days` 7, `ending_soon_days` 60, `registration_days` 60, `registration_warning_days` 10. Views return ready-made flags; the web never recomputes them.
- Lease status values: `draft | active | ended | expired`. A lease past its end date stays `active` for 7 days (grace), then the daily job expires it. Renewal extends the same lease (`lease_terms` row). Only draft leases can be archived; leases are never deleted.
- `payment_day` 1–28 (monthly rent only). Registration deadline = `signed_at + 60 days`; the warning shows only in the last 10 days and when overdue.
- `organization_id` comes from the JWT on insert and is never updatable. Every table has composite foreign keys `(id, organization_id)`.
- Migration files are **ASCII only** (they travel through the clipboard); French text lives in TypeScript. Seeds may contain accents and are copied with `Get-Content -Raw -Encoding UTF8`.
- All UI text is French, with `’` apostrophes like Project 1. Roles: `org_admin` and `manager` write, `viewer` reads (`useCanEdit()`).
- Branch `claude/continuation-bdded2`, conventional commits (`feat:`, `fix:`, `test:`, `docs:`), no attribution lines. The agent never types the Hasura admin secret or any password; the user runs the live-database steps.
- New pure logic gets Vitest tests and is added to the coverage `include` list in `web/vitest.config.ts` (threshold 80 %).
- Run the `database-reviewer` agent on every SQL file before it is applied to the live database (Task 7).

## Review Focus

Inputs and conditions the spec implies but does not spell out, most likely first. Each line names the test that pins it.

1. **Comma decimals in money fields** (« 980,5 », « 1 250,500 »): must parse to 980.5 and 1250.5, never NaN or 9805. `parseMoney` tests, Task 8.
2. **Back-to-back and same-day leases on one unit:** a lease ending 30/06 and another starting 30/06 overlap (both ends inclusive); one starting 01/07 does not. Concurrent activation of two leases on one unit must let only one through. DB tests 9 and 9b, Task 4.
3. **Day boundary in Tunis:** at 23:30 UTC it is already tomorrow in Tunis; flags and "today" must follow Tunis. `todayTunis` tests (Task 1) and DB test 15 (Task 5).
4. **The same contact as renter and guarantor** (or twice as renter) on one lease: refused with a clear message before the database refuses it. `validateLeaseDraft` tests, Task 8.
5. **A viewer opening a lease:** sees everything, no action buttons. `LeaseActions` test, Task 11.
6. **Activating a lease that is not a draft** (double click, two tabs): second call fails with « Ce bail ne peut plus être modifié. » and changes nothing. DB test 7e, Task 4.

## File Structure

Created:

- `scripts/db-local.sh`, `db/local/stubs.sql` — local Postgres harness (Task 3).
- `db/migrations/0003_leases.sql`, `db/tests/0003_leases.test.sql`, `db/seeds/0003_demo_leases.sql`.
- `web/src/lib/`: `dates.ts`, `show-error.ts`, `lease-types.ts`, `leases.ts`, `lease-files.ts` (each with a `.test.ts`).
- `web/src/components/leases/`: `lease-status-badge.tsx`, `lease-units-field.tsx`, `lease-parties-field.tsx`, `lease-form.tsx`, `lease-details.ts`, `lease-action-dialog.tsx`, `lease-dialogs.tsx` (activate, renew, end), `lease-actions.tsx`, `registration-card.tsx`, `terms-timeline.tsx`, `lease-overview-tab.tsx`, `change-rent-dialog.tsx`, `rents-tab.tsx`, `lease-documents.tsx`, `unit-lease-card.tsx`, `contact-leases.tsx` (the three field/action components also have `.test.tsx`).
- `web/src/app/(app)/baux/page.tsx`, `baux/nouveau/page.tsx`, `baux/[id]/page.tsx`, `baux/[id]/modifier/page.tsx`.
- `web/e2e/helpers.ts`, `web/e2e/leases.spec.ts`; `docs/superpowers/handoffs/2026-10-15-leases-plan-a.md`.

Modified: `web/src/lib/errors.ts` (+ test), `web/src/lib/storage.ts`, `web/src/app/(app)/page.tsx` (dashboard tiles), `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx`, `web/src/app/(app)/contacts/[id]/page.tsx`, `web/vitest.config.ts`, `web/e2e/core-records.spec.ts`, `scripts/apply-hasura-permissions.mjs`, `scripts/check-hasura.mjs`, the spec, the roadmap memory.

---

### Task 0: Repair Vitest in the worktree

`npm test` does not start: `Cannot find native binding` (rolldown). Nothing in the repo changes.

**Files:** none.

- [ ] **Step 1: Confirm the failure**

Run (from `web/`): `npm test`
Expected: FAIL at startup with `Cannot find native binding` / `@rolldown/binding-wasm32-wasi`.

- [ ] **Step 2: Find the installed rolldown version**

Run: `npm ls rolldown`
Expected: a line like `rolldown@1.x.y`. Note the exact version (below `<V>`).

- [ ] **Step 3: Install the matching Windows binding without touching package.json or the lockfile**

Run: `npm install --no-save @rolldown/binding-win32-x64-msvc@<V>`
Expected: `added 1 package`, no change in `git status`.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 63 tests (Project 1 baseline).

- [ ] **Step 5: If Step 4 still fails**

Run: `Remove-Item -Recurse -Force node_modules; npm ci` then `npm test`. Expected: PASS, 63 tests. (`npm ci` follows the lockfile exactly, so `git status` stays clean.)

No commit: nothing tracked changed. Record the working command in the handoff doc during Task 15.

---

### Task 1: Tunis date helpers and spec amendments

**Files:**
- Create: `web/src/lib/dates.ts`, `web/src/lib/dates.test.ts`
- Modify: `web/vitest.config.ts` (coverage list), `docs/superpowers/specs/2026-10-15-leases-design.md`

**Interfaces:**
- Produces: `todayTunis(now?: Date): string` (YYYY-MM-DD in Tunis), `addDays(iso: string, days: number): string`, `daysBetween(fromIso: string, toIso: string): number`.

- [ ] **Step 1: Write the failing test** — `web/src/lib/dates.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, todayTunis } from './dates';

describe('todayTunis', () => {
  it('is already tomorrow in Tunis at 23:30 UTC', () => {
    expect(todayTunis(new Date('2026-10-14T23:30:00Z'))).toBe('2026-10-15');
  });

  it('is still today in Tunis at 22:30 UTC', () => {
    expect(todayTunis(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-14');
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('goes back across a month start', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-10-15', '2026-12-14')).toBe(60);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-10-15', '2026-10-12')).toBe(-3);
  });

  it('is zero for the same day', () => {
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `web/`): `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `Cannot find module './dates'`.

- [ ] **Step 3: Write the implementation** — `web/src/lib/dates.ts`

```ts
// Dates for leases and appointments. Tunisia is UTC+1 all year, but the browser (or the server)
// may run in another time zone: every "today" that drives lease logic goes through here.

const TUNIS = 'Africa/Tunis';

// en-CA formats as YYYY-MM-DD.
const dayInTunis = new Intl.DateTimeFormat('en-CA', {
  timeZone: TUNIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayTunis(now: Date = new Date()): string {
  return dayInTunis.format(now);
}

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / 86_400_000);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the file to the coverage list** — in `web/vitest.config.ts`, inside `coverage.include`, after `'src/lib/gaps.ts',` add:

```ts
        'src/lib/dates.ts',
```

- [ ] **Step 6: Amend the spec** — three edits in `docs/superpowers/specs/2026-10-15-leases-design.md`:

(a) In section 3, change the heading `### 3.1 Migration \`0003_leases.sql\` (slice 1)` to `### 3.1 Migration \`0003_leases.sql\` (Plan A: core leases)`, and add this paragraph before it:

```md
Migrations are split by plan: `0003_leases.sql` (core: `lease_rule`, `today_tunis`, leases, units, parties,
rents, terms, files, guard triggers, unit-status sync, lease functions, views `lease_overview`,
`current_lease_rents`, `unit_current_lease`), `0004_calendar_notifications.sql` (appointments,
participants, notifications, `staff_members`, `calendar_feed`, `generate_daily_notifications`),
`0005_rent_requests.sql`, `0006_inspections_deposit.sql`. In section 3.1 the `appointments`,
`appointment_participants`, `notifications` and `calendar_feed` definitions belong to `0004`.
```

(b) In section 4, replace the sentence starting `**Creating a lease** is one nested GraphQL insert` with:

```md
**Creating a lease** is one GraphQL request with four insert fields (lease, units, parties, first rents)
that Hasura runs in order in one transaction (nested inserts are not used: the relationships are
manual, with composite keys). A draft is edited the same way: delete its units and parties, update the
lease, insert them again.
```

(c) In section 5, replace `X-Webhook-Secret` header set in the trigger metadata` with `the Nhost-provided `x-nhost-webhook-secret` header (value from `NHOST_WEBHOOK_SECRET`)` and remove `WEBHOOK_SECRET` from the list of secrets the user enters; in section 5's staff-list bullet replace the last sentence with `A \`staff_members\` view over \`auth.users\` (organization, user id, display name, email, role) is created in \`0004\` and tracked in Hasura.`

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/dates.ts web/src/lib/dates.test.ts web/vitest.config.ts docs/superpowers/specs/2026-10-15-leases-design.md
git commit -m "feat: Tunis date helpers; amend leases spec for the plan split and Nhost webhook secret"
```

---

### Task 2: Lease error messages and the « Réessayer » toast

**Files:**
- Modify: `web/src/lib/errors.ts`, `web/src/lib/errors.test.ts`, `web/vitest.config.ts`
- Create: `web/src/lib/show-error.ts`, `web/src/lib/show-error.test.ts`

**Interfaces:**
- Consumes: `toFrenchError(error, context?)` from `errors.ts`.
- Produces: `isRetryable(error: unknown): boolean`; `showError(title: string, error: unknown, retry?: () => void): void` (toast with a « Réessayer » action only for network and permission failures when `retry` is given).
- New database error codes the SQL tasks must raise: `lease_overlap:<number>`, `lease_needs_renter`, `lease_needs_unit`, `lease_needs_rent`, `lease_not_draft`, `lease_not_active`, `lease_not_found`, `lease_forbidden`, `lease_renewal_not_after`, `lease_end_before_start`, `lease_end_in_future`, `lease_rent_before_start`, `lease_draft_only`, `lease_unit_not_found`; constraint names `leases_dates_check`, `leases_registration_check`, `lease_rents_lease_id_unit_id_effective_from_key`.

- [ ] **Step 1: Write the failing tests** — append inside the `describe('toFrenchError', ...)` block of `web/src/lib/errors.test.ts` (before its closing `});`), and add a new `describe` after it:

```ts
  it.each([
    ['lease_overlap:12', 'Cette unité est déjà louée sur cette période (bail N° 12).'],
    ['lease_needs_renter', 'Ajoutez au moins un locataire avant d’activer le bail.'],
    ['lease_needs_unit', 'Ajoutez au moins une unité avant d’activer le bail.'],
    ['lease_needs_rent', 'Indiquez le loyer de chaque unité avant d’activer le bail.'],
    ['lease_not_draft', 'Ce bail ne peut plus être modifié.'],
    ['lease_not_active', 'Ce bail ne peut plus être modifié.'],
    ['lease_not_found', 'Ce bail est introuvable.'],
    ['lease_forbidden', 'Vous n’avez pas les droits pour cette action.'],
    ['lease_renewal_not_after', 'La nouvelle date de fin doit être postérieure à la fin actuelle du bail.'],
    ['lease_end_before_start', 'La date de fin doit suivre la date de début.'],
    ['new row violates check constraint "leases_dates_check"', 'La date de fin doit suivre la date de début.'],
    ['lease_end_in_future', 'La date de fin du bail ne peut pas être dans le futur.'],
    ['lease_rent_before_start', 'Le loyer ne peut pas commencer avant le début du bail.'],
    ['lease_draft_only', 'Les unités d’un bail ne peuvent être modifiées que tant qu’il est en brouillon.'],
    ['lease_unit_not_found', 'Cette unité ne fait pas partie du bail.'],
    ['new row violates check constraint "leases_registration_check"', 'La date d’enregistrement ne peut pas précéder la signature.'],
    ['duplicate key value violates unique constraint "lease_rents_lease_id_unit_id_effective_from_key"', 'Un loyer existe déjà à cette date pour cette unité.'],
  ])('explains lease error %s', (message, expected) => {
    expect(toFrenchError(new Error(message))).toBe(expected);
  });
```

```ts
describe('isRetryable', () => {
  it('retries network and permission failures only', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryable(new Error('check constraint of an insert permission has failed'))).toBe(true);
    expect(isRetryable(new Error('lease_overlap:3'))).toBe(false);
    expect(isRetryable('nope')).toBe(false);
  });
});
```

and change the import line to `import { isRetryable, toFrenchError } from './errors';`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/errors.test.ts`
Expected: FAIL — `isRetryable` is not exported; lease messages fall through to the raw text.

- [ ] **Step 3: Implement** — in `web/src/lib/errors.ts`, add a lease table above `toFrenchError` and use it inside, and add `isRetryable` at the end of the file.

Add after `const PERMISSION = ...`:

```ts
const LEASE_OVERLAP = /lease_overlap:(\d+)/;

// Fixed sentences for the lease functions and triggers (codes raised by db/migrations/0003_leases.sql).
const LEASE_MESSAGES: [needle: string, sentence: string][] = [
  ['lease_needs_renter', 'Ajoutez au moins un locataire avant d’activer le bail.'],
  ['lease_needs_unit', 'Ajoutez au moins une unité avant d’activer le bail.'],
  ['lease_needs_rent', 'Indiquez le loyer de chaque unité avant d’activer le bail.'],
  ['lease_not_draft', 'Ce bail ne peut plus être modifié.'],
  ['lease_not_active', 'Ce bail ne peut plus être modifié.'],
  ['lease_not_found', 'Ce bail est introuvable.'],
  ['lease_forbidden', 'Vous n’avez pas les droits pour cette action.'],
  ['lease_renewal_not_after', 'La nouvelle date de fin doit être postérieure à la fin actuelle du bail.'],
  ['lease_end_before_start', 'La date de fin doit suivre la date de début.'],
  ['leases_dates_check', 'La date de fin doit suivre la date de début.'],
  ['lease_end_in_future', 'La date de fin du bail ne peut pas être dans le futur.'],
  ['lease_rent_before_start', 'Le loyer ne peut pas commencer avant le début du bail.'],
  ['lease_draft_only', 'Les unités d’un bail ne peuvent être modifiées que tant qu’il est en brouillon.'],
  ['lease_unit_not_found', 'Cette unité ne fait pas partie du bail.'],
  ['leases_registration_check', 'La date d’enregistrement ne peut pas précéder la signature.'],
  ['lease_rents_lease_id_unit_id_effective_from_key', 'Un loyer existe déjà à cette date pour cette unité.'],
];
```

Inside `toFrenchError`, after the `units_property_id_code_key` block and before `if (NETWORK.test(message))`:

```ts
  const overlap = LEASE_OVERLAP.exec(message);
  if (overlap) return `Cette unité est déjà louée sur cette période (bail N° ${overlap[1]}).`;
  const lease = LEASE_MESSAGES.find(([needle]) => message.includes(needle));
  if (lease) return lease[1];
```

At the end of the file:

```ts
/** Network and permission failures are worth a second try; business-rule failures are not. */
export function isRetryable(error: unknown): boolean {
  return error instanceof Error && (NETWORK.test(error.message) || PERMISSION.test(error.message));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/errors.test.ts`
Expected: PASS (original 8 + 17 lease cases + 1).

- [ ] **Step 5: Write the failing test for the toast helper** — `web/src/lib/show-error.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const error = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => error(...args) } }));

import { showError } from './show-error';

beforeEach(() => error.mockClear());

describe('showError', () => {
  it('shows the French sentence under the title', () => {
    showError('Action impossible', new Error('lease_not_draft'));
    expect(error).toHaveBeenCalledWith('Action impossible', {
      description: 'Ce bail ne peut plus être modifié.',
      action: undefined,
    });
  });

  it('adds a « Réessayer » action for a network failure when a retry is given', () => {
    const retry = vi.fn();
    showError('Action impossible', new TypeError('Failed to fetch'), retry);
    const options = error.mock.calls[0][1] as { action: { label: string; onClick: () => void } };
    expect(options.action.label).toBe('Réessayer');
    options.action.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('adds no action for a business-rule failure even with a retry', () => {
    showError('Action impossible', new Error('lease_overlap:3'), vi.fn());
    expect((error.mock.calls[0][1] as { action: unknown }).action).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/show-error.test.ts`
Expected: FAIL — `Cannot find module './show-error'`.

- [ ] **Step 7: Implement** — `web/src/lib/show-error.ts`

```ts
import { toast } from 'sonner';
import { isRetryable, toFrenchError } from '@/lib/errors';

/** Error toast with the French sentence; network and permission failures also get « Réessayer ». */
export function showError(title: string, error: unknown, retry?: () => void): void {
  toast.error(title, {
    description: toFrenchError(error),
    action: retry && isRetryable(error) ? { label: 'Réessayer', onClick: retry } : undefined,
  });
}
```

- [ ] **Step 8: Run both test files, then the whole suite**

Run: `npx vitest run src/lib/show-error.test.ts src/lib/errors.test.ts` → PASS. Then `npm test` → PASS (all).

- [ ] **Step 9: Add to the coverage list** — in `web/vitest.config.ts` `coverage.include` add `'src/lib/show-error.ts',` after `'src/lib/dates.ts',`.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/errors.ts web/src/lib/errors.test.ts web/src/lib/show-error.ts web/src/lib/show-error.test.ts web/vitest.config.ts
git commit -m "feat: French messages for lease errors and a retry action on error toasts"
```

---

### Task 3: Local SQL harness and migration 0003, part 1 (tables, guards, documents)

Why a harness: the live database is changed only by the user, through the Nhost SQL console. A local Postgres in Docker (with stub `auth` and `storage` schemas) lets every SQL test run in seconds, and the first time the SQL touches Nhost it is already green.

**Files:**
- Create: `db/local/stubs.sql`, `scripts/db-local.sh`, `db/migrations/0003_leases.sql`, `db/tests/0003_leases.test.sql`

**Interfaces:**
- Produces (SQL): `public.lease_rule(text) → integer`, `public.today_tunis() → date`; tables `leases`, `lease_units`, `lease_parties`, `lease_rents`, `lease_terms`, `lease_files`; the `erp.lease_action` transaction flag (set to `on` by the lease functions in Task 4); error codes `lease_not_draft`, `lease_draft_only`, `lease_rent_before_start`, `invalid_storage_file`.
- Produces (tooling): `bash scripts/db-local.sh up | test <file> | apply <file> | psql | down`.

- [ ] **Step 1: Start Docker Desktop** (user: open the Docker Desktop app and wait until it says « Engine running »). Check:

Run: `docker version --format "{{.Server.Version}}"`
Expected: a version number such as `27.x`. If Docker cannot run on this machine, skip the harness: run each SQL file in the Nhost console instead (copy with `Get-Content -Raw -Encoding UTF8 <file> | Set-Clipboard`) and treat « Run in the harness » steps as « run in the console ».

- [ ] **Step 2: Create the stubs** — `db/local/stubs.sql` (stands in for the schemas Nhost provides)

```sql
-- Local stand-ins for the Nhost schemas that our migrations reference. Never applied to Nhost.
create schema if not exists auth;
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  display_name  text not null default '',
  default_role  text not null default 'user',
  metadata      jsonb not null default '{}'::jsonb,
  disabled      boolean not null default false,
  created_at    timestamptz not null default now()
);

create schema if not exists storage;
create table if not exists storage.buckets (
  id                     text primary key,
  max_upload_file_size   integer,
  min_upload_file_size   integer,
  presigned_urls_enabled boolean,
  download_expiration    integer,
  cache_control          text
);
create table if not exists storage.files (
  id                  uuid primary key default gen_random_uuid(),
  bucket_id           text references storage.buckets (id),
  name                text,
  size                integer,
  mime_type           text,
  etag                text,
  is_uploaded         boolean default true,
  uploaded_by_user_id uuid,
  metadata            jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
```

- [ ] **Step 3: Create the runner** — `scripts/db-local.sh`

```bash
#!/usr/bin/env bash
# Local Postgres (Docker) for running db/migrations, db/seeds and db/tests without the Nhost console.
# Usage:  bash scripts/db-local.sh up                     rebuild the database: stubs, migrations, seeds
#         bash scripts/db-local.sh test db/tests/X.sql    run a SQL test file (passes when it prints "OK: all")
#         bash scripts/db-local.sh apply db/seeds/X.sql   run any SQL file
#         bash scripts/db-local.sh psql                   interactive psql
#         bash scripts/db-local.sh down                   remove the container
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash must not rewrite /tmp paths passed to docker
NAME=erp-pg
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_sql() { # run_sql <path of a .sql file on this machine>
  docker cp "$1" "$NAME:/tmp/run.sql" > /dev/null
  docker exec "$NAME" psql -U postgres -d erp -v ON_ERROR_STOP=1 -q -f /tmp/run.sql
}

case "${1:-}" in
  up)
    docker rm -f "$NAME" > /dev/null 2>&1 || true
    docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:16 > /dev/null
    # The official image starts a temporary server, restarts, then serves: wait for the second "ready".
    until [ "$(docker logs "$NAME" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]; do sleep 1; done
    docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -c "create database erp"
    run_sql "$ROOT/db/local/stubs.sql"
    for f in "$ROOT"/db/migrations/*.sql "$ROOT"/db/seeds/*.sql; do
      echo "applying $(basename "$f")"
      run_sql "$f"
    done
    ;;
  test)
    set +e
    out="$(run_sql "$ROOT/$2" 2>&1)"
    set -e
    echo "$out"
    echo "$out" | grep -q "OK: all" || { echo "TESTS FAILED"; exit 1; }
    ;;
  apply) run_sql "$ROOT/$2" ;;
  psql) docker exec -it "$NAME" psql -U postgres -d erp ;;
  down) docker rm -f "$NAME" ;;
  *) echo "usage: bash scripts/db-local.sh up|test <file>|apply <file>|psql|down"; exit 2 ;;
esac
```

- [ ] **Step 4: Check the harness on the existing Project 1 files**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0002_core_records.test.sql`
Expected: `applying 0001_foundation.sql`, `applying 0002_core_records.sql`, `applying 0001_demo_data.sql`, `applying 0002_demo_core_records.sql`; the test prints `ERROR:  OK: all core-records tests passed` and the script ends without `TESTS FAILED`. If a Project 1 file fails only because of a missing Nhost object, add that object to `db/local/stubs.sql` and repeat.

- [ ] **Step 5: Write the failing tests** — `db/tests/0003_leases.test.sql` (tests 1–6; Tasks 4 and 5 add tests above the two marker lines)

```sql
-- Tests for 0003_leases. Paste into the Nhost dashboard SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0003_leases.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error « OK: all lease tests passed ». Failure: an error starting with « FAIL ».

-- Fixture helper: a draft lease with one unit, one renter and the first rent.
create function pg_temp.mk_lease(p_id uuid, p_org uuid, p_unit uuid, p_renter uuid, p_start date, p_end date, p_rent numeric default 500)
returns void language plpgsql as $$
begin
  insert into public.leases (id, organization_id, start_date, end_date) values (p_id, p_org, p_start, p_end);
  insert into public.lease_units (organization_id, lease_id, unit_id) values (p_org, p_id, p_unit);
  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values (p_org, p_id, p_renter, 'renter');
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount) values (p_org, p_id, p_unit, p_start, p_rent);
end $$;

do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br     uuid := '21111111-1111-4111-8111-111111111111';
  org2   uuid := 'b0000000-0000-4000-8000-000000000002';
  prop   uuid := 'b0000000-0000-4000-8000-000000000003';
  u1 uuid := 'b0000000-0000-4000-8000-000000000011'; u2 uuid := 'b0000000-0000-4000-8000-000000000012';
  u3 uuid := 'b0000000-0000-4000-8000-000000000013'; u4 uuid := 'b0000000-0000-4000-8000-000000000014';
  u5 uuid := 'b0000000-0000-4000-8000-000000000015'; u6 uuid := 'b0000000-0000-4000-8000-000000000016';
  c1 uuid := 'b0000000-0000-4000-8000-000000000021'; c2 uuid := 'b0000000-0000-4000-8000-000000000022';
  c3 uuid := 'b0000000-0000-4000-8000-000000000023';
  l1  uuid := 'b0000000-0000-4000-8000-000000000101'; l2  uuid := 'b0000000-0000-4000-8000-000000000102';
  l3  uuid := 'b0000000-0000-4000-8000-000000000103'; l4  uuid := 'b0000000-0000-4000-8000-000000000104';
  l5  uuid := 'b0000000-0000-4000-8000-000000000105'; l6  uuid := 'b0000000-0000-4000-8000-000000000106';
  l7  uuid := 'b0000000-0000-4000-8000-000000000107'; l8  uuid := 'b0000000-0000-4000-8000-000000000108';
  l9  uuid := 'b0000000-0000-4000-8000-000000000109'; l10 uuid := 'b0000000-0000-4000-8000-000000000110';
  l11 uuid := 'b0000000-0000-4000-8000-000000000111'; l12 uuid := 'b0000000-0000-4000-8000-000000000112';
  l13 uuid := 'b0000000-0000-4000-8000-000000000113'; l14 uuid := 'b0000000-0000-4000-8000-000000000114';
  l15 uuid := 'b0000000-0000-4000-8000-000000000115'; l16 uuid := 'b0000000-0000-4000-8000-000000000116';
  l17 uuid := 'b0000000-0000-4000-8000-000000000117'; l18 uuid := 'b0000000-0000-4000-8000-000000000118';
  l19 uuid := 'b0000000-0000-4000-8000-000000000119';
  s_ok     json;
  s_viewer json;
  s_other  json;
  v_today  date := public.today_tunis();
  n1 int; n2 int; n int; v_text text; v_date date; v_bool boolean; v_num numeric;
begin
  s_ok     := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org);
  s_viewer := json_build_object('x-hasura-role', 'viewer',  'x-hasura-org-id', org);
  s_other  := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org2);

  insert into organizations (id, name) values (org2, 'Autre organisation');
  insert into properties (id, organization_id, branch_id, name, type) values (prop, org, br, 'Bien test baux', 'building');
  insert into units (id, organization_id, property_id, code) values
    (u1, org, prop, 'L-1'), (u2, org, prop, 'L-2'), (u3, org, prop, 'L-3'),
    (u4, org, prop, 'L-4'), (u5, org, prop, 'L-5'), (u6, org, prop, 'L-6');
  insert into contacts (id, organization_id, full_name) values
    (c1, org, 'Locataire Un'), (c2, org, 'Locataire Deux'), (c3, org, 'Garant Trois');

  -- 1. Lease numbers count up inside one organization.
  insert into leases (id, organization_id, start_date, end_date) values (l1, org, v_today, v_today + 365);
  insert into leases (id, organization_id, start_date, end_date) values (l2, org, v_today, v_today + 365);
  select number into n1 from leases where id = l1;
  select number into n2 from leases where id = l2;
  if n2 <> n1 + 1 then raise exception 'FAIL 1: numbers % then %', n1, n2; end if;

  -- 2. The end date must come after the start date.
  begin
    insert into leases (id, organization_id, start_date, end_date) values (gen_random_uuid(), org, v_today, v_today);
    raise exception 'FAIL 2: end = start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%leases_dates_check%' then raise exception 'FAIL 2: wrong error: %', sqlerrm; end if;
  end;

  -- 3. Registration cannot precede the signature.
  begin
    insert into leases (id, organization_id, start_date, end_date, signed_at, registered_at)
    values (gen_random_uuid(), org, v_today, v_today + 365, v_today, v_today - 1);
    raise exception 'FAIL 3: registration before signature accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%leases_registration_check%' then raise exception 'FAIL 3: wrong error: %', sqlerrm; end if;
  end;

  -- 4. Adding a renter gives the contact the renter role; a guarantor does not.
  insert into lease_units (organization_id, lease_id, unit_id) values (org, l1, u6);
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c1, 'renter');
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c3, 'guarantor');
  if not exists (select 1 from contact_roles where contact_id = c1 and role = 'renter') then
    raise exception 'FAIL 4a: renter role missing';
  end if;
  if exists (select 1 from contact_roles where contact_id = c3 and role = 'renter') then
    raise exception 'FAIL 4b: guarantor got the renter role';
  end if;
  begin
    insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c1, 'guarantor');
    raise exception 'FAIL 4c: same contact twice on one lease accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%lease_parties_pkey%' then raise exception 'FAIL 4c: wrong error: %', sqlerrm; end if;
  end;

  -- 5. Units and parties of a non-draft lease are locked; its dates too, unless a lease function says so.
  update leases set status = 'active' where id = l1;
  begin
    insert into lease_units (organization_id, lease_id, unit_id) values (org, l1, u2);
    raise exception 'FAIL 5a: unit added to an active lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_draft_only' then raise exception 'FAIL 5a: wrong error: %', sqlerrm; end if;
  end;
  begin
    delete from lease_parties where lease_id = l1 and contact_id = c3;
    raise exception 'FAIL 5b: party removed from an active lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_draft_only' then raise exception 'FAIL 5b: wrong error: %', sqlerrm; end if;
  end;
  begin
    update leases set end_date = v_today + 400 where id = l1;
    raise exception 'FAIL 5c: dates of an active lease changed directly';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 5c: wrong error: %', sqlerrm; end if;
  end;
  perform set_config('erp.lease_action', 'on', true);
  update leases set end_date = v_today + 400 where id = l1;
  perform set_config('erp.lease_action', 'off', true);
  -- a deposit or payment day can still be corrected on an active lease
  update leases set payment_day = 10, deposit_amount = 1500 where id = l1;

  -- 6. A rent cannot start before the lease does.
  begin
    insert into lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount)
    values (org, l1, u6, v_today - 1, 100);
    raise exception 'FAIL 6: rent before the start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_rent_before_start' then raise exception 'FAIL 6: wrong error: %', sqlerrm; end if;
  end;

  -- <<< NEXT TESTS (task 4) go above this line

  -- <<< NEXT TESTS (task 5) go above this line

  raise exception 'OK: all lease tests passed';
end $$;
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: the test run prints an error such as `relation "public.leases" does not exist` (or `function public.today_tunis() does not exist`) and then `TESTS FAILED`.

- [ ] **Step 7: Write the migration, part 1** — `db/migrations/0003_leases.sql`

```sql
-- 0003_leases: leases (baux) with their units, parties, rents, terms and documents,
-- the day thresholds, the draft guards and the unit-status rules (functions: see the second half).
-- Apply after 0002, then run db/tests/0003_leases.test.sql.
-- ASCII only: this file travels through the clipboard, so French text never appears here, only error codes.
-- "Today" is always Tunisia (public.today_tunis()): the database session runs in UTC.

-- Day thresholds, defined once. Views return ready-made flags; the web never recomputes them.
create or replace function public.lease_rule(p_name text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_name
    when 'grace_days' then 7
    when 'ending_soon_days' then 60
    when 'registration_days' then 60
    when 'registration_warning_days' then 10
  end;
$$;

create or replace function public.today_tunis()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Africa/Tunis')::date;
$$;

-- Lease. start_date / end_date are the bounds of the current term; a renewal moves end_date and logs a term.
create table public.leases (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  number               integer not null,
  status               text not null default 'draft' check (status in ('draft', 'active', 'ended', 'expired')),
  start_date           date not null,
  end_date             date not null,
  payment_day          smallint not null default 1 check (payment_day between 1 and 28),
  deposit_amount       numeric(12, 3) not null default 0 check (deposit_amount >= 0),
  signed_at            date,
  registered_at        date,
  registration_receipt text,
  ended_on             date,
  end_reason           text check (end_reason in ('term_reached', 'terminated_by_renter', 'terminated_by_owner', 'expired_auto', 'other')),
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint leases_dates_check check (end_date > start_date),
  constraint leases_registration_check check (registered_at is null or signed_at is null or registered_at >= signed_at),
  unique (id, organization_id),
  unique (organization_id, number)
);
create index leases_status_idx on public.leases (organization_id, status) where archived_at is null;
create index leases_active_end_idx on public.leases (end_date) where status = 'active';

-- Per-organization number, assigned under a lock so two simultaneous inserts cannot take the same one.
create or replace function public.assign_lease_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('lease_number:' || new.organization_id::text, 0));
  select coalesce(max(number), 0) + 1 into new.number from public.leases where organization_id = new.organization_id;
  return new;
end;
$$;

create trigger leases_assign_number before insert on public.leases
  for each row execute function public.assign_lease_number();

-- Once a lease is not a draft, its dates, signature, end and archiving change only through the lease
-- functions, which set the transaction flag erp.lease_action. Direct updates by clients are refused.
create or replace function public.guard_lease_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('erp.lease_action', true), '') = 'on' then
    return new;
  end if;
  if old.status <> 'draft' and (
       new.start_date  is distinct from old.start_date
    or new.end_date    is distinct from old.end_date
    or new.signed_at   is distinct from old.signed_at
    or new.ended_on    is distinct from old.ended_on
    or new.end_reason  is distinct from old.end_reason
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'lease_not_draft' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger leases_guard_update before update on public.leases
  for each row execute function public.guard_lease_update();

-- The units of a lease.
create table public.lease_units (
  organization_id uuid not null,
  lease_id        uuid not null,
  unit_id         uuid not null,
  created_at      timestamptz not null default now(),
  primary key (lease_id, unit_id),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade,
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index lease_units_unit_id_idx on public.lease_units (unit_id);
create index lease_units_organization_id_idx on public.lease_units (organization_id);

-- Units can be added or removed only while the lease is a draft; parties can be removed only then too
-- (a guarantor can still be added to a running lease).
create or replace function public.check_lease_draft_children()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  -- NEW does not exist in a delete trigger and OLD does not exist in an insert trigger: branch on tg_op.
  if tg_op = 'DELETE' then
    select status into v_status from public.leases where id = old.lease_id;
  else
    select status into v_status from public.leases where id = new.lease_id;
  end if;
  -- No row means the lease itself is being deleted (cascade): nothing to protect.
  if v_status is not null and v_status <> 'draft' then
    raise exception 'lease_draft_only' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger lease_units_draft_only before insert or delete on public.lease_units
  for each row execute function public.check_lease_draft_children();

-- Renters and guarantors, one role per contact per lease.
create table public.lease_parties (
  organization_id uuid not null,
  lease_id        uuid not null,
  contact_id      uuid not null,
  role            text not null check (role in ('renter', 'guarantor')),
  created_at      timestamptz not null default now(),
  primary key (lease_id, contact_id),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict
);
create index lease_parties_contact_id_idx on public.lease_parties (contact_id);
create index lease_parties_organization_id_idx on public.lease_parties (organization_id);

create trigger lease_parties_draft_only_delete before delete on public.lease_parties
  for each row execute function public.check_lease_draft_children();

-- Renting a unit makes the contact a renter (same pattern as ensure_owner_role).
create or replace function public.ensure_renter_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role = 'renter' then
    insert into public.contact_roles (organization_id, contact_id, role)
    values (new.organization_id, new.contact_id, 'renter')
    on conflict (contact_id, role) do nothing;
  end if;
  return null;
end;
$$;

create trigger lease_parties_ensure_renter_role after insert or update of contact_id, role on public.lease_parties
  for each row execute function public.ensure_renter_role();

-- Rent and fixed recoverable charges per unit, by effective date: the history Finance reads later.
-- The first row (effective at the start date) is created with the lease; a rent change adds a row.
create table public.lease_rents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  unit_id         uuid not null,
  effective_from  date not null,
  rent_amount     numeric(12, 3) not null check (rent_amount >= 0),
  charges_amount  numeric(12, 3) not null default 0 check (charges_amount >= 0),
  reason          text,
  created_at      timestamptz not null default now(),
  unique (lease_id, unit_id, effective_from),
  foreign key (lease_id, unit_id) references public.lease_units (lease_id, unit_id) on delete cascade,
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_rents_organization_id_idx on public.lease_rents (organization_id);

create or replace function public.check_lease_rent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.effective_from < (select start_date from public.leases where id = new.lease_id) then
    raise exception 'lease_rent_before_start' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lease_rents_check before insert on public.lease_rents
  for each row execute function public.check_lease_rent();

-- Log of the terms of a lease: the initial term at activation, then one row per renewal.
create table public.lease_terms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  kind            text not null check (kind in ('initial', 'renewal')),
  start_date      date not null,
  end_date        date not null,
  recorded_on     date not null default public.today_tunis(),
  note            text,
  created_at      timestamptz not null default now(),
  constraint lease_terms_dates_check check (end_date > start_date),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_terms_lease_id_idx on public.lease_terms (lease_id);
create index lease_terms_organization_id_idx on public.lease_terms (organization_id);

-- Signed lease, ID documents, registration receipt.
create table public.lease_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  storage_file_id uuid not null unique references storage.files (id) on delete cascade,
  category        text not null default 'other' check (category in ('signed_lease', 'id_document', 'registration_receipt', 'inspection_report', 'inspection_photo', 'other')),
  title           text not null check (length(trim(title)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_files_organization_id_idx on public.lease_files (organization_id);
create index lease_files_lease_id_idx on public.lease_files (lease_id);

-- A linked file must live in the lease-files bucket and, for API users, have been uploaded by the same user
-- (same reasoning as check_property_file_storage in 0002).
create or replace function public.check_lease_file_storage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id';
begin
  if not exists (
    select 1 from storage.files f
    where f.id = new.storage_file_id
      and f.bucket_id = 'lease-files'
      and (v_user is null or f.uploaded_by_user_id::text = v_user)
  ) then
    raise exception 'invalid_storage_file' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lease_files_check_storage before insert or update of storage_file_id on public.lease_files
  for each row execute function public.check_lease_file_storage();

create trigger leases_set_updated_at      before update on public.leases      for each row execute function public.set_updated_at();
create trigger lease_files_set_updated_at before update on public.lease_files for each row execute function public.set_updated_at();

-- Private bucket for lease documents (10 MB per file, presigned downloads).
insert into storage.buckets (id, max_upload_file_size, min_upload_file_size, presigned_urls_enabled, download_expiration, cache_control)
values ('lease-files', 10485760, 1, true, 300, 'max-age=3600')
on conflict (id) do nothing;

-- <<< PART 2 (task 4): sync, overlap, lease functions

-- <<< PART 3 (task 5): views
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: `ERROR:  OK: all lease tests passed` and no `TESTS FAILED`. If a `FAIL n:` line appears, fix the migration (never the test) and repeat.

- [ ] **Step 9: Commit**

```bash
git add db/local/stubs.sql scripts/db-local.sh db/migrations/0003_leases.sql db/tests/0003_leases.test.sql
git commit -m "feat(db): leases tables, guards and documents (migration 0003, part 1) with a local SQL harness"
```

---

### Task 4: Migration 0003, part 2 — unit-status sync, overlap rule and the lease functions

**Files:**
- Modify: `db/migrations/0003_leases.sql` (append at the `<<< PART 2` marker), `db/tests/0003_leases.test.sql` (add above the `<<< NEXT TESTS (task 4)` marker)

**Interfaces:**
- Consumes: tables and guards from Task 3.
- Produces (SQL), all `SECURITY DEFINER`, all returning `setof public.leases` and taking the Hasura session as the last argument `hasura_session json`:
  - `public.activate_lease(p_lease_id uuid, p_signed_on date, hasura_session json)`
  - `public.renew_lease(p_lease_id uuid, p_new_end_date date, p_rents jsonb, p_note text, hasura_session json)` — `p_rents` is `[{ "unit_id": uuid, "rent_amount": number, "charges_amount": number }]` or null.
  - `public.end_lease(p_lease_id uuid, p_ended_on date, p_reason text, hasura_session json)`
  - `public.change_rent(p_lease_id uuid, p_unit_id uuid, p_effective_from date, p_rent numeric, p_charges numeric, p_reason text, hasura_session json)`
  - `public.expire_overdue_leases()` — no session; for the admin role only (no Hasura role permission is granted to it).
  - helpers `public.lease_session_org(json) → uuid`, `public.sync_unit_status(uuid)`, `public.assert_no_lease_overlap(uuid, date, date)`.
  - Every optional argument has a `default null` (or `0`): Hasura makes function arguments without a default required in GraphQL. `hasura_session` also defaults to null, and a null session is refused with `lease_forbidden`.

- [ ] **Step 1: Add two units to the fixtures and relax the term check** — in `db/tests/0003_leases.test.sql` replace the line `u5 uuid := 'b0000000-0000-4000-8000-000000000015'; u6 uuid := 'b0000000-0000-4000-8000-000000000016';` with:

```sql
  u5 uuid := 'b0000000-0000-4000-8000-000000000015'; u6 uuid := 'b0000000-0000-4000-8000-000000000016';
  u7 uuid := 'b0000000-0000-4000-8000-000000000017'; u8 uuid := 'b0000000-0000-4000-8000-000000000018';
```

and replace `(u4, org, prop, 'L-4'), (u5, org, prop, 'L-5'), (u6, org, prop, 'L-6');` with `(u4, org, prop, 'L-4'), (u5, org, prop, 'L-5'), (u6, org, prop, 'L-6'),\n    (u7, org, prop, 'L-7'), (u8, org, prop, 'L-8');`. In `db/migrations/0003_leases.sql` change `constraint lease_terms_dates_check check (end_date > start_date)` to `constraint lease_terms_dates_check check (end_date >= start_date)` (a renewal of one day is legal).

- [ ] **Step 2: Write the failing tests** — insert above `-- <<< NEXT TESTS (task 4) go above this line`

```sql
  -- 7. Activation rules (a, b, c: what is missing; d: success; e: a second activation).
  insert into leases (id, organization_id, start_date, end_date) values (l3, org, v_today, v_today + 364);
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7a: activated without a renter';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_renter' then raise exception 'FAIL 7a: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l3, c1, 'renter');
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7b: activated without a unit';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_unit' then raise exception 'FAIL 7b: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_units (organization_id, lease_id, unit_id) values (org, l3, u1);
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7c: activated without a rent';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_rent' then raise exception 'FAIL 7c: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount)
  values (org, l3, u1, v_today, 800, 50);
  perform 1 from public.activate_lease(l3, null, s_ok);
  select status into v_text from leases where id = l3;
  if v_text <> 'active' then raise exception 'FAIL 7d: status is %', v_text; end if;
  select signed_at into v_date from leases where id = l3;
  if v_date <> v_today then raise exception 'FAIL 7d: signed_at is %', v_date; end if;
  select status into v_text from units where id = u1;
  if v_text <> 'rented' then raise exception 'FAIL 7d: unit status is %', v_text; end if;
  select count(*) into n from lease_terms where lease_id = l3 and kind = 'initial' and start_date = v_today and end_date = v_today + 364;
  if n <> 1 then raise exception 'FAIL 7d: initial term rows: %', n; end if;
  -- the flag must not leak into the rest of the transaction: a direct edit is refused again
  begin
    update leases set end_date = v_today + 500 where id = l3;
    raise exception 'FAIL 7d: erp.lease_action flag leaked after the function';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 7d: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7e: activated twice';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 7e: wrong error: %', sqlerrm; end if;
  end;

  -- 8. The caller must be a writer of the lease's organization.
  insert into leases (id, organization_id, start_date, end_date) values (l4, org, v_today, v_today + 100);
  begin
    perform 1 from public.activate_lease(l4, null, s_viewer);
    raise exception 'FAIL 8a: a viewer activated a lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_forbidden' then raise exception 'FAIL 8a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.activate_lease(l4, null, s_other);
    raise exception 'FAIL 8b: another organization activated the lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_found' then raise exception 'FAIL 8b: wrong error: %', sqlerrm; end if;
  end;

  -- 9. Overlap: both ends are inclusive. l3 occupies u1 from today to today+364.
  perform pg_temp.mk_lease(l5, org, u1, c2, v_today + 364, v_today + 700);
  begin
    perform 1 from public.activate_lease(l5, null, s_ok);
    raise exception 'FAIL 9: a lease starting on the last day of another was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> format('lease_overlap:%s', (select number from leases where id = l3)) then
      raise exception 'FAIL 9: wrong error: %', sqlerrm;
    end if;
  end;
  -- 9b. Back to back is fine: the next lease starts the day after.
  perform pg_temp.mk_lease(l6, org, u1, c2, v_today + 365, v_today + 730);
  perform 1 from public.activate_lease(l6, null, s_ok);
  select status into v_text from leases where id = l6;
  if v_text <> 'active' then raise exception 'FAIL 9b: back-to-back lease not active (%)', v_text; end if;
  -- 9c. The check serialises simultaneous activations on one unit with an advisory lock.
  if position('pg_advisory_xact_lock' in pg_get_functiondef('public.assert_no_lease_overlap(uuid,date,date)'::regprocedure)) = 0 then
    raise exception 'FAIL 9c: the overlap check takes no lock';
  end if;

  -- 10. Renewal.
  begin
    perform 1 from public.renew_lease(l3, v_today + 364, null, null, s_ok);
    raise exception 'FAIL 10a: renewal to the same end date accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_renewal_not_after' then raise exception 'FAIL 10a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.renew_lease(l3, v_today + 400, null, null, s_ok);
    raise exception 'FAIL 10b: renewal into the next lease accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> format('lease_overlap:%s', (select number from leases where id = l6)) then
      raise exception 'FAIL 10b: wrong error: %', sqlerrm;
    end if;
  end;
  begin
    perform 1 from public.renew_lease(l2, v_today + 400, null, null, s_ok);
    raise exception 'FAIL 10c: a draft was renewed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 10c: wrong error: %', sqlerrm; end if;
  end;
  perform pg_temp.mk_lease(l7, org, u2, c1, v_today - 100, v_today + 10, 700);
  perform 1 from public.activate_lease(l7, v_today - 100, s_ok);
  perform 1 from public.renew_lease(
    l7, v_today + 375,
    jsonb_build_array(jsonb_build_object('unit_id', u2, 'rent_amount', 750, 'charges_amount', 25)),
    'Renouvellement test', s_ok);
  select end_date into v_date from leases where id = l7;
  if v_date <> v_today + 375 then raise exception 'FAIL 10d: end_date is %', v_date; end if;
  select count(*) into n from lease_terms where lease_id = l7 and kind = 'renewal'
    and start_date = v_today + 11 and end_date = v_today + 375 and note = 'Renouvellement test';
  if n <> 1 then raise exception 'FAIL 10d: renewal term rows: %', n; end if;
  select rent_amount into v_num from lease_rents where lease_id = l7 and unit_id = u2 and effective_from = v_today + 11;
  if v_num is distinct from 750 then raise exception 'FAIL 10d: renewal rent is %', v_num; end if;

  -- 11. Ending a lease.
  perform pg_temp.mk_lease(l8, org, u3, c2, v_today - 30, v_today + 300);
  perform 1 from public.activate_lease(l8, v_today - 30, s_ok);
  begin
    perform 1 from public.end_lease(l8, v_today + 1, 'other', s_ok);
    raise exception 'FAIL 11a: an end date in the future was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_end_in_future' then raise exception 'FAIL 11a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.end_lease(l8, v_today - 31, 'other', s_ok);
    raise exception 'FAIL 11b: an end date before the start was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_end_before_start' then raise exception 'FAIL 11b: wrong error: %', sqlerrm; end if;
  end;
  perform 1 from public.end_lease(l8, v_today, 'terminated_by_renter', s_ok);
  select status || '/' || ended_on::text || '/' || end_reason into v_text from leases where id = l8;
  if v_text <> 'ended/' || v_today::text || '/terminated_by_renter' then raise exception 'FAIL 11c: lease is %', v_text; end if;
  select status into v_text from units where id = u3;
  if v_text <> 'vacant' then raise exception 'FAIL 11c: unit status is %', v_text; end if;
  begin
    perform 1 from public.end_lease(l8, v_today, 'other', s_ok);
    raise exception 'FAIL 11d: an ended lease was ended again';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 11d: wrong error: %', sqlerrm; end if;
  end;

  -- 11e. Ending one of two active leases of a unit keeps the unit rented while the other is active.
  perform pg_temp.mk_lease(l9, org, u4, c1, v_today - 60, v_today + 30);
  perform pg_temp.mk_lease(l10, org, u4, c2, v_today + 31, v_today + 400);
  perform 1 from public.activate_lease(l9, v_today - 60, s_ok);
  perform 1 from public.activate_lease(l10, v_today, s_ok);
  perform 1 from public.end_lease(l9, v_today, 'term_reached', s_ok);
  select status into v_text from units where id = u4;
  if v_text <> 'rented' then raise exception 'FAIL 11e: unit status is % while another lease is active', v_text; end if;

  -- 12. A unit for sale stays for sale, whatever its leases do.
  update units set status = 'for_sale' where id = u5;
  perform pg_temp.mk_lease(l11, org, u5, c1, v_today, v_today + 100);
  perform 1 from public.activate_lease(l11, null, s_ok);
  perform 1 from public.end_lease(l11, v_today, 'other', s_ok);
  select status into v_text from units where id = u5;
  if v_text <> 'for_sale' then raise exception 'FAIL 12: unit status is %', v_text; end if;

  -- 13. Rent changes.
  begin
    perform 1 from public.change_rent(l7, u2, v_today - 101, 100, 0, 'trop tot', s_ok);
    raise exception 'FAIL 13a: a rent before the start was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_rent_before_start' then raise exception 'FAIL 13a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.change_rent(l7, u3, v_today + 20, 100, 0, 'autre unite', s_ok);
    raise exception 'FAIL 13b: a rent for a unit outside the lease was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_unit_not_found' then raise exception 'FAIL 13b: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.change_rent(l2, u2, v_today + 20, 100, 0, 'brouillon', s_ok);
    raise exception 'FAIL 13c: a rent change on a draft was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 13c: wrong error: %', sqlerrm; end if;
  end;
  perform 1 from public.change_rent(l7, u2, v_today + 20, 780, 30, 'Indexation', s_ok);
  select count(*) into n from lease_rents where lease_id = l7 and unit_id = u2;
  if n <> 3 then raise exception 'FAIL 13d: rent rows: %', n; end if;
  begin
    perform 1 from public.change_rent(l7, u2, v_today + 20, 790, 30, 'meme jour', s_ok);
    raise exception 'FAIL 13e: two rents on the same day accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%lease_rents_lease_id_unit_id_effective_from_key%' then raise exception 'FAIL 13e: wrong error: %', sqlerrm; end if;
  end;

  -- 14. Expiry: day 7 after the end date stays active, day 8 expires; a lease in its grace week can still be renewed.
  perform pg_temp.mk_lease(l12, org, u3, c2, v_today - 300, v_today - 8);
  perform pg_temp.mk_lease(l13, org, u7, c1, v_today - 300, v_today - 7);
  update leases set status = 'active', signed_at = v_today - 300 where id in (l12, l13);
  select count(*) into n from public.expire_overdue_leases() where id in (l12, l13);
  if n <> 1 then raise exception 'FAIL 14a: expired % of the two leases', n; end if;
  select status || '/' || ended_on::text || '/' || end_reason into v_text from leases where id = l12;
  if v_text <> 'expired/' || (v_today - 8)::text || '/expired_auto' then raise exception 'FAIL 14b: lease is %', v_text; end if;
  select status into v_text from leases where id = l13;
  if v_text <> 'active' then raise exception 'FAIL 14c: day-7 lease is %', v_text; end if;
  select status into v_text from units where id = u3;
  if v_text <> 'vacant' then raise exception 'FAIL 14d: unit of the expired lease is %', v_text; end if;
  select status into v_text from units where id = u7;
  if v_text <> 'rented' then raise exception 'FAIL 14e: unit of the lease in grace is %', v_text; end if;
  perform 1 from public.renew_lease(l13, v_today + 60, null, 'grace', s_ok);
  select end_date into v_date from leases where id = l13;
  if v_date <> v_today + 60 then raise exception 'FAIL 14f: renewal in the grace week gave %', v_date; end if;
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: error `function public.activate_lease(uuid, unknown, json) does not exist`, then `TESTS FAILED`.

- [ ] **Step 4: Write the implementation** — in `db/migrations/0003_leases.sql` replace the line `-- <<< PART 2 (task 4): sync, overlap, lease functions` with:

```sql
-- Unit status follows the leases: a unit with an active lease is rented, otherwise vacant. Units for sale,
-- sold or under maintenance are never touched (their status says something a lease cannot).
create or replace function public.sync_unit_status(p_unit uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_target text;
begin
  v_target := case when exists (
      select 1 from public.lease_units lu join public.leases l on l.id = lu.lease_id
      where lu.unit_id = p_unit and l.status = 'active'
    ) then 'rented' else 'vacant' end;
  update public.units set status = v_target
  where id = p_unit and status in ('rented', 'vacant') and status <> v_target;
end;
$$;

create or replace function public.leases_sync_units()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unit uuid;
begin
  for v_unit in select unit_id from public.lease_units where lease_id = new.id loop
    perform public.sync_unit_status(v_unit);
  end loop;
  return null;
end;
$$;

create trigger leases_sync_units after insert or update of status on public.leases
  for each row execute function public.leases_sync_units();

-- Who is calling: Hasura passes its session variables as json. Only org_admin and manager may act.
create or replace function public.lease_session_org(p_session json)
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_role text := p_session ->> 'x-hasura-role';
  v_org  uuid := nullif(p_session ->> 'x-hasura-org-id', '')::uuid;
begin
  if v_org is null or v_role is null or v_role not in ('org_admin', 'manager') then
    raise exception 'lease_forbidden' using errcode = '42501';
  end if;
  return v_org;
end;
$$;

-- A unit cannot be on two leases whose occupied periods overlap (both ends inclusive). The occupied period
-- of an active, ended or expired lease runs from its start to its end (or the day it really ended).
-- Drafts reserve nothing. One advisory lock per unit, taken in a fixed order, so two simultaneous
-- activations queue up instead of both passing.
create or replace function public.assert_no_lease_overlap(p_lease uuid, p_start date, p_end date)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_number integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(lu.unit_id::text, 0))
  from (select unit_id from public.lease_units where lease_id = p_lease order by unit_id) lu;

  select l.number into v_number
  from public.lease_units mine
  join public.lease_units other on other.unit_id = mine.unit_id and other.lease_id <> mine.lease_id
  join public.leases l on l.id = other.lease_id and l.status in ('active', 'ended', 'expired')
  where mine.lease_id = p_lease
    and daterange(l.start_date, coalesce(l.ended_on, l.end_date), '[]') && daterange(p_start, p_end, '[]')
  order by l.number
  limit 1;

  if v_number is not null then
    raise exception 'lease_overlap:%', v_number using errcode = '23P01';
  end if;
end;
$$;

-- draft -> active. Needs a renter, a unit and a first rent for every unit; no overlap with another lease.
create or replace function public.activate_lease(p_lease_id uuid, p_signed_on date default null, hasura_session json default null)
returns setof public.leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid := public.lease_session_org(hasura_session);
  v_lease public.leases;
begin
  select * into v_lease from public.leases where id = p_lease_id and organization_id = v_org for update;
  if not found then raise exception 'lease_not_found' using errcode = 'P0002'; end if;
  if v_lease.status <> 'draft' then raise exception 'lease_not_draft' using errcode = '23514'; end if;
  if not exists (select 1 from public.lease_parties where lease_id = v_lease.id and role = 'renter') then
    raise exception 'lease_needs_renter' using errcode = '23514';
  end if;
  if not exists (select 1 from public.lease_units where lease_id = v_lease.id) then
    raise exception 'lease_needs_unit' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.lease_units lu
    where lu.lease_id = v_lease.id
      and not exists (select 1 from public.lease_rents r where r.lease_id = lu.lease_id and r.unit_id = lu.unit_id)
  ) then
    raise exception 'lease_needs_rent' using errcode = '23514';
  end if;
  perform public.assert_no_lease_overlap(v_lease.id, v_lease.start_date, v_lease.end_date);

  perform set_config('erp.lease_action', 'on', true);
  update public.leases set status = 'active', signed_at = coalesce(p_signed_on, public.today_tunis()) where id = v_lease.id;
  insert into public.lease_terms (organization_id, lease_id, kind, start_date, end_date)
  values (v_org, v_lease.id, 'initial', v_lease.start_date, v_lease.end_date);
  perform set_config('erp.lease_action', 'off', true);
  return query select * from public.leases where id = v_lease.id;
end;
$$;

-- Renewal extends the same lease: the end date moves and a term row is logged. Allowed while the lease is
-- active, including its 7-day grace week. New rents (optional) start the day after the old end date.
create or replace function public.renew_lease(p_lease_id uuid, p_new_end_date date, p_rents jsonb default null, p_note text default null, hasura_session json default null)
returns setof public.leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid := public.lease_session_org(hasura_session);
  v_lease public.leases;
begin
  select * into v_lease from public.leases where id = p_lease_id and organization_id = v_org for update;
  if not found then raise exception 'lease_not_found' using errcode = 'P0002'; end if;
  if v_lease.status <> 'active' then raise exception 'lease_not_active' using errcode = '23514'; end if;
  if p_new_end_date is null or p_new_end_date <= greatest(v_lease.end_date, public.today_tunis()) then
    raise exception 'lease_renewal_not_after' using errcode = '23514';
  end if;
  perform public.assert_no_lease_overlap(v_lease.id, v_lease.start_date, p_new_end_date);

  perform set_config('erp.lease_action', 'on', true);
  insert into public.lease_terms (organization_id, lease_id, kind, start_date, end_date, note)
  values (v_org, v_lease.id, 'renewal', v_lease.end_date + 1, p_new_end_date, nullif(trim(p_note), ''));
  update public.leases set end_date = p_new_end_date where id = v_lease.id;
  if p_rents is not null and jsonb_typeof(p_rents) = 'array' then
    insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount, reason)
    select v_org, v_lease.id, (r ->> 'unit_id')::uuid, v_lease.end_date + 1,
           (r ->> 'rent_amount')::numeric, coalesce((r ->> 'charges_amount')::numeric, 0), 'renewal'
    from jsonb_array_elements(p_rents) r;
  end if;
  perform set_config('erp.lease_action', 'off', true);
  return query select * from public.leases where id = v_lease.id;
end;
$$;

-- active -> ended, on a date between the start and today (the renter has really left).
create or replace function public.end_lease(p_lease_id uuid, p_ended_on date, p_reason text default null, hasura_session json default null)
returns setof public.leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid := public.lease_session_org(hasura_session);
  v_lease public.leases;
begin
  select * into v_lease from public.leases where id = p_lease_id and organization_id = v_org for update;
  if not found then raise exception 'lease_not_found' using errcode = 'P0002'; end if;
  if v_lease.status <> 'active' then raise exception 'lease_not_active' using errcode = '23514'; end if;
  if p_ended_on is null or p_ended_on < v_lease.start_date then
    raise exception 'lease_end_before_start' using errcode = '23514';
  end if;
  if p_ended_on > public.today_tunis() then raise exception 'lease_end_in_future' using errcode = '23514'; end if;

  perform set_config('erp.lease_action', 'on', true);
  update public.leases
  set status = 'ended', ended_on = p_ended_on, end_reason = coalesce(nullif(trim(p_reason), ''), 'other')
  where id = v_lease.id;
  perform set_config('erp.lease_action', 'off', true);
  return query select * from public.leases where id = v_lease.id;
end;
$$;

-- A rent change on an active lease: adds a rent row for one of its units, from a date.
create or replace function public.change_rent(
  p_lease_id uuid, p_unit_id uuid, p_effective_from date, p_rent numeric, p_charges numeric default 0, p_reason text default null, hasura_session json default null)
returns setof public.leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org   uuid := public.lease_session_org(hasura_session);
  v_lease public.leases;
begin
  select * into v_lease from public.leases where id = p_lease_id and organization_id = v_org for update;
  if not found then raise exception 'lease_not_found' using errcode = 'P0002'; end if;
  if v_lease.status <> 'active' then raise exception 'lease_not_active' using errcode = '23514'; end if;
  if not exists (select 1 from public.lease_units where lease_id = v_lease.id and unit_id = p_unit_id) then
    raise exception 'lease_unit_not_found' using errcode = 'P0002';
  end if;
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount, reason)
  values (v_org, v_lease.id, p_unit_id, p_effective_from, p_rent, coalesce(p_charges, 0), nullif(trim(p_reason), ''));
  return query select * from public.leases where id = v_lease.id;
end;
$$;

-- Daily job (admin only, no role permission): an active lease whose grace week is over expires and frees its unit.
create or replace function public.expire_overdue_leases()
returns setof public.leases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('erp.lease_action', 'on', true);
  return query
  with expired as (
    update public.leases
    set status = 'expired', ended_on = end_date, end_reason = 'expired_auto'
    where status = 'active' and end_date + public.lease_rule('grace_days') < public.today_tunis()
    returning *
  )
  select * from expired;
  perform set_config('erp.lease_action', 'off', true);
end;
$$;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: `ERROR:  OK: all lease tests passed`. On a `FAIL n:` line, fix the migration (never the test) and repeat.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/0003_leases.sql db/tests/0003_leases.test.sql
git commit -m "feat(db): lease functions, overlap rule and unit-status sync (migration 0003, part 2)"
```

---

### Task 5: Migration 0003, part 3 — views for the list, the fiche, the unit and the dashboard

**Files:**
- Modify: `db/migrations/0003_leases.sql` (replace the `<<< PART 3` marker), `db/tests/0003_leases.test.sql` (add above the `<<< NEXT TESTS (task 5)` marker)

**Interfaces:**
- Produces (SQL views, all with `organization_id`, tracked in Hasura in Task 6):
  - `public.current_lease_rents` — `organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount, next_change_on, next_rent_amount, next_charges_amount` (one row per leased unit: the latest rent starting on or before today, or the earliest one when none has started).
  - `public.lease_overview` — `id, organization_id, number, status, start_date, end_date, payment_day, deposit_amount, signed_at, registered_at, registration_receipt, ended_on, end_reason, archived_at, unit_count, unit_codes, renter_names, total_rent, total_charges, is_ending_soon, in_grace, grace_days_left, registration_deadline, registration_state`.
  - `public.unit_current_lease` — `organization_id, unit_id, lease_id, number, start_date, end_date, renter_names, in_grace, is_ending_soon, rent_amount, charges_amount`.
- `registration_state` values: `not_applicable | registered | pending | due_soon | overdue`.

- [ ] **Step 1: Write the failing tests** — insert above `-- <<< NEXT TESTS (task 5) go above this line`

```sql
  -- 15. Views. Leases without units are enough for the flags.
  select unit_count || '/' || unit_codes || '/' || renter_names || '/' || total_rent::text || '/' || total_charges::text
  into v_text from lease_overview where id = l3;
  if v_text <> '1/L-1/Locataire Un/800.000/50.000' then raise exception 'FAIL 15a: overview of l3 is %', v_text; end if;

  insert into leases (id, organization_id, status, start_date, end_date, signed_at) values
    (l14, org, 'active', v_today - 100, v_today + 20, v_today - 10),   -- ending soon, registration pending
    (l15, org, 'active', v_today - 300, v_today - 3,  v_today - 300),  -- grace week
    (l16, org, 'active', v_today - 60,  v_today + 300, v_today - 55),  -- registration due in 5 days
    (l17, org, 'active', v_today - 80,  v_today + 300, v_today - 70);  -- registration overdue
  insert into leases (id, organization_id, status, start_date, end_date, signed_at, registered_at) values
    (l18, org, 'active', v_today - 80, v_today + 300, v_today - 70, v_today - 65);
  insert into leases (id, organization_id, start_date, end_date) values (l19, org, v_today, v_today + 100);

  select is_ending_soon::text || '/' || in_grace::text || '/' || registration_state into v_text from lease_overview where id = l14;
  if v_text <> 'true/false/pending' then raise exception 'FAIL 15b: l14 is %', v_text; end if;
  select is_ending_soon::text || '/' || in_grace::text || '/' || grace_days_left::text into v_text from lease_overview where id = l15;
  if v_text <> 'false/true/4' then raise exception 'FAIL 15b: l15 is %', v_text; end if;
  select registration_state || '/' || registration_deadline::text into v_text from lease_overview where id = l16;
  if v_text <> 'due_soon/' || (v_today + 5)::text then raise exception 'FAIL 15c: l16 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l17;
  if v_text <> 'overdue' then raise exception 'FAIL 15c: l17 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l18;
  if v_text <> 'registered' then raise exception 'FAIL 15c: l18 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l19;
  if v_text <> 'not_applicable' then raise exception 'FAIL 15c: the draft l19 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l8;
  if v_text <> 'not_applicable' then raise exception 'FAIL 15c: the ended, unregistered l8 is %', v_text; end if;

  -- 15d. Current and next rent: l7 has 700 now, 750 from +11 days, 780 from +20 days.
  select rent_amount::text || '/' || next_change_on::text || '/' || next_rent_amount::text into v_text
  from current_lease_rents where lease_id = l7 and unit_id = u2;
  if v_text <> '700.000/' || (v_today + 11)::text || '/750.000' then raise exception 'FAIL 15d: l7 rent is %', v_text; end if;
  -- a lease that has not started yet shows its first rent as current, with no "next change" of its own
  select rent_amount::text || '/' || coalesce(next_change_on::text, 'none') into v_text
  from current_lease_rents where lease_id = l5 and unit_id = u1;
  if v_text <> '500.000/none' then raise exception 'FAIL 15d: l5 rent is %', v_text; end if;

  -- 15e. The unit sees its active lease.
  select number into n from unit_current_lease where unit_id = u6 and lease_id = l1;
  if n is null then raise exception 'FAIL 15e: unit_current_lease misses l1 on u6'; end if;
  select count(*) into n from unit_current_lease where unit_id = u2;
  if n <> 1 then raise exception 'FAIL 15e: u2 has % current leases', n; end if;

  -- 15f. Nothing reads the server clock directly: "today" is Tunisia (the session runs in UTC).
  if position('Africa/Tunis' in pg_get_functiondef('public.today_tunis()'::regprocedure)) = 0 then
    raise exception 'FAIL 15f: today_tunis does not use Africa/Tunis';
  end if;
  foreach v_text in array array['public.lease_overview', 'public.current_lease_rents', 'public.unit_current_lease'] loop
    if pg_get_viewdef(v_text::regclass) ilike '%current_date%' or pg_get_viewdef(v_text::regclass) like '%now()%' then
      raise exception 'FAIL 15f: % reads the server clock', v_text;
    end if;
  end loop;
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: error `relation "lease_overview" does not exist`, then `TESTS FAILED`.

- [ ] **Step 3: Write the views** — in `db/migrations/0003_leases.sql` replace the line `-- <<< PART 3 (task 5): views` with:

```sql
-- Current rent per leased unit: the latest row starting on or before today; when none has started yet,
-- the earliest row. The next change is the first row after both today and the current row.
create view public.current_lease_rents as
with ranked as (
  select r.*,
         row_number() over (
           partition by r.lease_id, r.unit_id
           order by (r.effective_from <= public.today_tunis()) desc,
                    case when r.effective_from <= public.today_tunis() then r.effective_from end desc nulls last,
                    r.effective_from asc
         ) as rn
  from public.lease_rents r
)
select k.organization_id, k.lease_id, k.unit_id, k.effective_from, k.rent_amount, k.charges_amount,
       nx.effective_from as next_change_on, nx.rent_amount as next_rent_amount, nx.charges_amount as next_charges_amount
from ranked k
left join lateral (
  select n.effective_from, n.rent_amount, n.charges_amount
  from public.lease_rents n
  where n.lease_id = k.lease_id and n.unit_id = k.unit_id
    and n.effective_from > greatest(k.effective_from, public.today_tunis())
  order by n.effective_from
  limit 1
) nx on true
where k.rn = 1;

-- One row per lease for the list, the fiche and the dashboard, with every flag already computed.
create view public.lease_overview as
select l.id, l.organization_id, l.number, l.status, l.start_date, l.end_date, l.payment_day, l.deposit_amount,
       l.signed_at, l.registered_at, l.registration_receipt, l.ended_on, l.end_reason, l.archived_at,
       coalesce(u.unit_count, 0) as unit_count,
       u.unit_codes,
       r.renter_names,
       coalesce(c.total_rent, 0) as total_rent,
       coalesce(c.total_charges, 0) as total_charges,
       (l.status = 'active' and l.end_date >= public.today_tunis()
         and l.end_date <= public.today_tunis() + public.lease_rule('ending_soon_days')) as is_ending_soon,
       (l.status = 'active' and l.end_date < public.today_tunis()
         and l.end_date + public.lease_rule('grace_days') >= public.today_tunis()) as in_grace,
       case when l.status = 'active' and l.end_date < public.today_tunis()
            then greatest(l.end_date + public.lease_rule('grace_days') - public.today_tunis(), 0) end as grace_days_left,
       l.signed_at + public.lease_rule('registration_days') as registration_deadline,
       case
         when l.status = 'draft' or l.signed_at is null then 'not_applicable'
         when l.registered_at is not null then 'registered'
         when l.status in ('ended', 'expired') then 'not_applicable'
         when public.today_tunis() > l.signed_at + public.lease_rule('registration_days') then 'overdue'
         when public.today_tunis() >= l.signed_at + public.lease_rule('registration_days') - public.lease_rule('registration_warning_days') then 'due_soon'
         else 'pending'
       end as registration_state
from public.leases l
left join lateral (
  select count(*)::integer as unit_count, string_agg(un.code, ', ' order by un.code) as unit_codes
  from public.lease_units lu join public.units un on un.id = lu.unit_id
  where lu.lease_id = l.id
) u on true
left join lateral (
  select string_agg(co.full_name, ', ' order by co.full_name) as renter_names
  from public.lease_parties lp join public.contacts co on co.id = lp.contact_id
  where lp.lease_id = l.id and lp.role = 'renter'
) r on true
left join lateral (
  select sum(cr.rent_amount) as total_rent, sum(cr.charges_amount) as total_charges
  from public.current_lease_rents cr
  where cr.lease_id = l.id
) c on true;

-- The active lease(s) of each unit, with the renters and the current rent.
create view public.unit_current_lease as
select o.organization_id, lu.unit_id, o.id as lease_id, o.number, o.start_date, o.end_date, o.renter_names,
       o.in_grace, o.is_ending_soon, cr.rent_amount, cr.charges_amount
from public.lease_units lu
join public.lease_overview o on o.id = lu.lease_id and o.status = 'active'
left join public.current_lease_rents cr on cr.lease_id = lu.lease_id and cr.unit_id = lu.unit_id;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql`
Expected: `ERROR:  OK: all lease tests passed`. Also confirm Project 1 still passes: `bash scripts/db-local.sh test db/tests/0002_core_records.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0003_leases.sql db/tests/0003_leases.test.sql
git commit -m "feat(db): lease overview, current rents and unit lease views (migration 0003, part 3)"
```

---

### Task 6: Hasura tracking, relationships, permissions and function permissions

`scripts/apply-hasura-permissions.mjs` stays one additive, idempotent script. This task extends its tables, adds a `--dry-run` that needs no secret and no network, and extends `check-hasura.mjs`.

**Files:**
- Modify: `scripts/apply-hasura-permissions.mjs`, `scripts/check-hasura.mjs`

**Interfaces:**
- Consumes: tables, views and functions of migration 0003.
- Produces (GraphQL for the web tasks):
  - Tables/views with select for `org_admin | manager | viewer`: `leases`, `lease_units`, `lease_parties`, `lease_rents`, `lease_terms`, `lease_files`, `lease_overview`, `current_lease_rents`, `unit_current_lease`.
  - Insert for writers: `insert_leases_one` (columns `id, start_date, end_date, payment_day, deposit_amount`), `insert_lease_units` (`lease_id, unit_id`), `insert_lease_parties` (`lease_id, contact_id, role`), `insert_lease_rents` (`lease_id, unit_id, effective_from, rent_amount, charges_amount, reason`), `insert_lease_files` (`lease_id, storage_file_id, category, title`); update `update_leases_by_pk` (`start_date, end_date, payment_day, deposit_amount, registered_at, registration_receipt, archived_at`; the database guard refuses date and archive changes on non-draft leases); delete on `lease_units`, `lease_parties`, `lease_files`.
  - Mutations for writers: `activate_lease(args: {p_lease_id, p_signed_on})`, `renew_lease(args: {p_lease_id, p_new_end_date, p_rents, p_note})`, `end_lease(args: {p_lease_id, p_ended_on, p_reason})`, `change_rent(args: {p_lease_id, p_unit_id, p_effective_from, p_rent, p_charges, p_reason})`, each returning `[leases]`. `expire_overdue_leases` is tracked for the admin role only.
  - Relationships: `leases.{units, parties, rents, terms, files, overview, current_rents}`, `lease_units.{unit, lease}`, `lease_parties.{contact, lease}`, `lease_rents.unit`, `current_lease_rents.unit`, `units.{lease_units, current_lease}`, `contacts.lease_parties`, `storage.files.lease_links`.

- [ ] **Step 1: Allow a dry run** — in `scripts/apply-hasura-permissions.mjs` replace

```js
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
```

with

```js
const SECRET = process.env.HASURA_ADMIN_SECRET;
const DRY_RUN = process.argv.includes('--dry-run');
if (!SECRET && !DRY_RUN) {
```

- [ ] **Step 2: Run the dry run to see it is not supported yet**

Run: `node scripts/apply-hasura-permissions.mjs --dry-run`
Expected: the script goes on to call Hasura with an undefined secret and fails (network or 401 error) instead of printing a summary. This is the failing state; Step 12 adds the summary.

- [ ] **Step 3: Several buckets** — replace `const BUCKET = 'property-files';` with:

```js
const BUCKETS = ['property-files', 'lease-files'];
```

and replace the two uses: `const ownUpload = { _and: [{ bucket_id: { _eq: BUCKET } }, { uploaded_by_user_id: { _eq: USER_VAR } }] };` with

```js
const ownUpload = { _and: [{ bucket_id: { _in: BUCKETS } }, { uploaded_by_user_id: { _eq: USER_VAR } }] };
```

and `check: { bucket_id: { _eq: BUCKET } },` with `check: { bucket_id: { _in: BUCKETS } },`.

- [ ] **Step 4: Track the new tables and views** — replace the `TRACK` constant with:

```js
const TRACK = [
  'ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps',
  'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'lease_files',
  'lease_overview', 'current_lease_rents', 'unit_current_lease',
];
```

- [ ] **Step 5: Select columns** — in `SELECT_COLUMNS`, after the `common_areas` entry add:

```js
  leases: [
    'id', 'organization_id', 'number', 'status', 'start_date', 'end_date', 'payment_day', 'deposit_amount',
    'signed_at', 'registered_at', 'registration_receipt', 'ended_on', 'end_reason', 'archived_at', 'created_at', 'updated_at',
  ],
  lease_units: ['organization_id', 'lease_id', 'unit_id', 'created_at'],
  lease_parties: ['organization_id', 'lease_id', 'contact_id', 'role', 'created_at'],
  lease_rents: ['id', 'organization_id', 'lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount', 'reason', 'created_at'],
  lease_terms: ['id', 'organization_id', 'lease_id', 'kind', 'start_date', 'end_date', 'recorded_on', 'note', 'created_at'],
  lease_files: ['id', 'organization_id', 'lease_id', 'storage_file_id', 'category', 'title', 'created_at', 'updated_at'],
  lease_overview: [
    'id', 'organization_id', 'number', 'status', 'start_date', 'end_date', 'payment_day', 'deposit_amount',
    'signed_at', 'registered_at', 'registration_receipt', 'ended_on', 'end_reason', 'archived_at',
    'unit_count', 'unit_codes', 'renter_names', 'total_rent', 'total_charges',
    'is_ending_soon', 'in_grace', 'grace_days_left', 'registration_deadline', 'registration_state',
  ],
  current_lease_rents: [
    'organization_id', 'lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount',
    'next_change_on', 'next_rent_amount', 'next_charges_amount',
  ],
  unit_current_lease: [
    'organization_id', 'unit_id', 'lease_id', 'number', 'start_date', 'end_date', 'renter_names',
    'in_grace', 'is_ending_soon', 'rent_amount', 'charges_amount',
  ],
```

- [ ] **Step 6: Write columns** — in `WRITE_COLUMNS`, after the `common_areas` entry add:

```js
  leases: {
    roles: WRITERS,
    insert: ['id', 'start_date', 'end_date', 'payment_day', 'deposit_amount'],
    update: ['start_date', 'end_date', 'payment_day', 'deposit_amount', 'registered_at', 'registration_receipt', 'archived_at'],
  },
  lease_units: { roles: WRITERS, insert: ['lease_id', 'unit_id'], update: null, canDelete: true },
  lease_parties: { roles: WRITERS, insert: ['lease_id', 'contact_id', 'role'], update: null, canDelete: true },
  lease_rents: {
    roles: WRITERS,
    insert: ['lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount', 'reason'],
    update: null,
  },
  lease_files: {
    roles: WRITERS,
    insert: ['lease_id', 'storage_file_id', 'category', 'title'],
    update: ['category', 'title'],
    canDelete: true,
  },
```

(`lease_terms`, the views and the status, number and ended fields of `leases` are never writable by clients.)

- [ ] **Step 7: Relationships** — in `RELATIONSHIPS`, after the `properties.common_areas` entry add:

```js
  { type: 'array', table: 'leases', name: 'units', to: 'lease_units', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_units', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'lease_units', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'array', table: 'leases', name: 'parties', to: 'lease_parties', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_parties', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'object', table: 'lease_parties', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'array', table: 'leases', name: 'rents', to: 'lease_rents', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_rents', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'leases', name: 'terms', to: 'lease_terms', map: { id: 'lease_id' } },
  { type: 'array', table: 'leases', name: 'files', to: 'lease_files', map: { id: 'lease_id' } },
  { type: 'object', table: 'leases', name: 'overview', to: 'lease_overview', map: { id: 'id' } },
  { type: 'array', table: 'leases', name: 'current_rents', to: 'current_lease_rents', map: { id: 'lease_id' } },
  { type: 'object', table: 'current_lease_rents', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'units', name: 'lease_units', to: 'lease_units', map: { id: 'unit_id' } },
  { type: 'array', table: 'units', name: 'current_lease', to: 'unit_current_lease', map: { id: 'unit_id' } },
  { type: 'array', table: 'contacts', name: 'lease_parties', to: 'lease_parties', map: { id: 'contact_id' } },
```

- [ ] **Step 8: Storage links to both file tables** — replace

```js
const linkedToOrg = { property_links: { organization_id: { _eq: ORG_VAR } } };
```

with

```js
const linkedToOrg = {
  _or: [
    { property_links: { organization_id: { _eq: ORG_VAR } } },
    { lease_links: { organization_id: { _eq: ORG_VAR } } },
  ],
};
```

Then, right after the line `drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'property_links' } });` add:

```js
drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'lease_links' } });
```

and right after the `creates.push({ type: 'pg_create_array_relationship', args: { source, table: storageFiles, name: 'property_links', ... } });` block add:

```js
creates.push({
  type: 'pg_create_array_relationship',
  args: {
    source,
    table: storageFiles,
    name: 'lease_links',
    using: { manual_configuration: { remote_table: table('lease_files'), column_mapping: { id: 'storage_file_id' } } },
  },
});
```

- [ ] **Step 9: Track the functions and give the writers permission** — add this block just before `async function metadata(body) {`:

```js
// Lease functions are exposed as mutations. The writers' functions receive the Hasura session
// (hasura_session) so the database can check the caller's organization and role itself.
// expire_overdue_leases has no role permission: only the admin secret (the daily job) can call it.
const WRITER_FUNCTIONS = ['activate_lease', 'renew_lease', 'end_lease', 'change_rent'];
const ADMIN_FUNCTIONS = ['expire_overdue_leases'];
const fn = (name) => ({ schema: 'public', name });
for (const name of [...WRITER_FUNCTIONS, ...ADMIN_FUNCTIONS]) {
  for (const role of WRITERS) drops.push({ type: 'pg_drop_function_permission', args: { source, function: fn(name), role } });
  drops.push({ type: 'pg_untrack_function', args: { source, function: fn(name) } });
  creates.push({
    type: 'pg_track_function',
    args: {
      source,
      function: fn(name),
      configuration: { exposed_as: 'mutation', ...(WRITER_FUNCTIONS.includes(name) ? { session_argument: 'hasura_session' } : {}) },
    },
  });
}
for (const name of WRITER_FUNCTIONS) {
  for (const role of WRITERS) {
    creates.push({ type: 'pg_create_function_permission', args: { source, function: fn(name), role } });
  }
}

// Every tracked table needs select columns, or nobody could read it.
for (const name of TRACK) {
  if (!SELECT_COLUMNS[name]) throw new Error(`TRACK has ${name} but SELECT_COLUMNS does not.`);
}

if (DRY_RUN) {
  const permissions = creates.filter((entry) => entry.type.endsWith('_permission')).length;
  console.log(
    `Dry run: ${TRACK.length} tracked tables/views, ${RELATIONSHIPS.length + 2} relationships, ` +
      `${permissions} permissions, ${WRITER_FUNCTIONS.length + ADMIN_FUNCTIONS.length} functions. Nothing sent.`,
  );
  process.exit(0);
}
```

- [ ] **Step 10: Fix the final message** — replace `const relationshipCount = RELATIONSHIPS.length + 1;` with `const relationshipCount = RELATIONSHIPS.length + 2;` (the two storage relationships `property_links` and `lease_links`). The `creates.length - relationshipCount` permission count now also includes the function tracking and permission entries; relabel the message: replace

```js
console.log(`Applied ${relationshipCount} relationships and ${creates.length - relationshipCount} permissions.`);
```

with

```js
console.log(`Applied ${relationshipCount} relationships and ${creates.length - relationshipCount} permissions and function entries.`);
```

- [ ] **Step 11: Extend the read-only check** — in `scripts/check-hasura.mjs` replace the `EXPECTED` line with:

```js
const EXPECTED = [
  'ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps',
  'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'lease_files',
  'lease_overview', 'current_lease_rents', 'unit_current_lease',
];
```

and replace the GraphQL query string of `asManager` with:

```js
  { query: '{ record_gaps_aggregate { aggregate { count } } units(limit: 1) { code common_share } lease_overview(limit: 1) { number status registration_state } }' },
```

and after the `Query as manager` log line add:

```js
const functions = (meta.json.sources?.[0]?.functions ?? []).map((f) => f.function.name);
for (const name of ['activate_lease', 'renew_lease', 'end_lease', 'change_rent', 'expire_overdue_leases']) {
  console.log(`  function ${name}: ${functions.includes(name) ? 'tracked' : 'NOT tracked'}`);
}
```

- [ ] **Step 12: Run the dry run**

Run: `node scripts/apply-hasura-permissions.mjs --dry-run`
Expected: exit code 0 and one line `Dry run: 15 tracked tables/views, 40 relationships, <n> permissions, 5 functions. Nothing sent.` (40 = the 22 existing relationships + 16 new + the 2 storage links). Also run `node --check scripts/check-hasura.mjs` → no output.

- [ ] **Step 13: Commit**

```bash
git add scripts/apply-hasura-permissions.mjs scripts/check-hasura.mjs
git commit -m "feat: Hasura tracking, permissions and function permissions for leases"
```

---

### Task 7: Demo seed, database review, and applying everything to the live Nhost project

The agent writes the seed, runs the reviewer and prepares the commands. **The user runs the live steps** (SQL console and the two Hasura scripts, which need the admin secret the agent never types).

**Files:**
- Create: `db/seeds/0003_demo_leases.sql`

- [ ] **Step 1: Write the seed** — `db/seeds/0003_demo_leases.sql` (ASCII only; idempotent through a guard on the first lease id; dates are relative to today in Tunis)

```sql
-- Demo data for 0003 (apply after 0001/0002 seeds and the 0003 migration). Safe to re-run.
-- Leases are created as drafts with their units, parties and first rents, then activated, like the app does.
-- Dates are relative to today (Tunis), so the demo always shows one lease ending soon, one in its grace
-- week, one whose registration is due in 5 days, one ended and one draft.
do $$
declare
  org uuid := '11111111-1111-4111-8111-111111111111';
  t   date := public.today_tunis();
  l1 uuid := '81111111-1111-4111-8111-111111111111';
  l2 uuid := '82222222-2222-4222-8222-222222222222';
  l3 uuid := '83333333-3333-4333-8333-333333333333';
  l4 uuid := '84444444-4444-4444-8444-444444444444';
  l5 uuid := '85555555-5555-4555-8555-555555555555';
begin
  if exists (select 1 from public.leases where id = l1) then
    return; -- already seeded
  end if;

  insert into public.leases (id, organization_id, start_date, end_date, payment_day, deposit_amount, signed_at, registered_at, registration_receipt) values
    (l1, org, t - 150, t + 20,  5, 1520, t - 160, t - 150, 'REC-2025-0412'),  -- C-12: ending in 20 days
    (l2, org, t - 360, t - 3,   1, 2500, t - 370, t - 360, 'REC-2025-0107'),  -- B-203: end date passed 3 days ago (grace week)
    (l3, org, t - 60,  t + 305, 10, 980, t - 55,  null,    null),             -- B-101: registration due in 5 days
    (l4, org, t - 400, t - 40,  1, 1100, t - 410, t - 400, 'REC-2024-0988'),  -- B-102: ended 40 days ago
    (l5, org, t + 10,  t + 375, 5, 1100, null,    null,    null);             -- B-102: draft, starts in 10 days

  insert into public.lease_units (organization_id, lease_id, unit_id) values
    (org, l1, '45555555-5555-4555-8555-555555555555'),
    (org, l2, '43333333-3333-4333-8333-333333333333'),
    (org, l3, '41111111-1111-4111-8111-111111111111'),
    (org, l4, '42222222-2222-4222-8222-222222222222'),
    (org, l5, '42222222-2222-4222-8222-222222222222');

  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values
    (org, l1, '53333333-3333-4333-8333-333333333333', 'renter'),    -- Mehdi Trabelsi
    (org, l2, '54444444-4444-4444-8444-444444444444', 'renter'),    -- SARL Carthage Digital
    (org, l2, '51111111-1111-4111-8111-111111111111', 'guarantor'), -- Hedi Ben Salem
    (org, l3, '55555555-5555-4555-8555-555555555555', 'renter'),    -- Salma Gharbi
    (org, l4, '54444444-4444-4444-8444-444444444444', 'renter'),
    (org, l5, '54444444-4444-4444-8444-444444444444', 'renter');

  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount)
  select org, l.id, lu.unit_id, l.start_date,
         case l.id when l1 then 760 when l2 then 1250 when l3 then 980 else 1100 end,
         case l.id when l2 then 60 when l3 then 40 else 0 end
  from public.leases l join public.lease_units lu on lu.lease_id = l.id
  where l.id in (l1, l2, l3, l4, l5);

  -- a rent increase already planned on B-101
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount, reason)
  values (org, l3, '41111111-1111-4111-8111-111111111111', t + 30, 1010, 40, 'Indexation');

  update public.leases set status = 'active' where id in (l1, l2, l3, l4);
  insert into public.lease_terms (organization_id, lease_id, kind, start_date, end_date)
  select organization_id, id, 'initial', start_date, end_date from public.leases where id in (l1, l2, l3, l4);

  -- the ended lease: ending is a lease action, so the guard flag is set for this statement
  perform set_config('erp.lease_action', 'on', true);
  update public.leases set status = 'ended', ended_on = t - 40, end_reason = 'term_reached' where id = l4;
  perform set_config('erp.lease_action', 'off', true);
end $$;
```

- [ ] **Step 2: Run it locally and look at the result**

Run: `bash scripts/db-local.sh up`, then:

```bash
docker exec erp-pg psql -U postgres -d erp -c "select number, status, unit_codes, renter_names, is_ending_soon, in_grace, registration_state from lease_overview order by number"
docker exec erp-pg psql -U postgres -d erp -c "select code, status from units order by code"
```

Expected: five leases — `1 active C-12 Mehdi Trabelsi t/f/registered`, `2 active B-203 SARL Carthage Digital f/t/registered`, `3 active B-101 Salma Gharbi f/f/due_soon`, `4 ended B-102 … not_applicable`, `5 draft B-102 … not_applicable`; units `B-101`, `B-203`, `C-12` rented, `B-102` vacant, `A-204` for_sale. Run the seed a second time with `bash scripts/db-local.sh apply db/seeds/0003_demo_leases.sql`: no error and still five leases.

- [ ] **Step 3: Review the SQL (mandatory)** — dispatch the `database-reviewer` agent:

```
Agent(subagent_type: "database-reviewer", prompt: "Review db/migrations/0003_leases.sql and db/seeds/0003_demo_leases.sql (read db/migrations/0001_foundation.sql and 0002_core_records.sql for context, and docs/superpowers/specs/2026-10-15-leases-design.md sections 3-6 for intent). Focus: SECURITY DEFINER functions (search_path, organization checks, the erp.lease_action flag), races (advisory locks), missing indexes on foreign keys, trigger ordering, anything that could leak data across organizations through Hasura. Report CRITICAL / HIGH / MEDIUM findings with the exact line and a fix.")
```

For each CRITICAL or HIGH finding: add a failing case to `db/tests/0003_leases.test.sql` first, fix the migration, run `bash scripts/db-local.sh up` then `bash scripts/db-local.sh test db/tests/0003_leases.test.sql` until `OK: all lease tests passed`, and commit (`fix(db): …`). Record the MEDIUM findings you do not fix in the handoff doc (Task 15).

- [ ] **Step 4: Commit the seed**

```bash
git add db/seeds/0003_demo_leases.sql
git commit -m "feat(db): demo leases seed"
```

- [ ] **Step 5: Live database — migration (user)**. The agent puts the file in the clipboard:

```powershell
Get-Content -Raw -Encoding UTF8 db\migrations\0003_leases.sql | Set-Clipboard
```

The user opens the Nhost dashboard → Database → SQL Editor, pastes, **leaves « Track this » off** (tracking is done by the script in Step 8), and runs. Expected: success. Verify with this query (the agent copies it the same way from a one-line file or the user types it):

```sql
select to_regclass('public.lease_overview'), to_regproc('public.activate_lease');
```

Expected: `lease_overview` and `activate_lease`.

- [ ] **Step 6: Live database — tests (user)**

```powershell
Get-Content -Raw -Encoding UTF8 db\tests\0003_leases.test.sql | Set-Clipboard
```

Paste and run in the SQL Editor. Expected: the error `OK: all lease tests passed` (everything rolls back).

- [ ] **Step 7: Live database — seed (user)**

```powershell
Get-Content -Raw -Encoding UTF8 db\seeds\0003_demo_leases.sql | Set-Clipboard
```

Paste and run. Verify: `select number, status, unit_codes from lease_overview order by number;` returns five rows.

- [ ] **Step 8: Hasura (user; the agent never types the secret)** — from the worktree:

```powershell
$env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
node C:\Users\mbark\Projects\ERP_Real_Estate\.claude\worktrees\continuation-bdded2\scripts\apply-hasura-permissions.mjs
node C:\Users\mbark\Projects\ERP_Real_Estate\.claude\worktrees\continuation-bdded2\scripts\check-hasura.mjs
```

Expected: `Applied … relationships and … permissions and function entries.`; the check lists all 15 tables/views as `tracked`, the five functions as `tracked`, `Inconsistent metadata objects: []`, and `Query as manager:` returns data including `lease_overview`. Run them by full path (the main checkout has older copies). If a step fails, paste the output to the agent; fix the script or SQL, re-run the dry run and the harness, and repeat.

---

### Task 8: Lease logic library (money parsing, validation, tabs, flags)

Pure functions, fully tested. The pages never repeat this logic.

**Files:**
- Create: `web/src/lib/lease-types.ts`, `web/src/lib/leases.ts`, `web/src/lib/leases.test.ts`
- Modify: `web/vitest.config.ts`

**Interfaces:**
- Produces (`@/lib/lease-types`): `LeaseStatus`, `RegistrationState`, `EndReason`, `LeaseOverviewRow`, `LeaseUnitInput`, `LeaseDraftInput` (fields as in the code below).
- Produces (`@/lib/leases`):
  - `parseMoney(input: string): number | null` — « 980,5 », « 1 250,500 », « 1.250,500 », « 1,250.500 » → number; empty, negative, two decimal separators or letters → `null`.
  - `validateLeaseDraft(input: LeaseDraftInput): string | null` (French message or null).
  - `buildLeaseObjects(leaseId: string, input: LeaseDraftInput): { set; units; parties; rents }` — the objects of the GraphQL insert and update mutations.
  - `LEASE_TABS: { value: LeaseTab; label: string }[]`, `matchesLeaseTab(row, tab)`, `matchesLeaseSearch(row, needle)`, `leasePeriod(row)`, `formatLeaseNumber(n)`.
  - `leaseFlags(row, today): LeaseFlag[]` with `LeaseFlag = { key: string; label: string; tone: 'info' | 'warning' | 'danger' }`.
  - label maps `LEASE_STATUS_LABELS`, `END_REASON_LABELS`, `ENDABLE_REASONS`, `LEASE_DOCUMENT_CATEGORIES`.

- [ ] **Step 1: Write the types** — `web/src/lib/lease-types.ts`

```ts
export type LeaseStatus = 'draft' | 'active' | 'ended' | 'expired';
export type RegistrationState = 'not_applicable' | 'registered' | 'pending' | 'due_soon' | 'overdue';
export type EndReason = 'term_reached' | 'terminated_by_renter' | 'terminated_by_owner' | 'expired_auto' | 'other';

/** One row of the lease_overview view: everything the list, the fiche header and the tiles need. */
export type LeaseOverviewRow = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  unit_count: number;
  unit_codes: string | null;
  renter_names: string | null;
  total_rent: number | string;
  total_charges: number | string;
  is_ending_soon: boolean;
  in_grace: boolean;
  grace_days_left: number | null;
  registration_state: RegistrationState;
  registration_deadline: string | null;
};

export type LeaseUnitInput = { unitId: string; rent: string; charges: string };

/** What the lease form holds, as typed by the user (money and numbers are still text). */
export type LeaseDraftInput = {
  startDate: string;
  endDate: string;
  paymentDay: string;
  depositAmount: string;
  units: LeaseUnitInput[];
  renters: (string | null)[];
  guarantors: (string | null)[];
};
```

- [ ] **Step 2: Write the failing tests** — `web/src/lib/leases.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { LeaseDraftInput, LeaseOverviewRow } from './lease-types';
import {
  buildLeaseObjects,
  formatLeaseNumber,
  leaseFlags,
  leasePeriod,
  matchesLeaseSearch,
  matchesLeaseTab,
  parseMoney,
  validateLeaseDraft,
} from './leases';

describe('parseMoney', () => {
  it.each([
    ['980', 980],
    ['980,5', 980.5],
    ['980.5', 980.5],
    ['1 250,500', 1250.5],
    ['1 250,500', 1250.5],
    ['1 250,500', 1250.5],
    ['1.250,500', 1250.5],
    ['1,250.500', 1250.5],
    ['0', 0],
  ])('reads %j as %d', (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
  });

  it.each([[''], ['  '], ['abc'], ['-5'], ['12,5,3'], ['1.250.500'], ['5 TND']])('refuses %j', (text) => {
    expect(parseMoney(text)).toBeNull();
  });
});

const valid: LeaseDraftInput = {
  startDate: '2026-11-01',
  endDate: '2027-10-31',
  paymentDay: '5',
  depositAmount: '1 500',
  units: [{ unitId: 'u1', rent: '900', charges: '' }],
  renters: ['c1'],
  guarantors: ['c2'],
};

describe('validateLeaseDraft', () => {
  it('accepts a complete lease', () => {
    expect(validateLeaseDraft(valid)).toBeNull();
  });

  it.each([
    [{ startDate: '' }, 'Indiquez la date de début.'],
    [{ endDate: '' }, 'Indiquez la date de fin.'],
    [{ endDate: '2026-11-01' }, 'La date de fin doit suivre la date de début.'],
    [{ paymentDay: '31' }, 'Le jour de paiement doit être compris entre 1 et 28.'],
    [{ paymentDay: 'x' }, 'Le jour de paiement doit être compris entre 1 et 28.'],
    [{ depositAmount: 'beaucoup' }, 'Le dépôt de garantie n’est pas un montant valide.'],
    [{ units: [] }, 'Choisissez au moins une unité.'],
    [{ units: [{ unitId: 'u1', rent: '', charges: '' }] }, 'Indiquez le loyer de chaque unité.'],
    [{ units: [{ unitId: 'u1', rent: '900', charges: 'x' }] }, 'Les charges d’une unité ne sont pas un montant valide.'],
    [{ renters: [] }, 'Ajoutez au moins un locataire.'],
    [{ renters: [null] }, 'Choisissez un contact pour chaque ligne.'],
    [{ guarantors: [null] }, 'Choisissez un contact pour chaque ligne.'],
  ])('refuses %j', (patch, message) => {
    expect(validateLeaseDraft({ ...valid, ...patch })).toBe(message);
  });

  it('refuses the same contact as renter and guarantor, or twice as renter', () => {
    const message = 'Un même contact ne peut apparaître qu’une fois sur le bail (locataire ou garant).';
    expect(validateLeaseDraft({ ...valid, guarantors: ['c1'] })).toBe(message);
    expect(validateLeaseDraft({ ...valid, renters: ['c1', 'c1'], guarantors: [] })).toBe(message);
  });

  it('treats a blank deposit and blank charges as zero', () => {
    expect(validateLeaseDraft({ ...valid, depositAmount: '', units: [{ unitId: 'u1', rent: '900', charges: '' }] })).toBeNull();
  });
});

describe('buildLeaseObjects', () => {
  it('builds the objects of the four insert fields', () => {
    const built = buildLeaseObjects('L1', {
      ...valid,
      depositAmount: '1 500,5',
      units: [
        { unitId: 'u1', rent: '900,5', charges: '40' },
        { unitId: 'u2', rent: '700', charges: '' },
      ],
      renters: ['c1'],
      guarantors: ['c2'],
    });
    expect(built.set).toEqual({ start_date: '2026-11-01', end_date: '2027-10-31', payment_day: 5, deposit_amount: 1500.5 });
    expect(built.units).toEqual([
      { lease_id: 'L1', unit_id: 'u1' },
      { lease_id: 'L1', unit_id: 'u2' },
    ]);
    expect(built.parties).toEqual([
      { lease_id: 'L1', contact_id: 'c1', role: 'renter' },
      { lease_id: 'L1', contact_id: 'c2', role: 'guarantor' },
    ]);
    expect(built.rents).toEqual([
      { lease_id: 'L1', unit_id: 'u1', effective_from: '2026-11-01', rent_amount: 900.5, charges_amount: 40 },
      { lease_id: 'L1', unit_id: 'u2', effective_from: '2026-11-01', rent_amount: 700, charges_amount: 0 },
    ]);
  });
});

const row = (patch: Partial<LeaseOverviewRow> = {}): LeaseOverviewRow => ({
  id: 'L1',
  number: 12,
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  unit_count: 1,
  unit_codes: 'B-203',
  renter_names: 'SARL Carthage Digital',
  total_rent: 1250,
  total_charges: 60,
  is_ending_soon: false,
  in_grace: false,
  grace_days_left: null,
  registration_state: 'registered',
  registration_deadline: '2026-03-01',
  ...patch,
});

describe('tabs and search', () => {
  it('sorts leases into the five tabs', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b', status: 'draft' }),
      row({ id: 'c', is_ending_soon: true }),
      row({ id: 'd', in_grace: true }),
      row({ id: 'e', status: 'ended' }),
      row({ id: 'f', status: 'expired' }),
    ];
    const ids = (tab: Parameters<typeof matchesLeaseTab>[1]) => rows.filter((r) => matchesLeaseTab(r, tab)).map((r) => r.id);
    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(ids('active')).toEqual(['a', 'c', 'd']);
    expect(ids('draft')).toEqual(['b']);
    expect(ids('renew')).toEqual(['c', 'd']);
    expect(ids('ended')).toEqual(['e', 'f']);
  });

  it('finds a lease by number, unit or renter, ignoring case', () => {
    expect(matchesLeaseSearch(row(), '')).toBe(true);
    expect(matchesLeaseSearch(row(), '12')).toBe(true);
    expect(matchesLeaseSearch(row(), 'b-203')).toBe(true);
    expect(matchesLeaseSearch(row(), 'carthage')).toBe(true);
    expect(matchesLeaseSearch(row(), 'zzz')).toBe(false);
  });

  it('formats the number and the period', () => {
    expect(formatLeaseNumber(12)).toBe('Bail N° 12');
    expect(leasePeriod(row())).toBe('01/01/2026 → 31/12/2026');
  });
});

describe('leaseFlags', () => {
  const today = '2026-10-15';

  it('has no flag for a healthy lease', () => {
    expect(leaseFlags(row(), today)).toEqual([]);
  });

  it('announces the end of the lease', () => {
    const labels = (endDate: string) => leaseFlags(row({ is_ending_soon: true, end_date: endDate }), today).map((f) => f.label);
    expect(labels('2026-11-04')).toEqual(['Fin dans 20 jours']);
    expect(labels('2026-10-16')).toEqual(['Fin demain']);
    expect(labels('2026-10-15')).toEqual(['Fin aujourd’hui']);
  });

  it('shows the grace week with the days left', () => {
    expect(leaseFlags(row({ in_grace: true, grace_days_left: 4, end_date: '2026-10-12' }), today)).toEqual([
      { key: 'grace', label: 'Échu · à renouveler (4 j)', tone: 'warning' },
    ]);
  });

  it('warns about the registration only in the last days or when overdue', () => {
    expect(leaseFlags(row({ registration_state: 'pending', registration_deadline: '2026-12-01' }), today)).toEqual([]);
    expect(leaseFlags(row({ registration_state: 'due_soon', registration_deadline: '2026-10-20' }), today)).toEqual([
      { key: 'registration', label: 'Enregistrement avant le 20/10/2026', tone: 'warning' },
    ]);
    expect(leaseFlags(row({ registration_state: 'overdue', registration_deadline: '2026-10-01' }), today)).toEqual([
      { key: 'registration', label: 'Enregistrement en retard (échéance 01/10/2026)', tone: 'danger' },
    ]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run (from `web/`): `npx vitest run src/lib/leases.test.ts`
Expected: FAIL — `Cannot find module './leases'`.

- [ ] **Step 4: Write the implementation** — `web/src/lib/leases.ts`

```ts
import { daysBetween } from '@/lib/dates';
import type { EndReason, LeaseDraftInput, LeaseOverviewRow, LeaseStatus } from '@/lib/lease-types';
import { formatDateFr } from '@/lib/ownership';

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  ended: 'Terminé',
  expired: 'Expiré',
};

export const END_REASON_LABELS: Record<EndReason, string> = {
  term_reached: 'Fin du bail à son terme',
  terminated_by_renter: 'Résiliation par le locataire',
  terminated_by_owner: 'Résiliation par le bailleur',
  expired_auto: 'Expiré automatiquement',
  other: 'Autre motif',
};

/** Reasons staff can pick when ending a lease (expired_auto is set by the daily job only). */
export const ENDABLE_REASONS: EndReason[] = ['term_reached', 'terminated_by_renter', 'terminated_by_owner', 'other'];

export const LEASE_DOCUMENT_CATEGORIES = {
  signed_lease: 'Bail signé',
  id_document: 'Pièces d’identité',
  registration_receipt: 'Reçu d’enregistrement',
  other: 'Autres',
} as const;

export type LeaseDocumentCategory = keyof typeof LEASE_DOCUMENT_CATEGORIES;

export const formatLeaseNumber = (number: number): string => `Bail N° ${number}`;

export const leasePeriod = (row: Pick<LeaseOverviewRow, 'start_date' | 'end_date'>): string =>
  `${formatDateFr(row.start_date)} → ${formatDateFr(row.end_date)}`;

/**
 * Money typed by a person: « 980,5 », « 1 250,500 », « 1.250,500 », « 1,250.500 ».
 * The last separator is the decimal one and may appear once; the other kind is a thousands separator.
 */
export function parseMoney(input: string): number | null {
  const compact = input.replace(/[\s  ]/g, '');
  if (compact === '') return null;
  const decimalAt = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  let normalized = compact;
  if (decimalAt !== -1) {
    const decimalChar = compact[decimalAt];
    if (compact.split(decimalChar).length - 1 > 1) return null;
    normalized = compact.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + compact.slice(decimalAt + 1);
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateLeaseDraft(input: LeaseDraftInput): string | null {
  if (!input.startDate) return 'Indiquez la date de début.';
  if (!input.endDate) return 'Indiquez la date de fin.';
  if (input.endDate <= input.startDate) return 'La date de fin doit suivre la date de début.';
  const day = Number(input.paymentDay);
  if (!Number.isInteger(day) || day < 1 || day > 28) return 'Le jour de paiement doit être compris entre 1 et 28.';
  if (input.depositAmount.trim() !== '' && parseMoney(input.depositAmount) === null) {
    return 'Le dépôt de garantie n’est pas un montant valide.';
  }
  if (input.units.length === 0) return 'Choisissez au moins une unité.';
  for (const unit of input.units) {
    if (parseMoney(unit.rent) === null) return 'Indiquez le loyer de chaque unité.';
    if (unit.charges.trim() !== '' && parseMoney(unit.charges) === null) {
      return 'Les charges d’une unité ne sont pas un montant valide.';
    }
  }
  if (input.renters.length === 0) return 'Ajoutez au moins un locataire.';
  const contacts = [...input.renters, ...input.guarantors];
  if (contacts.some((contact) => !contact)) return 'Choisissez un contact pour chaque ligne.';
  if (new Set(contacts).size !== contacts.length) {
    return 'Un même contact ne peut apparaître qu’une fois sur le bail (locataire ou garant).';
  }
  return null;
}

/** Objects for the mutations: `set` updates a draft, `units`/`parties`/`rents` are inserted after it. */
export function buildLeaseObjects(leaseId: string, input: LeaseDraftInput) {
  return {
    set: {
      start_date: input.startDate,
      end_date: input.endDate,
      payment_day: Number(input.paymentDay),
      deposit_amount: parseMoney(input.depositAmount) ?? 0,
    },
    units: input.units.map((unit) => ({ lease_id: leaseId, unit_id: unit.unitId })),
    parties: [
      ...input.renters.map((contact) => ({ lease_id: leaseId, contact_id: contact as string, role: 'renter' as const })),
      ...input.guarantors.map((contact) => ({ lease_id: leaseId, contact_id: contact as string, role: 'guarantor' as const })),
    ],
    rents: input.units.map((unit) => ({
      lease_id: leaseId,
      unit_id: unit.unitId,
      effective_from: input.startDate,
      rent_amount: parseMoney(unit.rent) ?? 0,
      charges_amount: parseMoney(unit.charges) ?? 0,
    })),
  };
}

export type LeaseTab = 'all' | 'active' | 'draft' | 'renew' | 'ended';

export const LEASE_TABS: { value: LeaseTab; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'renew', label: 'À renouveler' },
  { value: 'ended', label: 'Terminés' },
];

export function matchesLeaseTab(row: Pick<LeaseOverviewRow, 'status' | 'is_ending_soon' | 'in_grace'>, tab: LeaseTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'active':
      return row.status === 'active';
    case 'draft':
      return row.status === 'draft';
    case 'renew':
      return row.is_ending_soon || row.in_grace;
    case 'ended':
      return row.status === 'ended' || row.status === 'expired';
  }
}

export function matchesLeaseSearch(row: Pick<LeaseOverviewRow, 'number' | 'unit_codes' | 'renter_names'>, needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (query === '') return true;
  return [`n° ${row.number}`, String(row.number), row.unit_codes ?? '', row.renter_names ?? ''].join(' ').toLowerCase().includes(query);
}

export type LeaseFlagTone = 'info' | 'warning' | 'danger';
export type LeaseFlag = { key: string; label: string; tone: LeaseFlagTone };

type FlagRow = Pick<
  LeaseOverviewRow,
  'is_ending_soon' | 'in_grace' | 'grace_days_left' | 'registration_state' | 'registration_deadline' | 'end_date'
>;

/** The badges next to a lease's status: ending soon, grace week, registration. All thresholds come from the database flags. */
export function leaseFlags(row: FlagRow, today: string): LeaseFlag[] {
  const flags: LeaseFlag[] = [];
  if (row.in_grace) {
    flags.push({ key: 'grace', label: `Échu · à renouveler (${row.grace_days_left ?? 0} j)`, tone: 'warning' });
  } else if (row.is_ending_soon) {
    const days = daysBetween(today, row.end_date);
    const label = days <= 0 ? 'Fin aujourd’hui' : days === 1 ? 'Fin demain' : `Fin dans ${days} jours`;
    flags.push({ key: 'ending', label, tone: 'info' });
  }
  if (row.registration_state === 'due_soon' && row.registration_deadline) {
    flags.push({ key: 'registration', label: `Enregistrement avant le ${formatDateFr(row.registration_deadline)}`, tone: 'warning' });
  }
  if (row.registration_state === 'overdue' && row.registration_deadline) {
    flags.push({
      key: 'registration',
      label: `Enregistrement en retard (échéance ${formatDateFr(row.registration_deadline)})`,
      tone: 'danger',
    });
  }
  return flags;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/leases.test.ts`
Expected: PASS (all cases). Then `npm test` → PASS.

- [ ] **Step 6: Add to coverage** — in `web/vitest.config.ts` `coverage.include` add `'src/lib/leases.ts',` after `'src/lib/show-error.ts',`. Run `npm run test:coverage` → thresholds met.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/lease-types.ts web/src/lib/leases.ts web/src/lib/leases.test.ts web/vitest.config.ts
git commit -m "feat: lease logic library — money parsing, validation, tabs, flags"
```

---

### Task 9: Lease list page `/baux`

**Files:**
- Create: `web/src/components/leases/lease-status-badge.tsx`, `web/src/app/(app)/baux/page.tsx`

**Interfaces:**
- Consumes: `lease_overview` view (live after Task 7), `matchesLeaseTab`, `matchesLeaseSearch`, `leaseFlags`, `leasePeriod`, `formatLeaseNumber`, `LEASE_TABS`, `LEASE_STATUS_LABELS`, `useCanEdit`, `useGraphql`, `formatTnd`, `todayTunis`.
- Produces: `<LeaseStatusBadge status />`, `<LeaseFlagBadges row />` (props: a `LeaseOverviewRow`-like with the flag fields), route `/baux`.

The branch filter of the spec is deferred (it needs a branch column on `lease_overview`); search and the five tabs ship now.

- [ ] **Step 1: Badges** — `web/src/components/leases/lease-status-badge.tsx`

```tsx
import { Badge } from '@/components/ui/badge';
import { todayTunis } from '@/lib/dates';
import type { LeaseOverviewRow, LeaseStatus } from '@/lib/lease-types';
import { LEASE_STATUS_LABELS, leaseFlags, type LeaseFlagTone } from '@/lib/leases';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<LeaseStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success/12 text-success',
  ended: 'bg-muted text-muted-foreground',
  expired: 'bg-destructive/10 text-destructive',
};

const TONE_CLASS: Record<LeaseFlagTone, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', STATUS_CLASS[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {LEASE_STATUS_LABELS[status]}
    </Badge>
  );
}

type FlagRow = Pick<
  LeaseOverviewRow,
  'is_ending_soon' | 'in_grace' | 'grace_days_left' | 'registration_state' | 'registration_deadline' | 'end_date'
>;

export function LeaseFlagBadges({ row }: { row: FlagRow }) {
  const flags = leaseFlags(row, todayTunis());
  return (
    <>
      {flags.map((flag) => (
        <Badge key={flag.key} variant="secondary" className={cn('h-6 px-2.5', TONE_CLASS[flag.tone])}>
          {flag.label}
        </Badge>
      ))}
    </>
  );
}
```

- [ ] **Step 2: The page** — `web/src/app/(app)/baux/page.tsx`

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from 'lucide-react';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatTnd } from '@/lib/format';
import type { LeaseOverviewRow } from '@/lib/lease-types';
import { formatLeaseNumber, LEASE_TABS, leasePeriod, matchesLeaseSearch, matchesLeaseTab, type LeaseTab } from '@/lib/leases';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const LEASES_QUERY = `
  query Leases {
    lease_overview(where: { archived_at: { _is_null: true } }, order_by: [{ number: desc }], limit: 500) {
      id number status start_date end_date unit_count unit_codes renter_names total_rent total_charges
      is_ending_soon in_grace grace_days_left registration_state registration_deadline
    }
  }
`;

export default function LeasesPage() {
  const result = useGraphql<{ lease_overview: LeaseOverviewRow[] }>(LEASES_QUERY);
  const canEdit = useCanEdit();
  const [tab, setTab] = useState<LeaseTab>('all');
  const [search, setSearch] = useState('');

  const leases = useMemo(() => (result.status === 'success' ? result.data.lease_overview : []), [result]);
  const count = (value: LeaseTab) => leases.filter((lease) => matchesLeaseTab(lease, value)).length;
  const rows = leases.filter((lease) => matchesLeaseTab(lease, tab) && matchesLeaseSearch(lease, search));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title="Baux"
          description={result.status === 'success' ? `${leases.length} baux` : 'Chargement des baux…'}
          actions={
            canEdit && (
              <Button asChild>
                <Link href="/baux/nouveau">
                  <Plus data-icon="inline-start" />
                  Nouveau bail
                </Link>
              </Button>
            )
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Card className="py-4">
          <CardContent className="space-y-4">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={tab}
              onValueChange={(value) => setTab((value || 'all') as LeaseTab)}
              className="flex-wrap justify-start"
              aria-label="Filtrer les baux"
            >
              {LEASE_TABS.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value} className="gap-1.5">
                  {item.label}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count(item.value)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Numéro, locataire ou unité"
                aria-label="Rechercher un bail"
              />
            </InputGroup>
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        {result.status === 'loading' && (
          <SkeletonList count={5} className="space-y-2" itemClassName="h-14 rounded-lg bg-muted" label="Chargement des baux…" />
        )}
        {result.status === 'error' && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Impossible de charger les baux : {result.message}
          </p>
        )}
        {result.status === 'success' && rows.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <p className="font-medium">{leases.length === 0 ? 'Aucun bail pour le moment' : 'Aucun bail ne correspond'}</p>
              <p className="text-sm text-muted-foreground">
                {leases.length === 0 ? 'Créez le premier bail pour suivre les loyers et l’occupation.' : 'Changez le filtre ou la recherche.'}
              </p>
            </CardContent>
          </Card>
        )}
        {result.status === 'success' && rows.length > 0 && (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bail</TableHead>
                  <TableHead>Locataires</TableHead>
                  <TableHead>Unités</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Loyer + charges</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">
                      <Link href={'/baux/' + lease.id} className="text-primary hover:underline">
                        {formatLeaseNumber(lease.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{lease.renter_names ?? '—'}</TableCell>
                    <TableCell>{lease.unit_codes ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{leasePeriod(lease)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTnd(Number(lease.total_rent) + Number(lease.total_charges))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <LeaseStatusBadge status={lease.status} />
                        <LeaseFlagBadges row={lease} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </StaggerItem>
    </Stagger>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run (from `web/`): `npx tsc --noEmit` and `npm run lint`
Expected: no errors.

- [ ] **Step 4: See it on the live data** (needs Task 7 done). Start the dev server in the background (`npm run dev` from `web/`), sign in at `http://localhost:3000` and open `/baux`.
Expected: five leases (N° 1 to 5): N° 1 « Fin dans 20 jours » (badge info), N° 2 « Échu · à renouveler (4 j) », N° 3 « Enregistrement avant le … », N° 4 Terminé, N° 5 Brouillon. Tab counts: Tous 5, Actifs 3, Brouillons 1, À renouveler 2, Terminés 1. Typing « Carthage » in the search keeps N° 2, 4 and 5. Check at 375 px width: the table scrolls inside its card and the page has no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/leases/lease-status-badge.tsx "web/src/app/(app)/baux/page.tsx"
git commit -m "feat: lease list page with tabs, search and status flags"
```

---

### Task 10: Lease form — create a draft and edit it

One form, two modes. Creating sends the four insert fields in one request; editing a draft deletes its units and parties, updates the lease and inserts them again, in one request (the database guard allows this only while the lease is a draft).

**Files:**
- Create: `web/src/components/leases/lease-units-field.tsx`, `web/src/components/leases/lease-units-field.test.tsx`, `web/src/components/leases/lease-parties-field.tsx`, `web/src/components/leases/lease-parties-field.test.tsx`, `web/src/components/leases/lease-form.tsx`, `web/src/app/(app)/baux/nouveau/page.tsx`, `web/src/app/(app)/baux/[id]/modifier/page.tsx`

**Interfaces:**
- Consumes: `LeaseDraftInput`, `LeaseUnitInput`, `validateLeaseDraft`, `buildLeaseObjects`, `useContactOptions`, `ContactPicker`/`ContactOption`, `toFrenchError`, `graphql`, `todayTunis`, `addDays`.
- Produces:
  - `UnitOption = { id: string; code: string; rent_amount: number | string | null; property: { id: string; name: string } }`.
  - `<LeaseUnitsField options value onChange />` (`value: LeaseUnitInput[]`).
  - `<LeasePartiesField legend addLabel rowLabel value onChange options taken minRows />` (`value: (string | null)[]`).
  - `LeaseFormInitial = { id: string; startDate: string; endDate: string; paymentDay: string; depositAmount: string; units: LeaseUnitInput[]; renters: string[]; guarantors: string[] }`; `<LeaseForm initial? presetUnitId? />`.
  - Routes `/baux/nouveau` (optional `?unite=<unit id>`) and `/baux/[id]/modifier`.
- Labels the E2E test (Task 15) relies on: `Début du bail`, `Fin du bail`, `Jour de paiement`, `Dépôt de garantie (TND)`, unit checkboxes named `<code> · <property name>`, money inputs named `Loyer <code>` and `Charges <code>`, buttons `Ajouter un locataire`, `Ajouter un garant`, `Enregistrer le brouillon`.

- [ ] **Step 1: Write the failing test for the units field** — `web/src/components/leases/lease-units-field.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LeaseUnitsField, type UnitOption } from './lease-units-field';

const OPTIONS: UnitOption[] = [
  { id: 'u1', code: 'B-101', rent_amount: 980, property: { id: 'p1', name: 'Résidence Carthage' } },
  { id: 'u2', code: 'B-102', rent_amount: null, property: { id: 'p1', name: 'Résidence Carthage' } },
];

describe('LeaseUnitsField', () => {
  it('prefills the rent of a unit when it is chosen', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-101 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u1', rent: '980', charges: '' }]);
  });

  it('starts with an empty rent when the unit has none', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-102 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u2', rent: '', charges: '' }]);
  });

  it('removes a unit when it is unchecked', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[{ unitId: 'u1', rent: '980', charges: '' }]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-101 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows rent and charges inputs only for chosen units and reports edits', () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[{ unitId: 'u1', rent: '980', charges: '' }]} onChange={onChange} />);
    expect(screen.queryByLabelText('Loyer B-102')).toBeNull();
    expect(screen.getByLabelText('Loyer B-101')).toHaveValue('980');
    fireEvent.change(screen.getByLabelText('Charges B-101'), { target: { value: '40' } });
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u1', rent: '980', charges: '40' }]);
  });

  it('says so when no unit is free', () => {
    render(<LeaseUnitsField options={[]} value={[]} onChange={() => {}} />);
    expect(screen.getByText('Aucune unité disponible.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `web/`): `npx vitest run src/components/leases/lease-units-field.test.tsx`
Expected: FAIL — `Cannot find module './lease-units-field'`.

- [ ] **Step 3: Implement the units field** — `web/src/components/leases/lease-units-field.tsx`

```tsx
'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { LeaseUnitInput } from '@/lib/lease-types';

export type UnitOption = {
  id: string;
  code: string;
  rent_amount: number | string | null;
  property: { id: string; name: string };
};

type Props = {
  options: UnitOption[];
  value: LeaseUnitInput[];
  onChange: (value: LeaseUnitInput[]) => void;
};

const labelOf = (option: UnitOption) => `${option.code} · ${option.property.name}`;

export function LeaseUnitsField({ options, value, onChange }: Props) {
  function toggle(option: UnitOption, checked: boolean) {
    if (!checked) {
      onChange(value.filter((unit) => unit.unitId !== option.id));
      return;
    }
    const rent = option.rent_amount === null ? '' : String(Number(option.rent_amount));
    onChange([...value, { unitId: option.id, rent, charges: '' }]);
  }

  function edit(unitId: string, patch: Partial<LeaseUnitInput>) {
    onChange(value.map((unit) => (unit.unitId === unitId ? { ...unit, ...patch } : unit)));
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">Unités</FieldLegend>
      <FieldDescription>Les unités disponibles. Le loyer proposé est celui de la fiche de l’unité ; vous pouvez le modifier.</FieldDescription>
      {options.length === 0 && <p className="text-sm text-muted-foreground">Aucune unité disponible.</p>}
      <ul className="divide-y rounded-lg border">
        {options.map((option) => {
          const chosen = value.find((unit) => unit.unitId === option.id);
          return (
            <li key={option.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                <Checkbox
                  aria-label={labelOf(option)}
                  checked={chosen !== undefined}
                  onCheckedChange={(checked) => toggle(option, checked === true)}
                />
                <span className="font-medium">{option.code}</span>
                <span className="text-muted-foreground">{option.property.name}</span>
              </label>
              {chosen && (
                <div className="flex gap-2">
                  <Input
                    aria-label={'Loyer ' + option.code}
                    placeholder="Loyer (TND)"
                    inputMode="decimal"
                    className="w-32"
                    value={chosen.rent}
                    onChange={(event) => edit(option.id, { rent: event.target.value })}
                  />
                  <Input
                    aria-label={'Charges ' + option.code}
                    placeholder="Charges (TND)"
                    inputMode="decimal"
                    className="w-32"
                    value={chosen.charges}
                    onChange={(event) => edit(option.id, { charges: event.target.value })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </FieldSet>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/leases/lease-units-field.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing test for the parties field** — `web/src/components/leases/lease-parties-field.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { LeasePartiesField } from './lease-parties-field';

const OPTIONS: ContactOption[] = [
  { id: 'c1', full_name: 'Salma Gharbi', kind: 'person', is_organization: false },
  { id: 'c2', full_name: 'Hédi Ben Salem', kind: 'person', is_organization: false },
];

const props = { legend: 'Locataires', addLabel: 'Ajouter un locataire', rowLabel: 'locataire', options: OPTIONS, taken: [] as string[] };

describe('LeasePartiesField', () => {
  it('adds an empty row', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} value={['c1']} onChange={onChange} minRows={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un locataire' }));
    expect(onChange).toHaveBeenCalledWith(['c1', null]);
  });

  it('never removes the last required row', () => {
    render(<LeasePartiesField {...props} value={['c1']} onChange={() => {}} minRows={1} />);
    expect(screen.getByRole('button', { name: 'Retirer locataire 1' })).toBeDisabled();
  });

  it('removes a row when more than the minimum are present', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} value={['c1', 'c2']} onChange={onChange} minRows={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer locataire 2' }));
    expect(onChange).toHaveBeenCalledWith(['c1']);
  });

  it('lets guarantors be removed down to none', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} legend="Garants" addLabel="Ajouter un garant" rowLabel="garant" value={[null]} onChange={onChange} minRows={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer garant 1' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/leases/lease-parties-field.test.tsx`
Expected: FAIL — `Cannot find module './lease-parties-field'`.

- [ ] **Step 7: Implement the parties field** — `web/src/components/leases/lease-parties-field.tsx`

```tsx
'use client';

import { Plus, X } from 'lucide-react';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';

type Props = {
  legend: string;
  addLabel: string;
  /** Singular noun used in the accessible names of the rows: « Retirer locataire 1 ». */
  rowLabel: string;
  value: (string | null)[];
  onChange: (value: (string | null)[]) => void;
  options: ContactOption[];
  /** Contacts already used on the lease (renters and guarantors): each can appear only once. */
  taken: string[];
  minRows: number;
};

export function LeasePartiesField({ legend, addLabel, rowLabel, value, onChange, options, taken, minRows }: Props) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      {value.map((contactId, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ContactPicker
              id={`${rowLabel}-${index}`}
              options={options}
              value={contactId}
              excludeIds={taken}
              onChange={(id) => onChange(value.map((current, position) => (position === index ? id : current)))}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Retirer ${rowLabel} ${index + 1}`}
            disabled={value.length <= minRows}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...value, null])}>
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </FieldSet>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run src/components/leases/lease-parties-field.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 9: The form** — `web/src/components/leases/lease-form.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LeasePartiesField } from '@/components/leases/lease-parties-field';
import { LeaseUnitsField, type UnitOption } from '@/components/leases/lease-units-field';
import { Pulse } from '@/components/motion/primitives';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addDays, todayTunis } from '@/lib/dates';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import type { LeaseDraftInput, LeaseUnitInput } from '@/lib/lease-types';
import { buildLeaseObjects, validateLeaseDraft } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const UNITS_QUERY = `
  query LeaseFormUnits($keep: [uuid!]!) {
    units(
      where: { archived_at: { _is_null: true }, property: { archived_at: { _is_null: true } }, _or: [{ status: { _eq: "vacant" } }, { id: { _in: $keep } }] }
      order_by: [{ property: { name: asc } }, { code: asc }]
    ) { id code rent_amount property { id name } }
  }
`;

const CREATE_LEASE = `
  mutation CreateLease($lease: leases_insert_input!, $units: [lease_units_insert_input!]!, $parties: [lease_parties_insert_input!]!, $rents: [lease_rents_insert_input!]!) {
    insert_leases_one(object: $lease) { id }
    insert_lease_units(objects: $units) { affected_rows }
    insert_lease_parties(objects: $parties) { affected_rows }
    insert_lease_rents(objects: $rents) { affected_rows }
  }
`;

const UPDATE_DRAFT = `
  mutation UpdateDraftLease($id: uuid!, $set: leases_set_input!, $units: [lease_units_insert_input!]!, $parties: [lease_parties_insert_input!]!, $rents: [lease_rents_insert_input!]!) {
    delete_lease_parties(where: { lease_id: { _eq: $id } }) { affected_rows }
    delete_lease_units(where: { lease_id: { _eq: $id } }) { affected_rows }
    update_leases_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    insert_lease_units(objects: $units) { affected_rows }
    insert_lease_parties(objects: $parties) { affected_rows }
    insert_lease_rents(objects: $rents) { affected_rows }
  }
`;

export type LeaseFormInitial = {
  id: string;
  startDate: string;
  endDate: string;
  paymentDay: string;
  depositAmount: string;
  units: LeaseUnitInput[];
  renters: string[];
  guarantors: string[];
};

type Props = { initial?: LeaseFormInitial; presetUnitId?: string };

/** Loads the free units and the contacts, then shows the form (its state starts from what was loaded). */
export function LeaseForm({ initial, presetUnitId }: Props) {
  const keep = [...(initial?.units.map((unit) => unit.unitId) ?? []), ...(presetUnitId ? [presetUnitId] : [])];
  const units = useGraphql<{ units: UnitOption[] }>(UNITS_QUERY, { keep });
  const contacts = useContactOptions();

  if (units.status === 'loading' || contacts.status === 'loading') {
    return <Pulse className="text-sm text-muted-foreground">Chargement du formulaire…</Pulse>;
  }
  if (units.status === 'error' || contacts.status === 'error') {
    const message = units.status === 'error' ? units.message : contacts.status === 'error' ? contacts.message : '';
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Impossible de charger le formulaire : {message}
      </p>
    );
  }
  return <LeaseFormBody units={units.data.units} contacts={contacts.data} initial={initial} presetUnitId={presetUnitId} />;
}

function LeaseFormBody({ units, contacts, initial, presetUnitId }: { units: UnitOption[]; contacts: ContactOption[] } & Props) {
  const router = useRouter();
  const [state, setState] = useState<LeaseDraftInput>(() => {
    if (initial) {
      return {
        startDate: initial.startDate,
        endDate: initial.endDate,
        paymentDay: initial.paymentDay,
        depositAmount: initial.depositAmount,
        units: initial.units,
        renters: initial.renters,
        guarantors: initial.guarantors,
      };
    }
    const today = todayTunis();
    const preset = units.find((unit) => unit.id === presetUnitId);
    return {
      startDate: today,
      endDate: addDays(today, 364),
      paymentDay: '1',
      depositAmount: '',
      units: preset ? [{ unitId: preset.id, rent: preset.rent_amount === null ? '' : String(Number(preset.rent_amount)), charges: '' }] : [],
      renters: [null],
      guarantors: [],
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<LeaseDraftInput>) => setState((current) => ({ ...current, ...next }));
  const taken = [...state.renters, ...state.guarantors].filter((id): id is string => id !== null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateLeaseDraft(state);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const id = initial?.id ?? crypto.randomUUID();
      const built = buildLeaseObjects(id, state);
      if (initial) {
        await graphql(UPDATE_DRAFT, { id, set: built.set, units: built.units, parties: built.parties, rents: built.rents });
      } else {
        await graphql(CREATE_LEASE, { lease: { id, ...built.set }, units: built.units, parties: built.parties, rents: built.rents });
      }
      toast.success('Brouillon enregistré', { description: 'Activez le bail une fois signé.' });
      router.push('/baux/' + id);
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Durée et conditions</CardTitle>
          <CardDescription>Le loyer mensuel est payable le jour choisi (de 1 à 28).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="lease-start">Début du bail</FieldLabel>
            <Input id="lease-start" type="date" required value={state.startDate} onChange={(event) => patch({ startDate: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-end">Fin du bail</FieldLabel>
            <Input id="lease-end" type="date" required value={state.endDate} onChange={(event) => patch({ endDate: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-day">Jour de paiement</FieldLabel>
            <Input id="lease-day" type="number" min={1} max={28} value={state.paymentDay} onChange={(event) => patch({ paymentDay: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-deposit">Dépôt de garantie (TND)</FieldLabel>
            <Input id="lease-deposit" inputMode="decimal" placeholder="0" value={state.depositAmount} onChange={(event) => patch({ depositAmount: event.target.value })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <LeaseUnitsField options={units} value={state.units} onChange={(value) => patch({ units: value })} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <LeasePartiesField
            legend="Locataires"
            addLabel="Ajouter un locataire"
            rowLabel="locataire"
            value={state.renters}
            onChange={(value) => patch({ renters: value })}
            options={contacts}
            taken={taken}
            minRows={1}
          />
          <LeasePartiesField
            legend="Garants"
            addLabel="Ajouter un garant"
            rowLabel="garant"
            value={state.guarantors}
            onChange={(value) => patch({ guarantors: value })}
            options={contacts}
            taken={taken}
            minRows={0}
          />
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Enregistrer le brouillon
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 10: The two pages**

`web/src/app/(app)/baux/nouveau/page.tsx`:

```tsx
'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeaseForm } from '@/components/leases/lease-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useCanEdit } from '@/lib/use-can-edit';

function NewLeaseForm() {
  const params = useSearchParams();
  return <LeaseForm presetUnitId={params.get('unite') ?? undefined} />;
}

export default function NewLeasePage() {
  const canEdit = useCanEdit();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/baux">
          <ArrowLeft data-icon="inline-start" />
          Retour aux baux
        </Link>
      </Button>
      <PageHeader title="Nouveau bail" description="Le bail est enregistré en brouillon ; vous l’activerez une fois signé." />
      {canEdit ? (
        <Suspense fallback={null}>
          <NewLeaseForm />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">Vous n’avez pas les droits pour créer un bail.</p>
      )}
    </div>
  );
}
```

`web/src/app/(app)/baux/[id]/modifier/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeaseForm, type LeaseFormInitial } from '@/components/leases/lease-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import type { LeaseStatus } from '@/lib/lease-types';
import { formatLeaseNumber } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const DRAFT_QUERY = `
  query DraftLease($id: uuid!) {
    lease: leases_by_pk(id: $id) {
      id number status start_date end_date payment_day deposit_amount
      units { unit_id }
      parties { contact_id role }
      rents { unit_id rent_amount charges_amount }
    }
  }
`;

type DraftLease = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  payment_day: number;
  deposit_amount: number | string;
  units: { unit_id: string }[];
  parties: { contact_id: string; role: 'renter' | 'guarantor' }[];
  rents: { unit_id: string; rent_amount: number | string; charges_amount: number | string }[];
};

function toInitial(lease: DraftLease): LeaseFormInitial {
  return {
    id: lease.id,
    startDate: lease.start_date,
    endDate: lease.end_date,
    paymentDay: String(lease.payment_day),
    depositAmount: Number(lease.deposit_amount) === 0 ? '' : String(Number(lease.deposit_amount)),
    units: lease.units.map((unit) => {
      const rent = lease.rents.find((row) => row.unit_id === unit.unit_id);
      return {
        unitId: unit.unit_id,
        rent: rent ? String(Number(rent.rent_amount)) : '',
        charges: rent && Number(rent.charges_amount) !== 0 ? String(Number(rent.charges_amount)) : '',
      };
    }),
    renters: lease.parties.filter((party) => party.role === 'renter').map((party) => party.contact_id),
    guarantors: lease.parties.filter((party) => party.role === 'guarantor').map((party) => party.contact_id),
  };
}

export default function EditLeasePage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ lease: DraftLease | null }>(DRAFT_QUERY, { id });
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={'/baux/' + id}>
        <ArrowLeft data-icon="inline-start" />
        Retour au bail
      </Link>
    </Button>
  );

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <Pulse className="text-sm text-muted-foreground">Chargement du bail…</Pulse>
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        {back}
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce bail : {result.message}
        </p>
      </div>
    );
  }
  const lease = result.data.lease;
  if (!lease || lease.status !== 'draft') {
    return (
      <div className="space-y-6">
        {back}
        <p className="text-sm text-muted-foreground">Ce bail ne peut plus être modifié.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {back}
      <PageHeader title={'Modifier ' + formatLeaseNumber(lease.number)} description="Corrigez le brouillon avant de l’activer." />
      <LeaseForm initial={toInitial(lease)} />
    </div>
  );
}
```

- [ ] **Step 11: Type-check, lint, test**

Run: `npx tsc --noEmit`, `npm run lint`, `npm test`
Expected: no errors; all tests pass. (If lint flags the unused `LeaseUnitInput` import in `lease-form.tsx`, it is used by `LeaseFormInitial` — keep it.)

- [ ] **Step 12: Try it on the live data** (needs Task 7). In the browser, `/baux/nouveau`: leave the unit list empty and press « Enregistrer le brouillon » → red message « Choisissez au moins une unité. ». Choose B-102 → rent prefilled `1100`; pick a renter; type charges `40,5`; save → redirected to `/baux/<id>` (fiche, Task 11). Then `/baux/<id>/modifier` loads the same values; change the deposit and save. Typing `abc` in the rent field and saving → « Indiquez le loyer de chaque unité. ».

- [ ] **Step 13: Commit**

```bash
git add web/src/components/leases web/src/app/\(app\)/baux
git commit -m "feat: lease form — create a draft and edit it"
```

---

### Task 11: Fiche du bail — header, actions (activate, renew, end, archive), overview and registration

**Files:**
- Modify: `web/src/lib/leases.ts`, `web/src/lib/leases.test.ts`
- Create: `web/src/components/leases/lease-details.ts`, `web/src/components/leases/lease-action-dialog.tsx`, `web/src/components/leases/lease-dialogs.tsx`, `web/src/components/leases/lease-actions.tsx`, `web/src/components/leases/lease-actions.test.tsx`, `web/src/components/leases/registration-card.tsx`, `web/src/components/leases/terms-timeline.tsx`, `web/src/components/leases/lease-overview-tab.tsx`, `web/src/app/(app)/baux/[id]/page.tsx`

**Interfaces:**
- Consumes: `activate_lease`, `renew_lease`, `end_lease` mutations, `leases_by_pk` with its relationships (Task 6), `parseMoney`, `todayTunis`, `addDays`, `useCanEdit`, `LeaseStatusBadge`, `LeaseFlagBadges`.
- Produces:
  - `LEASE_QUERY: string` and `LeaseDetails` (`web/src/components/leases/lease-details.ts`) — the shape used by every tab of the fiche.
  - `planRenewalRents(rows, current): { rents: RenewalRent[] | null } | { error: string }` and `describeRegistration(row, today): { tone: 'neutral' | 'warning' | 'danger' | 'success'; text: string }` in `@/lib/leases`.
  - `<LeaseActionDialog trigger title description submitLabel onSubmit disabled? children />` — shared dialog shell (open state, saving, French error, footer).
  - `<ActivateDialog leaseId trigger onDone />`, `<RenewDialog lease trigger onDone />`, `<EndDialog lease trigger onDone />`.
  - `<LeaseActions lease onChanged />` — renders nothing for a viewer.
  - `<RegistrationCard lease canEdit onChanged />`, `<TermsTimeline lease />`, `<LeaseOverviewTab lease canEdit onChanged />`.
  - Route `/baux/[id]` with hash tabs `#apercu`, `#loyers`, `#documents` (the last two filled by Tasks 12 and 13).
- Labels the E2E test relies on: buttons `Activer`, `Renouveler`, `Terminer`, `Modifier`, `Archiver`, dialog buttons `Activer le bail`, `Renouveler le bail`, `Terminer le bail`; toasts `Bail activé`, `Bail renouvelé`, `Bail terminé`; heading `Bail N° <n>`.

- [ ] **Step 1: Write the failing tests for the two new library functions** — append to `web/src/lib/leases.test.ts`, and extend its import list with `describeRegistration` and `planRenewalRents`:

```ts
describe('planRenewalRents', () => {
  const current = [{ unit_id: 'u1', rent_amount: 900, charges_amount: 40 }];

  it('sends nothing when no rent changed', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: '900', charges: '40' }], current)).toEqual({ rents: null });
  });

  it('sends only the units whose rent or charges changed, reading comma decimals', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: '925,5', charges: '40' }], current)).toEqual({
      rents: [{ unit_id: 'u1', rent_amount: 925.5, charges_amount: 40 }],
    });
    expect(planRenewalRents([{ unitId: 'u1', rent: '900', charges: '' }], current)).toEqual({
      rents: [{ unit_id: 'u1', rent_amount: 900, charges_amount: 0 }],
    });
  });

  it('refuses an amount that is not a number', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: 'x', charges: '' }], current)).toEqual({
      error: 'Les loyers et charges doivent être des montants valides.',
    });
  });
});

describe('describeRegistration', () => {
  const today = '2026-10-15';
  const base = { status: 'active' as const, registration_state: 'pending' as const, registration_deadline: '2026-12-01', registered_at: null, registration_receipt: null };

  it('shows a registered lease with its receipt', () => {
    expect(describeRegistration({ ...base, registration_state: 'registered', registered_at: '2026-09-01', registration_receipt: 'REC-12' }, today)).toEqual({
      tone: 'success',
      text: 'Enregistré le 01/09/2026 · Reçu REC-12',
    });
    expect(describeRegistration({ ...base, registration_state: 'registered', registered_at: '2026-09-01' }, today).text).toBe('Enregistré le 01/09/2026');
  });

  it('stays calm while the deadline is far', () => {
    expect(describeRegistration(base, today)).toEqual({ tone: 'neutral', text: 'À enregistrer avant le 01/12/2026.' });
  });

  it('warns in the last days and counts them', () => {
    const due = { ...base, registration_state: 'due_soon' as const, registration_deadline: '2026-10-20' };
    expect(describeRegistration(due, today)).toEqual({ tone: 'warning', text: 'À enregistrer avant le 20/10/2026 : plus que 5 jours.' });
    expect(describeRegistration({ ...due, registration_deadline: '2026-10-16' }, today).text).toBe('À enregistrer avant le 16/10/2026 : plus que 1 jour.');
    expect(describeRegistration({ ...due, registration_deadline: '2026-10-15' }, today).text).toBe('À enregistrer avant le 15/10/2026 : dernier jour.');
  });

  it('flags a late registration', () => {
    expect(describeRegistration({ ...base, registration_state: 'overdue', registration_deadline: '2026-10-01' }, today)).toEqual({
      tone: 'danger',
      text: 'En retard : à enregistrer avant le 01/10/2026.',
    });
  });

  it('explains the draft and the unregistered ended lease', () => {
    expect(describeRegistration({ ...base, status: 'draft', registration_state: 'not_applicable', registration_deadline: null }, today).text).toBe(
      'Disponible après l’activation du bail.',
    );
    expect(describeRegistration({ ...base, status: 'ended', registration_state: 'not_applicable' }, today).text).toBe('Bail non enregistré.');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `web/`): `npx vitest run src/lib/leases.test.ts`
Expected: FAIL — `planRenewalRents` / `describeRegistration` are not exported.

- [ ] **Step 3: Implement** — append to `web/src/lib/leases.ts` and extend its imports (`import type { EndReason, LeaseDraftInput, LeaseOverviewRow, LeaseStatus, RegistrationState } from '@/lib/lease-types';`):

```ts
export type RentRowInput = { unitId: string; rent: string; charges: string };
export type CurrentRent = { unit_id: string; rent_amount: number | string; charges_amount: number | string };
export type RenewalRent = { unit_id: string; rent_amount: number; charges_amount: number };

/** The rents to send with a renewal: only the units whose rent or charges differ from the current ones. */
export function planRenewalRents(rows: RentRowInput[], current: CurrentRent[]): { rents: RenewalRent[] | null } | { error: string } {
  const changed: RenewalRent[] = [];
  for (const row of rows) {
    const rent = parseMoney(row.rent);
    const charges = row.charges.trim() === '' ? 0 : parseMoney(row.charges);
    if (rent === null || charges === null) return { error: 'Les loyers et charges doivent être des montants valides.' };
    const now = current.find((item) => item.unit_id === row.unitId);
    if (!now || Number(now.rent_amount) !== rent || Number(now.charges_amount) !== charges) {
      changed.push({ unit_id: row.unitId, rent_amount: rent, charges_amount: charges });
    }
  }
  return { rents: changed.length > 0 ? changed : null };
}

export type RegistrationInfo = { tone: 'neutral' | 'warning' | 'danger' | 'success'; text: string };

/** The sentence of the registration card. The state and the deadline come from the database view. */
export function describeRegistration(
  row: {
    status: LeaseStatus;
    registration_state: RegistrationState;
    registration_deadline: string | null;
    registered_at: string | null;
    registration_receipt: string | null;
  },
  today: string,
): RegistrationInfo {
  const deadline = row.registration_deadline ? formatDateFr(row.registration_deadline) : '';
  if (row.registration_state === 'registered' && row.registered_at) {
    const receipt = row.registration_receipt ? ` · Reçu ${row.registration_receipt}` : '';
    return { tone: 'success', text: `Enregistré le ${formatDateFr(row.registered_at)}${receipt}` };
  }
  if (row.status === 'draft') return { tone: 'neutral', text: 'Disponible après l’activation du bail.' };
  if (row.registration_state === 'overdue') return { tone: 'danger', text: `En retard : à enregistrer avant le ${deadline}.` };
  if (row.registration_state === 'due_soon' && row.registration_deadline) {
    const days = daysBetween(today, row.registration_deadline);
    const left = days <= 0 ? 'dernier jour' : days === 1 ? 'plus que 1 jour' : `plus que ${days} jours`;
    return { tone: 'warning', text: `À enregistrer avant le ${deadline} : ${left}.` };
  }
  if (row.registration_state === 'pending') return { tone: 'neutral', text: `À enregistrer avant le ${deadline}.` };
  return { tone: 'neutral', text: 'Bail non enregistré.' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/leases.test.ts`
Expected: PASS.

- [ ] **Step 5: The shape of a lease fiche** — `web/src/components/leases/lease-details.ts`

```ts
import type { EndReason, LeaseStatus, RegistrationState } from '@/lib/lease-types';

export const LEASE_QUERY = `
  query Lease($id: uuid!) {
    lease: leases_by_pk(id: $id) {
      id number status start_date end_date payment_day deposit_amount signed_at registered_at registration_receipt
      ended_on end_reason archived_at
      overview {
        is_ending_soon in_grace grace_days_left registration_deadline registration_state total_rent total_charges
      }
      units {
        unit {
          id code type
          property { id name }
          current_owners { share_percent contact { id full_name } }
        }
      }
      parties { role contact { id full_name phone email } }
      terms(order_by: { start_date: asc }) { id kind start_date end_date note }
      rents(order_by: [{ effective_from: asc }]) { id unit_id effective_from rent_amount charges_amount reason }
      current_rents { unit_id effective_from rent_amount charges_amount next_change_on next_rent_amount }
    }
  }
`;

export type LeaseDetails = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  payment_day: number;
  deposit_amount: number | string;
  signed_at: string | null;
  registered_at: string | null;
  registration_receipt: string | null;
  ended_on: string | null;
  end_reason: EndReason | null;
  archived_at: string | null;
  overview: {
    is_ending_soon: boolean;
    in_grace: boolean;
    grace_days_left: number | null;
    registration_deadline: string | null;
    registration_state: RegistrationState;
    total_rent: number | string;
    total_charges: number | string;
  } | null;
  units: {
    unit: {
      id: string;
      code: string;
      type: string;
      property: { id: string; name: string };
      current_owners: { share_percent: number | string; contact: { id: string; full_name: string } }[];
    };
  }[];
  parties: { role: 'renter' | 'guarantor'; contact: { id: string; full_name: string; phone: string | null; email: string | null } }[];
  terms: { id: string; kind: 'initial' | 'renewal'; start_date: string; end_date: string; note: string | null }[];
  rents: { id: string; unit_id: string; effective_from: string; rent_amount: number | string; charges_amount: number | string; reason: string | null }[];
  current_rents: {
    unit_id: string;
    effective_from: string;
    rent_amount: number | string;
    charges_amount: number | string;
    next_change_on: string | null;
    next_rent_amount: number | string | null;
  }[];
};
```

- [ ] **Step 6: The shared dialog shell** — `web/src/components/leases/lease-action-dialog.tsx`

```tsx
'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toFrenchError } from '@/lib/errors';

type Props = {
  trigger: ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  /** Runs when the form is submitted. Throw to show a message in the dialog (an Error message is shown as is). */
  onSubmit: () => Promise<void>;
  disabled?: boolean;
  children?: ReactNode;
};

export function LeaseActionDialog({ trigger, title, description, submitLabel, onSubmit, disabled = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit();
      setOpen(false);
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-5">
          {children}
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || disabled}>
              {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: The three lifecycle dialogs** — `web/src/components/leases/lease-dialogs.tsx`

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import type { EndReason } from '@/lib/lease-types';
import { END_REASON_LABELS, ENDABLE_REASONS, planRenewalRents } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

const ACTIVATE = `
  mutation ActivateLease($id: uuid!, $signed: date!) {
    activate_lease(args: { p_lease_id: $id, p_signed_on: $signed }) { id status }
  }
`;

const RENEW = `
  mutation RenewLease($id: uuid!, $end: date!, $rents: jsonb, $note: String) {
    renew_lease(args: { p_lease_id: $id, p_new_end_date: $end, p_rents: $rents, p_note: $note }) { id end_date }
  }
`;

const END = `
  mutation EndLease($id: uuid!, $on: date!, $reason: String) {
    end_lease(args: { p_lease_id: $id, p_ended_on: $on, p_reason: $reason }) { id status }
  }
`;

export function ActivateDialog({ leaseId, trigger, onDone }: { leaseId: string; trigger: ReactNode; onDone: () => void }) {
  const [signedOn, setSignedOn] = useState(todayTunis());
  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Activer le bail"
      description="Le bail passe en « Actif » et les unités sont marquées louées. Indiquez la date de signature."
      submitLabel="Activer le bail"
      disabled={!signedOn}
      onSubmit={async () => {
        await graphql(ACTIVATE, { id: leaseId, signed: signedOn });
        toast.success('Bail activé');
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="activate-signed">Date de signature</FieldLabel>
        <Input id="activate-signed" type="date" required value={signedOn} onChange={(event) => setSignedOn(event.target.value)} className="w-48" />
      </Field>
    </LeaseActionDialog>
  );
}

type RenewLease = Pick<LeaseDetails, 'id' | 'end_date' | 'units' | 'current_rents'>;

export function RenewDialog({ lease, trigger, onDone }: { lease: RenewLease; trigger: ReactNode; onDone: () => void }) {
  const today = todayTunis();
  const [newEnd, setNewEnd] = useState(addDays(lease.end_date > today ? lease.end_date : today, 365));
  const [note, setNote] = useState('');
  const [rows, setRows] = useState(() =>
    lease.units.map(({ unit }) => {
      const current = lease.current_rents.find((rent) => rent.unit_id === unit.id);
      return {
        unitId: unit.id,
        code: unit.code,
        rent: String(Number(current?.rent_amount ?? 0)),
        charges: Number(current?.charges_amount ?? 0) === 0 ? '' : String(Number(current?.charges_amount)),
      };
    }),
  );
  const edit = (unitId: string, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row) => (row.unitId === unitId ? { ...row, ...patch } : row)));

  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Renouveler le bail"
      description={`Le bail actuel se termine le ${formatDateFr(lease.end_date)}. Le même bail est prolongé ; les loyers modifiés commencent le lendemain de la fin actuelle.`}
      submitLabel="Renouveler le bail"
      disabled={!newEnd}
      onSubmit={async () => {
        const plan = planRenewalRents(rows, lease.current_rents);
        if ('error' in plan) throw new Error(plan.error);
        await graphql(RENEW, { id: lease.id, end: newEnd, rents: plan.rents, note: note.trim() || null });
        toast.success('Bail renouvelé', { description: 'Jusqu’au ' + formatDateFr(newEnd) });
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="renew-end">Nouvelle date de fin</FieldLabel>
        <Input id="renew-end" type="date" required value={newEnd} onChange={(event) => setNewEnd(event.target.value)} className="w-48" />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium">Loyers à partir du renouvellement</p>
        {rows.map((row) => (
          <div key={row.unitId} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-sm font-medium">{row.code}</span>
            <Input aria-label={'Nouveau loyer ' + row.code} inputMode="decimal" className="w-32" value={row.rent} onChange={(event) => edit(row.unitId, { rent: event.target.value })} />
            <Input aria-label={'Nouvelles charges ' + row.code} inputMode="decimal" placeholder="Charges" className="w-32" value={row.charges} onChange={(event) => edit(row.unitId, { charges: event.target.value })} />
          </div>
        ))}
        <FieldDescription>Laissez les montants tels quels pour garder les loyers actuels.</FieldDescription>
      </div>
      <Field>
        <FieldLabel htmlFor="renew-note">Note (facultatif)</FieldLabel>
        <Input id="renew-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}

type EndLease = Pick<LeaseDetails, 'id' | 'start_date'>;

export function EndDialog({ lease, trigger, onDone }: { lease: EndLease; trigger: ReactNode; onDone: () => void }) {
  const today = todayTunis();
  const [endedOn, setEndedOn] = useState(today);
  const [reason, setReason] = useState<EndReason>('terminated_by_renter');
  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Terminer le bail"
      description="Le locataire est parti : le bail passe en « Terminé » et les unités redeviennent disponibles. L’état des lieux de sortie et le dépôt de garantie se traitent ensuite."
      submitLabel="Terminer le bail"
      disabled={!endedOn}
      onSubmit={async () => {
        await graphql(END, { id: lease.id, on: endedOn, reason });
        toast.success('Bail terminé');
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="end-date">Date de départ</FieldLabel>
        <Input id="end-date" type="date" required min={lease.start_date} max={today} value={endedOn} onChange={(event) => setEndedOn(event.target.value)} className="w-48" />
        <FieldDescription>Au plus tard aujourd’hui.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="end-reason">Motif</FieldLabel>
        <Select value={reason} onValueChange={(value) => setReason(value as EndReason)}>
          <SelectTrigger id="end-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENDABLE_REASONS.map((value) => (
              <SelectItem key={value} value={value}>
                {END_REASON_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </LeaseActionDialog>
  );
}
```

- [ ] **Step 8: Write the failing test for the actions** — `web/src/components/leases/lease-actions.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaseDetails } from './lease-details';

let canEdit = true;
vi.mock('@/lib/use-can-edit', () => ({ useCanEdit: () => canEdit }));
vi.mock('@/lib/graphql', () => ({ graphql: vi.fn() }));

import { LeaseActions } from './lease-actions';

const lease = (patch: Partial<LeaseDetails> = {}): LeaseDetails =>
  ({
    id: 'L1',
    number: 12,
    status: 'draft',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    archived_at: null,
    units: [],
    current_rents: [],
    ...patch,
  }) as LeaseDetails;

const names = () => screen.queryAllByRole('button').map((button) => button.textContent?.trim());

beforeEach(() => {
  canEdit = true;
});

describe('LeaseActions', () => {
  it('shows nothing to a viewer', () => {
    canEdit = false;
    const { container } = render(<LeaseActions lease={lease({ status: 'active' })} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers modify, activate and archive on a draft', () => {
    render(<LeaseActions lease={lease()} onChanged={() => {}} />);
    expect(screen.getByRole('link', { name: 'Modifier' })).toHaveAttribute('href', '/baux/L1/modifier');
    expect(names()).toEqual(['Activer', 'Archiver']);
  });

  it('offers renew and end on an active lease, and nothing else', () => {
    render(<LeaseActions lease={lease({ status: 'active' })} onChanged={() => {}} />);
    expect(names()).toEqual(['Renouveler', 'Terminer']);
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
  });

  it('offers only restore on an archived draft', () => {
    render(<LeaseActions lease={lease({ archived_at: '2026-10-01T00:00:00Z' })} onChanged={() => {}} />);
    expect(names()).toEqual(['Restaurer']);
  });

  it('offers no action on an ended or expired lease', () => {
    const { container } = render(<LeaseActions lease={lease({ status: 'ended' })} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Run: `npx vitest run src/components/leases/lease-actions.test.tsx`
Expected: FAIL — `Cannot find module './lease-actions'`.

- [ ] **Step 10: Implement the actions** — `web/src/components/leases/lease-actions.tsx`

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, CalendarSync, DoorOpen, FileCheck, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { ActivateDialog, EndDialog, RenewDialog } from '@/components/leases/lease-dialogs';
import { Button } from '@/components/ui/button';
import { graphql } from '@/lib/graphql';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';

const SET_ARCHIVED = `
  mutation SetLeaseArchived($id: uuid!, $archived_at: timestamptz) {
    update_leases_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

type Props = { lease: LeaseDetails; onChanged: () => void };

export function LeaseActions({ lease, onChanged }: Props) {
  const canEdit = useCanEdit();
  const [archiving, setArchiving] = useState(false);
  if (!canEdit) return null;

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: lease.id, archived_at: lease.archived_at ? null : new Date().toISOString() });
      toast.success(lease.archived_at ? 'Brouillon restauré' : 'Brouillon archivé');
      onChanged();
    } catch (error) {
      showError('Action impossible', error, () => void toggleArchive());
    } finally {
      setArchiving(false);
    }
  }

  if (lease.status === 'draft') {
    const archived = lease.archived_at !== null;
    return (
      <>
        {!archived && (
          <>
            <Button asChild variant="outline">
              <Link href={'/baux/' + lease.id + '/modifier'}>
                <Pencil data-icon="inline-start" />
                Modifier
              </Link>
            </Button>
            <ActivateDialog
              leaseId={lease.id}
              onDone={onChanged}
              trigger={
                <Button>
                  <FileCheck data-icon="inline-start" />
                  Activer
                </Button>
              }
            />
          </>
        )}
        <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
          {archiving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : archived ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
          {archived ? 'Restaurer' : 'Archiver'}
        </Button>
      </>
    );
  }

  if (lease.status === 'active') {
    return (
      <>
        <RenewDialog
          lease={lease}
          onDone={onChanged}
          trigger={
            <Button>
              <CalendarSync data-icon="inline-start" />
              Renouveler
            </Button>
          }
        />
        <EndDialog
          lease={lease}
          onDone={onChanged}
          trigger={
            <Button variant="outline">
              <DoorOpen data-icon="inline-start" />
              Terminer
            </Button>
          }
        />
      </>
    );
  }

  return null;
}
```

(If `CalendarSync` is not in the installed `lucide-react`, use `RefreshCw`.)

- [ ] **Step 11: Run to verify it passes**

Run: `npx vitest run src/components/leases/lease-actions.test.tsx`
Expected: PASS, 5 tests. (`@/lib/graphql` is mocked so the test never builds the Nhost client.)

- [ ] **Step 12: The timeline and the registration card**

`web/src/components/leases/terms-timeline.tsx`:

```tsx
import { formatDateFr } from '@/lib/ownership';
import type { LeaseDetails } from '@/components/leases/lease-details';

type Props = { lease: Pick<LeaseDetails, 'status' | 'start_date' | 'end_date' | 'terms'> };

/** Initial term then each renewal. A draft has no term row yet: its planned period is shown. */
export function TermsTimeline({ lease }: Props) {
  const rows =
    lease.terms.length > 0
      ? lease.terms
      : [{ id: 'planned', kind: 'initial' as const, start_date: lease.start_date, end_date: lease.end_date, note: null }];
  return (
    <ol className="space-y-3">
      {rows.map((term) => (
        <li key={term.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              {term.kind === 'renewal' ? 'Renouvellement' : lease.status === 'draft' ? 'Durée prévue' : 'Durée initiale'}
            </p>
            <p className="text-sm text-muted-foreground">
              Du {formatDateFr(term.start_date)} au {formatDateFr(term.end_date)}
              {term.note ? ' · ' + term.note : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

`web/src/components/leases/registration-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { FileBadge } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import { describeRegistration } from '@/lib/leases';
import { cn } from '@/lib/utils';

const SAVE = `
  mutation SaveRegistration($id: uuid!, $on: date, $receipt: String) {
    update_leases_by_pk(pk_columns: { id: $id }, _set: { registered_at: $on, registration_receipt: $receipt }) { id }
  }
`;

const TONE = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  warning: 'rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-foreground',
  danger: 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive',
};

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

function RegistrationDialog({ lease, onDone }: { lease: LeaseDetails; onDone: () => void }) {
  const [registeredOn, setRegisteredOn] = useState(lease.registered_at ?? todayTunis());
  const [receipt, setReceipt] = useState(lease.registration_receipt ?? '');
  return (
    <LeaseActionDialog
      trigger={<Button variant="outline">{lease.registered_at ? 'Modifier' : 'Enregistrer le bail'}</Button>}
      title="Enregistrement du bail"
      description="Date d’enregistrement à la recette des finances et numéro du reçu."
      submitLabel="Enregistrer"
      disabled={!registeredOn}
      onSubmit={async () => {
        await graphql(SAVE, { id: lease.id, on: registeredOn, receipt: receipt.trim() || null });
        toast.success('Enregistrement noté');
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="registered-on">Date d’enregistrement</FieldLabel>
        <Input id="registered-on" type="date" required min={lease.signed_at ?? undefined} value={registeredOn} onChange={(event) => setRegisteredOn(event.target.value)} className="w-48" />
      </Field>
      <Field>
        <FieldLabel htmlFor="registered-receipt">Numéro du reçu</FieldLabel>
        <Input id="registered-receipt" value={receipt} onChange={(event) => setReceipt(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}

export function RegistrationCard({ lease, canEdit, onChanged }: Props) {
  const info = describeRegistration(
    {
      status: lease.status,
      registration_state: lease.overview?.registration_state ?? 'not_applicable',
      registration_deadline: lease.overview?.registration_deadline ?? null,
      registered_at: lease.registered_at,
      registration_receipt: lease.registration_receipt,
    },
    todayTunis(),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileBadge className="size-4 text-muted-foreground" aria-hidden />
          Enregistrement
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm', TONE[info.tone])}>{info.text}</p>
        {canEdit && lease.status !== 'draft' && <RegistrationDialog lease={lease} onDone={onChanged} />}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 13: The overview tab** — `web/src/components/leases/lease-overview-tab.tsx`

```tsx
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { RegistrationCard } from '@/components/leases/registration-card';
import { TermsTimeline } from '@/components/leases/terms-timeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { END_REASON_LABELS } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

export function LeaseOverviewTab({ lease, canEdit, onChanged }: Props) {
  const renters = lease.parties.filter((party) => party.role === 'renter');
  const guarantors = lease.parties.filter((party) => party.role === 'guarantor');
  const owners = new Map<string, { name: string; units: string[] }>();
  for (const { unit } of lease.units) {
    for (const owner of unit.current_owners) {
      const entry = owners.get(owner.contact.id) ?? { name: owner.contact.full_name, units: [] };
      entry.units.push(unit.code);
      owners.set(owner.contact.id, entry);
    }
  }

  return (
    <div className="space-y-6">
      {lease.overview?.in_grace && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            Ce bail est échu depuis le {formatDateFr(lease.end_date)}. Renouvelez-le ou terminez-le : il expirera automatiquement dans{' '}
            {lease.overview.grace_days_left ?? 0} jour(s) et ses unités seront libérées.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Période</dt>
                <dd className="font-medium">
                  {formatDateFr(lease.start_date)} → {formatDateFr(lease.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jour de paiement</dt>
                <dd className="font-medium">Le {lease.payment_day} de chaque mois</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Dépôt de garantie</dt>
                <dd className="font-medium tabular-nums">{formatTnd(lease.deposit_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Signé le</dt>
                <dd className="font-medium">{lease.signed_at ? formatDateFr(lease.signed_at) : '—'}</dd>
              </div>
              {lease.ended_on && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">Fin du bail</dt>
                  <dd className="font-medium">
                    Le {formatDateFr(lease.ended_on)}
                    {lease.end_reason ? ' · ' + END_REASON_LABELS[lease.end_reason] : ''}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locataires et garants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[...renters.map((party) => ({ ...party, label: 'Locataire' })), ...guarantors.map((party) => ({ ...party, label: 'Garant' }))].map((party) => (
              <div key={party.contact.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={'/contacts/' + party.contact.id} className="font-medium text-primary hover:underline">
                    {party.contact.full_name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{[party.contact.phone, party.contact.email].filter(Boolean).join(' · ') || 'Aucune coordonnée'}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{party.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unités</CardTitle>
            <CardDescription>Loyer et charges en vigueur aujourd’hui.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y text-sm">
            {lease.units.map(({ unit }) => {
              const rent = lease.current_rents.find((item) => item.unit_id === unit.id);
              return (
                <div key={unit.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/biens/${unit.property.id}/unites/${unit.id}`} className="font-medium text-primary hover:underline">
                      {unit.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{unit.property.name}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-medium">{rent ? formatTnd(rent.rent_amount) : '—'}</p>
                    {rent && Number(rent.charges_amount) > 0 && <p className="text-xs text-muted-foreground">+ {formatTnd(rent.charges_amount)} de charges</p>}
                    {rent?.next_change_on && rent.next_rent_amount !== null && (
                      <p className="text-xs text-muted-foreground">
                        {formatTnd(rent.next_rent_amount)} dès le {formatDateFr(rent.next_change_on)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bailleur</CardTitle>
            <CardDescription>Propriétaire actuel des unités louées.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {owners.size === 0 && <p className="text-muted-foreground">Aucun propriétaire renseigné.</p>}
            {[...owners.entries()].map(([id, owner]) => (
              <div key={id} className="flex items-center justify-between gap-3">
                <Link href={'/contacts/' + id} className="font-medium text-primary hover:underline">
                  {owner.name}
                </Link>
                <span className="text-xs text-muted-foreground">{owner.units.join(', ')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RegistrationCard lease={lease} canEdit={canEdit} onChanged={onChanged} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Durées</CardTitle>
          </CardHeader>
          <CardContent>
            <TermsTimeline lease={lease} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 14: The fiche page** — `web/src/app/(app)/baux/[id]/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { LEASE_QUERY, type LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActions } from '@/components/leases/lease-actions';
import { LeaseOverviewTab } from '@/components/leases/lease-overview-tab';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatLeaseNumber } from '@/lib/leases';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHashTab } from '@/lib/use-hash';

const LEASE_TABS = ['apercu', 'loyers', 'documents'] as const;
type LeaseTabName = (typeof LEASE_TABS)[number];

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/baux">
        <ArrowLeft data-icon="inline-start" />
        Retour aux baux
      </Link>
    </Button>
  );
}

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [tab, setTab] = useHashTab(LEASE_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ lease: LeaseDetails | null }>(LEASE_QUERY, { id }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">Chargement du bail…</Pulse>
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce bail : {result.message}
        </p>
      </div>
    );
  }
  const lease = result.data.lease;
  if (!lease) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Bail introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou vous n’y avez pas accès.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renters = lease.parties.filter((party) => party.role === 'renter').map((party) => party.contact.full_name);
  const flagRow = {
    is_ending_soon: lease.overview?.is_ending_soon ?? false,
    in_grace: lease.overview?.in_grace ?? false,
    grace_days_left: lease.overview?.grace_days_left ?? null,
    registration_state: lease.overview?.registration_state ?? ('not_applicable' as const),
    registration_deadline: lease.overview?.registration_deadline ?? null,
    end_date: lease.end_date,
  };

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>
      <StaggerItem>
        <PageHeader
          title={formatLeaseNumber(lease.number)}
          description={[lease.units.map(({ unit }) => unit.code).join(', '), renters.join(', ')].filter(Boolean).join(' · ') + (lease.archived_at ? ' · Archivé' : '')}
          actions={
            <>
              <LeaseStatusBadge status={lease.status} />
              <LeaseFlagBadges row={flagRow} />
              <LeaseActions lease={lease} onChanged={refresh} />
            </>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as LeaseTabName)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="apercu">Aperçu</TabsTrigger>
            <TabsTrigger value="loyers">Loyers</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
          <TabsContent value="apercu" className="pt-4">
            <LeaseOverviewTab lease={lease} canEdit={canEdit} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="loyers" className="pt-4">
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </TabsContent>
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
```

(The two placeholder panels are replaced in Tasks 12 and 13.)

- [ ] **Step 15: Type-check, lint, test**

Run: `npx tsc --noEmit`, `npm run lint`, `npm test`
Expected: no errors, all tests pass.

- [ ] **Step 16: Try it on the live data** (needs Task 7). `/baux/<id of lease 2>` (the grace-week lease): the yellow banner says it expired on `<date>` and will expire in 4 day(s); badges « Actif », « Échu · à renouveler (4 j) »; cards show Conditions, SARL Carthage Digital + Hédi Ben Salem (Garant), B-203 with `1 250,000 TND + 60,000 TND de charges`, owner Sté Foncière Carthage; registration « Enregistré le … · Reçu REC-2025-0107 ». Lease 3: registration card is yellow « … plus que 5 jours. »; click « Enregistrer le bail », fill today and `REC-TEST`, save → green card; then re-open « Modifier » and clear nothing (leave). Lease 3 is shown with the planned increase « 1 010,000 TND dès le … ». As a draft (lease 5): « Modifier », « Activer », « Archiver » buttons; « Activer » asks for a date and confirms with « Activer le bail » (do not activate lease 5 in the demo data: cancel). Check at 375 px: no horizontal scroll.

- [ ] **Step 17: Commit**

```bash
git add web/src/lib/leases.ts web/src/lib/leases.test.ts web/src/components/leases web/src/app/\(app\)/baux
git commit -m "feat: lease fiche with activate, renew, end, archive, overview and registration"
```

---

### Task 12: Rents tab and rent changes

**Files:**
- Create: `web/src/components/leases/change-rent-dialog.tsx`, `web/src/components/leases/rents-tab.tsx`
- Modify: `web/src/app/(app)/baux/[id]/page.tsx`

**Interfaces:**
- Consumes: `change_rent` mutation, `LeaseDetails.rents`, `LeaseDetails.current_rents`, `LeaseActionDialog`, `parseMoney`.
- Produces: `<ChangeRentDialog lease trigger onDone />`, `<RentsTab lease canEdit onChanged />`.
- Labels for E2E: tab `Loyers`, button `Changer le loyer`, dialog submit `Enregistrer`, toast `Loyer enregistré`.

- [ ] **Step 1: The dialog** — `web/src/components/leases/change-rent-dialog.tsx`

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import { parseMoney } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

const CHANGE_RENT = `
  mutation ChangeRent($id: uuid!, $unit: uuid!, $on: date!, $rent: numeric!, $charges: numeric!, $reason: String) {
    change_rent(args: { p_lease_id: $id, p_unit_id: $unit, p_effective_from: $on, p_rent: $rent, p_charges: $charges, p_reason: $reason }) { id }
  }
`;

type Props = { lease: Pick<LeaseDetails, 'id' | 'units' | 'current_rents'>; trigger: ReactNode; onDone: () => void };

export function ChangeRentDialog({ lease, trigger, onDone }: Props) {
  const firstUnit = lease.units[0]?.unit.id ?? '';
  const [unitId, setUnitId] = useState(firstUnit);
  const [effectiveOn, setEffectiveOn] = useState(addDays(todayTunis(), 1));
  const current = lease.current_rents.find((rent) => rent.unit_id === unitId);
  const [rent, setRent] = useState(current ? String(Number(current.rent_amount)) : '');
  const [charges, setCharges] = useState(current && Number(current.charges_amount) > 0 ? String(Number(current.charges_amount)) : '');
  const [reason, setReason] = useState('');

  function pickUnit(next: string) {
    setUnitId(next);
    const row = lease.current_rents.find((item) => item.unit_id === next);
    setRent(row ? String(Number(row.rent_amount)) : '');
    setCharges(row && Number(row.charges_amount) > 0 ? String(Number(row.charges_amount)) : '');
  }

  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Changer le loyer"
      description="Le nouveau loyer s’applique à partir de la date choisie ; l’historique est conservé."
      submitLabel="Enregistrer"
      disabled={!unitId || !effectiveOn}
      onSubmit={async () => {
        const newRent = parseMoney(rent);
        const newCharges = charges.trim() === '' ? 0 : parseMoney(charges);
        if (newRent === null || newCharges === null) throw new Error('Le loyer et les charges doivent être des montants valides.');
        await graphql(CHANGE_RENT, { id: lease.id, unit: unitId, on: effectiveOn, rent: newRent, charges: newCharges, reason: reason.trim() || null });
        toast.success('Loyer enregistré', { description: 'À partir du ' + formatDateFr(effectiveOn) });
        onDone();
      }}
    >
      {lease.units.length > 1 && (
        <Field>
          <FieldLabel htmlFor="rent-unit">Unité</FieldLabel>
          <Select value={unitId} onValueChange={pickUnit}>
            <SelectTrigger id="rent-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lease.units.map(({ unit }) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.code} · {unit.property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="rent-date">À partir du</FieldLabel>
        <Input id="rent-date" type="date" required value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className="w-48" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="rent-amount">Loyer (TND)</FieldLabel>
          <Input id="rent-amount" inputMode="decimal" value={rent} onChange={(event) => setRent(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rent-charges">Charges (TND)</FieldLabel>
          <Input id="rent-charges" inputMode="decimal" value={charges} onChange={(event) => setCharges(event.target.value)} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="rent-reason">Motif (facultatif)</FieldLabel>
        <Input id="rent-reason" placeholder="Indexation annuelle" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}
```

- [ ] **Step 2: The tab** — `web/src/components/leases/rents-tab.tsx`

```tsx
'use client';

import { Banknote } from 'lucide-react';
import { ChangeRentDialog } from '@/components/leases/change-rent-dialog';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatTnd } from '@/lib/format';
import { formatDateFr } from '@/lib/ownership';

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

/** Rent and charges history per unit; the row in force today is marked « En vigueur ». */
export function RentsTab({ lease, canEdit, onChanged }: Props) {
  return (
    <div className="space-y-4">
      {canEdit && lease.status === 'active' && (
        <div className="flex justify-end">
          <ChangeRentDialog
            lease={lease}
            onDone={onChanged}
            trigger={
              <Button variant="outline">
                <Banknote data-icon="inline-start" />
                Changer le loyer
              </Button>
            }
          />
        </div>
      )}
      {lease.units.map(({ unit }) => {
        const rows = lease.rents.filter((rent) => rent.unit_id === unit.id);
        const inForce = lease.current_rents.find((rent) => rent.unit_id === unit.id)?.effective_from;
        return (
          <Card key={unit.id} className="gap-0 py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">
                {unit.code} · {unit.property.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>À partir du</TableHead>
                    <TableHead className="text-right">Loyer</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rent) => (
                    <TableRow key={rent.id}>
                      <TableCell>{formatDateFr(rent.effective_from)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTnd(rent.rent_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTnd(rent.charges_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{rent.reason ?? '—'}</TableCell>
                      <TableCell>{rent.effective_from === inForce && <Badge variant="secondary" className="bg-success/12 text-success">En vigueur</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Use it in the page** — in `web/src/app/(app)/baux/[id]/page.tsx` add `import { RentsTab } from '@/components/leases/rents-tab';` and replace the placeholder panel

```tsx
          <TabsContent value="loyers" className="pt-4">
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </TabsContent>
```

with

```tsx
          <TabsContent value="loyers" className="pt-4">
            <RentsTab lease={lease} canEdit={canEdit} onChanged={refresh} />
          </TabsContent>
```

- [ ] **Step 4: Type-check, lint, test**

Run: `npx tsc --noEmit`, `npm run lint`, `npm test`
Expected: no errors, all pass.

- [ ] **Step 5: Try it on the live data.** `/baux/<lease 3>#loyers`: B-101 shows 3 rows (start rent « 980,000 » En vigueur, « 1 010,000 » from +30 days « Indexation »). « Changer le loyer » → dialog with the current rent prefilled; set the date to yesterday + rent 990 → error « Le loyer ne peut pas commencer avant le début du bail. » only when before the lease start; with tomorrow it saves, toast « Loyer enregistré », a new row appears. Entering the same date a second time → « Un loyer existe déjà à cette date pour cette unité. » inside the dialog. Lease 4 (ended): no « Changer le loyer » button.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/leases web/src/app/\(app\)/baux
git commit -m "feat: lease rents tab and rent changes"
```

---

### Task 13: Lease documents

**Files:**
- Create: `web/src/lib/lease-files.ts`, `web/src/lib/lease-files.test.ts`, `web/src/components/leases/lease-documents.tsx`
- Modify: `web/src/lib/storage.ts`, `web/src/app/(app)/baux/[id]/page.tsx`, `web/vitest.config.ts`

**Interfaces:**
- Consumes: `UploadDeps` (`@/lib/upload`), `titleFromFileName`, `validateFile`, `FileDrop`, `presignedUrl`, `downloadStoredFile`, `deleteStoredFile`, `ConfirmDialog`, `LEASE_DOCUMENT_CATEGORIES`, bucket `lease-files`, tables `lease_files`.
- Produces: `uploadLeaseDocument(file, leaseId, category, deps): Promise<void>`; `uploadToBucket(file, bucket?)` (bucket defaults to `property-files`); `leaseStorageDeps: UploadDeps`; `<LeaseDocuments leaseId />`.

- [ ] **Step 1: Write the failing test** — `web/src/lib/lease-files.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { uploadLeaseDocument } from './lease-files';

const file = new File(['x'], 'bail-signe_2026.pdf', { type: 'application/pdf' });

describe('uploadLeaseDocument', () => {
  it('stores the file, then links it to the lease with a readable title', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn(), link: vi.fn().mockResolvedValue(undefined) };
    await uploadLeaseDocument(file, 'L1', 'signed_lease', deps);
    expect(deps.link).toHaveBeenCalledWith({ lease_id: 'L1', storage_file_id: 'S1', category: 'signed_lease', title: 'Bail signe 2026' });
    expect(deps.remove).not.toHaveBeenCalled();
  });

  it('removes the stored file when the link fails, and reports the failure', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn().mockResolvedValue(undefined), link: vi.fn().mockRejectedValue(new Error('invalid_storage_file')) };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('invalid_storage_file');
    expect(deps.remove).toHaveBeenCalledWith('S1');
  });

  it('still reports the link failure when the cleanup also fails', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn().mockRejectedValue(new Error('network')), link: vi.fn().mockRejectedValue(new Error('invalid_storage_file')) };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('invalid_storage_file');
  });

  it('does not link anything when the upload itself fails', async () => {
    const deps = { upload: vi.fn().mockRejectedValue(new Error('Le fichier n’a pas pu être envoyé.')), remove: vi.fn(), link: vi.fn() };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('Le fichier n’a pas pu être envoyé.');
    expect(deps.link).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/lease-files.test.ts` → FAIL, `Cannot find module './lease-files'`.

- [ ] **Step 3: Implement** — `web/src/lib/lease-files.ts`

```ts
import { titleFromFileName } from '@/lib/files';
import type { LeaseDocumentCategory } from '@/lib/leases';
import type { UploadDeps } from '@/lib/upload';

/** Stores the file, then links it to the lease; removes the stored file if the link fails. */
export async function uploadLeaseDocument(
  file: File,
  leaseId: string,
  category: LeaseDocumentCategory,
  deps: UploadDeps,
): Promise<void> {
  const storageFileId = await deps.upload(file);
  try {
    await deps.link({ lease_id: leaseId, storage_file_id: storageFileId, category, title: titleFromFileName(file.name) });
  } catch (error) {
    await deps.remove(storageFileId).catch(() => undefined);
    throw error;
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/lease-files.test.ts` → PASS, 4 tests. Add `'src/lib/lease-files.ts',` to the coverage list in `web/vitest.config.ts`.

- [ ] **Step 5: Storage helpers** — in `web/src/lib/storage.ts` change `export async function uploadToBucket(file: File): Promise<string> {` and its first line to take a bucket, and add the lease deps at the end of the file:

```ts
export async function uploadToBucket(file: File, bucket: string = BUCKET): Promise<string> {
  const response = await nhost.storage.uploadFiles({ 'bucket-id': bucket, 'file[]': [file] });
```

(only these two lines change; the rest of the function stays), and append:

```ts
export const LEASE_BUCKET = 'lease-files';

const LINK_LEASE_FILE = `
  mutation LinkLeaseFile($object: lease_files_insert_input!) {
    insert_lease_files_one(object: $object) { id }
  }
`;

export const leaseStorageDeps: UploadDeps = {
  upload: (file) => uploadToBucket(file, LEASE_BUCKET),
  remove: deleteStoredFile,
  link: async (object) => {
    await graphql(LINK_LEASE_FILE, { object });
  },
};
```

- [ ] **Step 6: The component** — `web/src/components/leases/lease-documents.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FileDrop } from '@/components/files/file-drop';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { validateFile } from '@/lib/files';
import { uploadLeaseDocument } from '@/lib/lease-files';
import { LEASE_DOCUMENT_CATEGORIES, type LeaseDocumentCategory } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';
import { deleteStoredFile, downloadStoredFile, leaseStorageDeps, presignedUrl } from '@/lib/storage';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const DOCUMENTS_QUERY = `
  query LeaseDocuments($id: uuid!) {
    lease_files(where: { lease_id: { _eq: $id } }, order_by: [{ created_at: desc }]) { id storage_file_id title category created_at }
  }
`;

type Doc = { id: string; storage_file_id: string; title: string; category: LeaseDocumentCategory | string; created_at: string };

export function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<LeaseDocumentCategory>('signed_lease');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const result = useGraphql<{ lease_files: Doc[] }>(DOCUMENTS_QUERY, { id: leaseId }, reload);
  const refresh = () => setReload((value) => value + 1);

  async function handle(files: File[]) {
    setBusy(true);
    let uploaded = 0;
    for (const file of files) {
      const invalid = validateFile(file, 'document');
      if (invalid) {
        toast.error('Fichier refusé', { description: invalid });
        continue;
      }
      try {
        await uploadLeaseDocument(file, leaseId, category, leaseStorageDeps);
        uploaded += 1;
      } catch (error) {
        showError('Envoi impossible', error);
      }
    }
    setBusy(false);
    if (uploaded > 0) {
      toast.success(uploaded > 1 ? `${uploaded} documents ajoutés` : 'Document ajouté');
      refresh();
    }
  }

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
      showError('Ouverture impossible', error);
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des documents…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les documents : {result.message}</p>;
  const docs = result.data.lease_files;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajouter des documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="max-w-xs">
              <FieldLabel htmlFor="lease-document-category">Catégorie</FieldLabel>
              <Select value={category} onValueChange={(value) => setCategory(value as LeaseDocumentCategory)}>
                <SelectTrigger id="lease-document-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEASE_DOCUMENT_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FileDrop kind="document" disabled={busy} onFiles={(files) => void handle(files)} />
          </CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <FileText className="size-6" aria-hidden />
          Aucun document pour le moment.
        </div>
      ) : (
        (Object.keys(LEASE_DOCUMENT_CATEGORIES) as LeaseDocumentCategory[])
          .filter((key) => docs.some((doc) => doc.category === key))
          .map((key) => (
            <Card key={key} className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">{LEASE_DOCUMENT_CATEGORIES[key]}</CardTitle>
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
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateFr(doc.created_at.slice(0, 10))}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={'Ouvrir ' + doc.title} onClick={() => void openDocument(doc)}>
                            <ExternalLink />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={'Télécharger ' + doc.title}
                            onClick={() => void downloadStoredFile(doc.storage_file_id, doc.title).catch((error) => showError('Téléchargement impossible', error))}
                          >
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

- [ ] **Step 7: Use it in the page** — in `web/src/app/(app)/baux/[id]/page.tsx` add `import { LeaseDocuments } from '@/components/leases/lease-documents';` and replace the placeholder `documents` panel with:

```tsx
          <TabsContent value="documents" className="pt-4">
            <LeaseDocuments leaseId={lease.id} />
          </TabsContent>
```

- [ ] **Step 8: Type-check, lint, test** — `npx tsc --noEmit`, `npm run lint`, `npm test` → all green.

- [ ] **Step 9: Try it on the live data.** `/baux/<lease 1>#documents`: choose « Bail signé », drop a small PDF: toast « Document ajouté », the file appears under « Bail signé » with today's date; « Ouvrir » opens it in a new tab; « Télécharger » saves it with a `.pdf` extension; « Supprimer » asks to confirm and removes it. A `.txt` file is refused with « Format non accepté… ». As a viewer account (if one exists) there is no upload card. Remove the test file afterwards.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/lease-files.ts web/src/lib/lease-files.test.ts web/src/lib/storage.ts web/src/components/leases/lease-documents.tsx web/vitest.config.ts "web/src/app/(app)/baux"
git commit -m "feat: lease documents tab"
```

---

### Task 14: Unit lease card, contact lease cards and dashboard tiles

**Files:**
- Create: `web/src/components/leases/unit-lease-card.tsx`, `web/src/components/leases/contact-leases.tsx`
- Modify: `web/src/lib/leases.ts`, `web/src/app/(app)/baux/page.tsx` (deep-linkable tabs), `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx`, `web/src/app/(app)/contacts/[id]/page.tsx`, `web/src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: views `unit_current_lease`, `lease_overview`; relationships `contacts.lease_parties`, `lease_parties.lease`, `leases.overview`, `leases.units`.
- Produces: `<UnitLeaseCard unitId canCreate />`, `<ContactRenterLeases contactId />`, `<ContactGuaranteedLeases contactId />`, `LEASE_TAB_VALUES` (`@/lib/leases`); the list opens on a tab given by the hash (`/baux#renew`).

- [ ] **Step 1: Deep-linkable tabs on the list** — in `web/src/lib/leases.ts` after `LEASE_TABS` add:

```ts
export const LEASE_TAB_VALUES = LEASE_TABS.map((item) => item.value);
```

In `web/src/app/(app)/baux/page.tsx` add `import { useHashTab } from '@/lib/use-hash';`, add `LEASE_TAB_VALUES` to the `@/lib/leases` import, and replace `const [tab, setTab] = useState<LeaseTab>('all');` with:

```tsx
  const [tab, setTab] = useHashTab(LEASE_TAB_VALUES, 'all');
```

(`useState` stays imported for the search box.) `/baux#renew` now opens on « À renouveler ».

- [ ] **Step 2: The unit card** — `web/src/components/leases/unit-lease-card.tsx`

```tsx
'use client';

import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { LeaseFlagBadges } from '@/components/leases/lease-status-badge';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { formatLeaseNumber, leasePeriod } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query UnitLease($id: uuid!) {
    unit_current_lease(where: { unit_id: { _eq: $id } }, order_by: [{ start_date: asc }]) {
      lease_id number start_date end_date renter_names in_grace is_ending_soon rent_amount charges_amount
    }
  }
`;

type Row = {
  lease_id: string;
  number: number;
  start_date: string;
  end_date: string;
  renter_names: string | null;
  in_grace: boolean;
  is_ending_soon: boolean;
  rent_amount: number | string | null;
  charges_amount: number | string | null;
};

export function UnitLeaseCard({ unitId, canCreate }: { unitId: string; canCreate: boolean }) {
  const result = useGraphql<{ unit_current_lease: Row[] }>(QUERY, { id: unitId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bail en cours</CardTitle>
        <CardDescription>Le bail actif de cette unité et son locataire.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {result.status === 'loading' && <Pulse className="text-muted-foreground">Chargement…</Pulse>}
        {result.status === 'error' && <p role="alert" className="text-destructive">Impossible de charger le bail : {result.message}</p>}
        {result.status === 'success' && result.data.unit_current_lease.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">Aucun bail actif.</p>
            {canCreate && (
              <Button asChild variant="outline" size="sm">
                <Link href={'/baux/nouveau?unite=' + unitId}>
                  <FilePlus2 data-icon="inline-start" />
                  Créer un bail
                </Link>
              </Button>
            )}
          </div>
        )}
        {result.status === 'success' &&
          result.data.unit_current_lease.map((row) => (
            <div key={row.lease_id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Link href={'/baux/' + row.lease_id} className="font-medium text-primary hover:underline">
                  {formatLeaseNumber(row.number)}
                </Link>
                <p className="text-muted-foreground">{row.renter_names ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{leasePeriod(row)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <LeaseFlagBadges row={{ ...row, grace_days_left: null, registration_state: 'registered', registration_deadline: null }} />
                </div>
              </div>
              <p className="font-medium tabular-nums">{row.rent_amount === null ? '—' : formatTnd(row.rent_amount)}</p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
```

In `web/src/app/(app)/biens/[id]/unites/[unitId]/page.tsx`: add `import { UnitLeaseCard } from '@/components/leases/unit-lease-card';`; in the `apercu` panel insert `<UnitLeaseCard unitId={current.id} canCreate={canEdit && !archived} />` between the facts grid and the status card; and replace the status card's description text `Le statut suivra automatiquement les baux et les ventes. En attendant, vous pouvez le corriger ici.` with `Le statut suit les baux : loué dès qu’un bail est actif, disponible sinon. Les ventes viendront avec le module Ventes. Vous pouvez le corriger ici en cas d’exception.`

- [ ] **Step 3: The contact cards** — `web/src/components/leases/contact-leases.tsx`

```tsx
'use client';

import Link from 'next/link';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { Pulse } from '@/components/motion/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaseStatus, RegistrationState } from '@/lib/lease-types';
import { formatLeaseNumber, leasePeriod } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query ContactLeases($id: uuid!, $role: String!) {
    lease_parties(where: { contact_id: { _eq: $id }, role: { _eq: $role } }, order_by: [{ lease: { number: desc } }]) {
      lease {
        id number status start_date end_date
        overview { is_ending_soon in_grace grace_days_left registration_state registration_deadline }
        units { unit { code property { name } } }
      }
    }
  }
`;

type Row = {
  lease: {
    id: string;
    number: number;
    status: LeaseStatus;
    start_date: string;
    end_date: string;
    overview: { is_ending_soon: boolean; in_grace: boolean; grace_days_left: number | null; registration_state: RegistrationState; registration_deadline: string | null } | null;
    units: { unit: { code: string; property: { name: string } } }[];
  };
};

function LeaseRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y">
      {rows.map(({ lease }) => (
        <li key={lease.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <div>
            <Link href={'/baux/' + lease.id} className="font-medium text-primary hover:underline">
              {formatLeaseNumber(lease.number)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {lease.units.map(({ unit }) => `${unit.code} · ${unit.property.name}`).join(', ')} · {leasePeriod(lease)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <LeaseStatusBadge status={lease.status} />
            {lease.overview && <LeaseFlagBadges row={{ ...lease.overview, end_date: lease.end_date }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Leases rented by this contact, shown inside the « Locataire » role card. */
export function ContactRenterLeases({ contactId }: { contactId: string }) {
  const result = useGraphql<{ lease_parties: Row[] }>(QUERY, { id: contactId, role: 'renter' });
  if (result.status === 'loading') return <Pulse>Chargement des baux…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-destructive">Impossible de charger les baux : {result.message}</p>;
  if (result.data.lease_parties.length === 0) return <p>Aucun bail pour le moment.</p>;
  return <LeaseRows rows={result.data.lease_parties} />;
}

/** Leases this contact guarantees: its own card, absent when there are none. */
export function ContactGuaranteedLeases({ contactId }: { contactId: string }) {
  const result = useGraphql<{ lease_parties: Row[] }>(QUERY, { id: contactId, role: 'guarantor' });
  if (result.status !== 'success' || result.data.lease_parties.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Garant</CardTitle>
        <CardDescription>Baux que ce contact garantit.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <LeaseRows rows={result.data.lease_parties} />
      </CardContent>
    </Card>
  );
}
```

In `web/src/app/(app)/contacts/[id]/page.tsx`: add `import { ContactGuaranteedLeases, ContactRenterLeases } from '@/components/leases/contact-leases';`; replace

```tsx
const LATER_MODULE: Record<Exclude<ContactRole, 'owner'>, string> = {
  renter: 'Les baux de ce locataire apparaîtront ici avec le module Baux.',
  buyer: 'Les offres et achats apparaîtront ici avec le module Ventes.',
};
```

with

```tsx
const BUYER_LATER_MODULE = 'Les offres et achats apparaîtront ici avec le module Ventes.';
```

replace the line `{active && role.value !== 'owner' && LATER_MODULE[role.value]}` with

```tsx
                    {active && role.value === 'renter' && <ContactRenterLeases contactId={current.id} />}
                    {active && role.value === 'buyer' && BUYER_LATER_MODULE}
```

and, right after the closing `</Stagger>` of the roles grid (before the notes `StaggerItem`), add:

```tsx
      <StaggerItem>
        <ContactGuaranteedLeases contactId={current.id} />
      </StaggerItem>
```

- [ ] **Step 4: Dashboard tiles** — in `web/src/app/(app)/page.tsx`: extend `DASHBOARD_QUERY` (before the closing backtick) with

```graphql
    leases_to_renew: lease_overview_aggregate(where: { _or: [{ is_ending_soon: { _eq: true } }, { in_grace: { _eq: true } }] }) { aggregate { count } }
    registrations_due: lease_overview_aggregate(where: { registration_state: { _in: ["due_soon", "overdue"] } }) { aggregate { count } }
```

extend `DashboardData` with `leases_to_renew: { aggregate: { count: number } }; registrations_due: { aggregate: { count: number } };`, add `FileClock` and `FileBadge` to the lucide import, destructure `leases_to_renew, registrations_due` next to `record_gaps_aggregate`, and render after the « Fiches incomplètes » banner:

```tsx
      {(leases_to_renew.aggregate.count > 0 || registrations_due.aggregate.count > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {leases_to_renew.aggregate.count > 0 && (
            <Link
              href="/baux#renew"
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileClock className="size-4 text-warning" aria-hidden />
                Baux à renouveler : {leases_to_renew.aggregate.count}
              </span>
              <span className="text-muted-foreground">Voir →</span>
            </Link>
          )}
          {registrations_due.aggregate.count > 0 && (
            <Link
              href="/baux#active"
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileBadge className="size-4 text-warning" aria-hidden />
                Enregistrements à faire : {registrations_due.aggregate.count}
              </span>
              <span className="text-muted-foreground">Voir →</span>
            </Link>
          )}
        </div>
      )}
```

- [ ] **Step 5: Type-check, lint, test** — `npx tsc --noEmit`, `npm run lint`, `npm test` → green.

- [ ] **Step 6: Try it on the live data.** Dashboard: two yellow banners « Baux à renouveler : 2 » (leases 1 and 2) and « Enregistrements à faire : 1 » (lease 3); each link opens `/baux` on the right tab. Unit page of C-12: « Bail en cours » shows « Bail N° 1 », Mehdi Trabelsi, the period, « Fin dans 20 jours ». Unit B-102 (no active lease): « Aucun bail actif. » with « Créer un bail » → `/baux/nouveau?unite=…` with B-102 preselected. Contact « SARL Carthage Digital »: « Locataire » card lists N° 2, 4, 5 with their badges; contact « Hédi Ben Salem » shows a « Garant » card with N° 2; a contact without leases shows no « Garant » card and « Aucun bail pour le moment. » when renter.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/leases.ts "web/src/app/(app)" web/src/components/leases
git commit -m "feat: lease cards on unit and contact pages, dashboard tiles, deep-linkable tabs"
```

---

### Task 15: End-to-end test, full verification, documentation

**Files:**
- Create: `web/e2e/helpers.ts`, `web/e2e/leases.spec.ts`, `docs/superpowers/handoffs/2026-10-15-leases-plan-a.md`
- Modify: `web/e2e/core-records.spec.ts`, `docs/superpowers/specs/2026-10-15-leases-design.md` (status line), memory file `project_biens_contacts_roadmap.md`

**Interfaces:**
- Produces: `signIn(page)`, `pickContact(page, name)`, `isoInDays(days)`, `EMAIL`, `PASSWORD` from `web/e2e/helpers.ts`.

- [ ] **Step 1: Share the E2E helpers** — `web/e2e/helpers.ts`

```ts
import { expect, type Page } from '@playwright/test';
import { addDays, todayTunis } from '../src/lib/dates';

export const EMAIL = process.env.E2E_EMAIL;
export const PASSWORD = process.env.E2E_PASSWORD;

export const isoInDays = (days: number): string => addDays(todayTunis(), days);

export async function signIn(page: Page) {
  await page.goto('/connexion');
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
```

In `web/e2e/core-records.spec.ts` replace everything above the line `test('bien → units → owner for all → transfer → contact → photo → pin → incomplete list', async ({ page }) => {` with:

```ts
import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, isoInDays, pickContact, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

```

Run (from `web/`, dev server on port 3000 or let Playwright start it): `npm run test:e2e -- e2e/core-records.spec.ts`
Expected: 1 passed (Project 1 flow unchanged). Delete `web/test-results` afterwards: failure snapshots contain the typed credentials.

- [ ] **Step 2: The lease flow** — `web/e2e/leases.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { EMAIL, PASSWORD, isoInDays, pickContact, signIn } from './helpers';

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in web/.env.test.local');

test('lease: draft → activate → unit rented → rent change → renew → end → unit available', async ({ page }) => {
  test.setTimeout(240_000);
  const bienName = `E2E Bail ${Date.now().toString().slice(-6)}`;
  await signIn(page);

  // A bien with two units.
  await page.goto('/biens/nouveau');
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
  await page.goto('/baux/nouveau');
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
```

- [ ] **Step 3: Run it**

Run: `npm run test:e2e -- e2e/leases.spec.ts` (credentials come from `web/.env.test.local`; the agent never reads or types them). Expected: 1 passed. On a failure: read the error and the `error-context.md` snapshot (it may contain the typed e-mail and password: never copy them), fix the app or the test (a missed hydration wait is the usual cause: wait for a visible element that only exists after data loads), rerun. Then `Remove-Item -Recurse -Force test-results, playwright-report`. If a failed run left an active « E2E Bail » bien, archive it in the app.

- [ ] **Step 4: Whole-project checks** (from `web/`)

Run: `npm run lint`, `npm run test:coverage`, `npm run build`
Expected: lint clean; all tests pass with coverage ≥ 80 % on the listed files; the build succeeds. Also `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0003_leases.test.sql && bash scripts/db-local.sh test db/tests/0002_core_records.test.sql` → both `OK: all …`.

- [ ] **Step 5: Browser check of every new page** (Claude in Chrome with the signed-in session, as in Project 1): `/baux` (five tabs, search, flags), `/baux/nouveau`, `/baux/<id>` (the three tabs; each header action opens its dialog), `/baux/<id>/modifier`, the unit page, the contact page, the dashboard tiles. For each page, desktop and 375 px (an iframe of the page at width 375, as before): no horizontal scroll, no console errors other than the Next dev-mode notice « Could not validate that a segment in your UI has instant navigation ». Fix what breaks (test first for logic, then code) and commit each fix.

- [ ] **Step 6: Handoff and memory** — write `docs/superpowers/handoffs/2026-10-15-leases-plan-a.md` with: what is done (list the tasks), what is live (migration 0003 applied, tests OK, permissions applied, seed applied), what the daily expiry still needs (Plan B deploys the function: until then expired leases are not auto-expired; `expire_overdue_leases` can be run by hand with the admin secret), the working Vitest fix of Task 0, the deferred items (branch filter on the list, MEDIUM findings of the database review that were not fixed, `Réessayer` not yet used by the Project 1 pages), and the next step (write Plan B: calendar, notifications and email, against the real interfaces: `appointments` and `notifications` in migration `0004`, `calendar_feed`, `staff_members`, the daily function, FullCalendar). Update the status line of `project_biens_contacts_roadmap.md` in the memory folder and the status line at the top of the spec (« Plan A built »).

- [ ] **Step 7: Commit and report**

```bash
git add web/e2e docs/superpowers
git commit -m "test: end-to-end lease flow; docs: Plan A handoff"
```

Then tell the user: Plan A is built and verified; ask whether to write Plan B (calendar, notifications, email).

---

## Self-review (run after writing; findings fixed inline above)

**Spec coverage (Plan A scope):** leases with several renters, guarantors and units (Tasks 3, 10); dates, payment day, deposit amount, fixed charges (3, 10); rent changes with history (3, 4, 12); renewal extending the same lease with a term log (4, 11); end and expiry (4; the daily trigger arrives in Plan B); unit status following leases and never overriding for-sale, sold or maintenance (4); registration tracking with the 10-day warning (3, 5, 11); documents (13); lessor from current owners (11); list, fiche, form, unit card, contact cards, dashboard tiles (9–14); French errors and « Réessayer » (2); permissions with function permissions and admin-only expiry (6); testing at all levels (3–5, 8–13, 15). **Not in Plan A, by design:** calendar, appointments, notifications, email, the daily function (Plan B); rent requests (Plan C); inspections and deposit movements (Plan D); the « Calendrier », « Dépôt » and « États des lieux » tabs; the branch filter of the list.

**Placeholder scan:** no `TBD`/`TODO`; every code step shows its code; the only « if … » branches are real conditions (Docker unavailable, an icon missing from `lucide-react`).

**Type consistency:** `LeaseOverviewRow`, `LeaseDraftInput`, `LeaseUnitInput` (Task 8) are used unchanged by Tasks 9–10 and 14; `LeaseDetails` (Task 11) by Tasks 11–13; `UploadDeps` is reused by Task 13; mutation argument names (`p_lease_id`, `p_signed_on`, `p_new_end_date`, `p_rents`, `p_note`, `p_ended_on`, `p_reason`, `p_unit_id`, `p_effective_from`, `p_rent`, `p_charges`) match between Tasks 4, 6, 11 and 12; error codes match between Tasks 2, 3 and 4.

