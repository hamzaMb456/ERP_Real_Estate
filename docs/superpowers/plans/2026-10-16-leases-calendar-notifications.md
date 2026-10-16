# Leases — Calendar, notifications, daily job and e-mail (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared calendar with appointments and participants, bell notifications, a daily job (06:00 Tunis) that expires overdue leases and writes reminders, and e-mail for reminders and invitations.

**Architecture:** Postgres holds the rules: `appointments`, `appointment_participants` and `notifications` tables, the `staff_members` and `calendar_feed` views, and the SQL function `generate_daily_notifications()`. Hasura cron and event triggers call three small Nhost functions in `functions/`; they contain no business rules and only call Hasura and SMTP. The web adds a FullCalendar wrapper, the appointment dialog, the notification bell, and a calendar entry on the lease fiche and the contact page.

**Tech Stack:** Postgres 16 (SQL, plpgsql), Hasura metadata API, Nhost functions (TypeScript, Node 20), nodemailer (Google SMTP), Vitest, Next.js 16, React 19, FullCalendar 6 (`@fullcalendar/react`, `daygrid`, `timegrid`, `list`, `interaction`), react-hook-form + zod, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-leases-design.md` (sections 3.1, 5, 6, 7, 8, 9, 10, and section 11 slice 1 steps 4–5).

**Depends on:** Plan A (`docs/superpowers/plans/2026-10-15-leases-core.md`, built). Migration `0003_leases.sql` must be applied to the live database before `0004` (user step). Plan A is not yet verified live; Task 14 lists the live checks.

## Global Constraints

- Money is `numeric(12,3)` TND. Calendar times are `timestamptz`; the UI shows and enters them in `Africa/Tunis` (UTC+1, no DST).
- Every table has `organization_id`; composite foreign keys `(id, organization_id)` on every cross-table link.
- "Today" is `public.today_tunis()` in SQL and `todayTunis()` in TypeScript. Day thresholds come only from `public.lease_rule(name)`. Never hard-code 60, 7, 10 or 90 outside `lease_rule`.
- Migrations are ASCII only (they travel by clipboard). French text never appears in SQL, only stable error codes.
- Functions that act for a user are `SECURITY DEFINER`, `set search_path = public, pg_temp`, take `hasura_session json`, and check the caller's organization and role (`org_admin` or `manager`).
- Hasura metadata is additive: `scripts/apply-hasura-permissions.mjs` and the new `scripts/apply-hasura-triggers.mjs` drop and re-create only the entries they list; they never replace the metadata.
- Functions never contain business rules: `lease-daily.ts` calls two SQL functions and nothing else.
- Email never blocks an action: the row is saved first; a failure is stored in `email_error` and `email_status = 'failed'`.
- Secrets (`HASURA_ADMIN_SECRET`, `NHOST_WEBHOOK_SECRET`, `SMTP_*`) are read from the environment only; nothing is written to the repository or to chat.
- French UI, shadcn/ui, same app shell as Project 1. Each page is checked at desktop and 375 px.

## Rulings (spec conflicts resolved here)

- **R1 Migration numbering.** Spec section 3.2 is headed `0004_rent_requests.sql` and also says `appointments.rent_request_id` is added in `0004`. Section 3 (header) and section 11 say `0004` is calendar and notifications. This plan follows section 3 and section 11: `0004_calendar_notifications.sql`. Rent requests is `0005_rent_requests.sql` and adds `appointments.rent_request_id` there, because the `rent_requests` table does not exist before `0005`. Cost if wrong: one renumbering in slice 2.
- **R2 Staff source.** Staff are users whose roles in `auth.user_roles` include `org_admin` or `manager`, with `auth.users.metadata->>'organization_id'` equal to the organization and `disabled = false`. The spec names `auth.users` only; Nhost keeps a user's allowed roles in `auth.user_roles`. Cost if wrong: the staff list is empty and the assumption in spec section 12 fails. Task 2 has a live check the user runs.
- **R3 Recipients.** Lease notifications go to every staff member of the organization. Appointment reminders go to the assigned staff member, or to every staff member when no one is assigned.
- **R4 Calendar lease events.** Only leases with status `active` produce events: `lease_start`, `lease_end`, and `registration_deadline` (only while `registered_at` is null). All are all-day events, one per leased unit, end-exclusive. Cost if wrong: ended leases vanish from the calendar; they stay visible on the list.
- **R5 Expired notifications.** `lease_expired` is written only for leases whose `ended_on` falls within the last 7 days, so the first run does not flood staff with old expirations.
- **R6 Renvoyer.** The « Renvoyer » action sets a participant's `email_status` back to `pending`; the event trigger on that update sends the invitation again. The trigger fires on insert, and on `update of email_status` when the new value is `pending`.
- **R7 Form time.** The form takes a date and a time and builds `YYYY-MM-DDTHH:mm:00+01:00`. Tunisia has no daylight saving time, so the fixed offset is exact.
- **R8 Invitation content.** Plain French text in the e-mail, no calendar attachment (YAGNI; the spec does not ask for one).

## Review Focus

1. A cancelled appointment must not produce a reminder, neither in the bell nor by e-mail. Pinned by Task 3 (SQL) and Task 7 (handler).
2. Running the daily job twice on the same day creates no duplicate notifications. Pinned by Task 3 (SQL) and Task 7 (handler).
3. A retried event trigger (Nhost retries 3 times) must not e-mail a participant twice. Pinned by Task 9: a participant whose `email_status` is already `sent` is skipped.
4. An appointment whose participant has no e-mail address gets `email_status = 'skipped'`, not `failed`, and the appointment still saves. Pinned by Task 9.
5. An appointment near midnight, or a reminder for "tomorrow" computed near midnight, uses Tunis days. Pinned by Task 2 (`calendar_feed` day boundaries) and Task 3 (reminder day).

---

### Task 1: Migration 0004 — appointments, participants, notifications

**Files:**
- Create: `db/migrations/0004_calendar_notifications.sql`
- Modify: `db/local/stubs.sql` (add `auth.user_roles`, local stand-in only)
- Create: `db/tests/0004_calendar_notifications.test.sql` (part 1: tables and constraints)

**Interfaces:**
- Consumes: `public.today_tunis()`, `public.lease_rule(text)`, `public.set_updated_at()` (0001, 0003); `units(id, organization_id)`, `contacts(id, organization_id)`, `leases(id, organization_id)`; `auth.users(id)`.
- Produces: tables `appointments`, `appointment_participants`, `notifications`, and `auth.user_roles` in the local stubs. Later tasks read exactly these column names.

Columns (exact):
- `appointments`: `id uuid primary key default gen_random_uuid()`, `organization_id uuid not null`, `kind text not null check (kind in ('viewing','move_in','move_out','meeting','other'))`, `title text not null check (length(trim(title)) > 0)`, `location text`, `starts_at timestamptz not null`, `ends_at timestamptz not null`, `status text not null default 'planned' check (status in ('planned','done','cancelled'))`, `assigned_user_id uuid references auth.users (id) on delete set null`, `unit_id uuid`, `lease_id uuid`, `notify_by_email boolean not null default true`, `reminder_sent_at timestamptz`, `notes text`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Constraints: `appointments_dates_check check (ends_at > starts_at)`; `unique (id, organization_id)`; composite `(unit_id, organization_id) references units (id, organization_id)` and `(lease_id, organization_id) references leases (id, organization_id)` (nulls allowed).
- `appointment_participants`: `appointment_id uuid not null`, `organization_id uuid not null`, `contact_id uuid not null`, `role text not null check (role in ('renter','guarantor','prospect','buyer','other'))`, `email_status text not null default 'pending' check (email_status in ('pending','sent','failed','skipped'))`, `email_error text`, `created_at`, `updated_at`. Primary key `(appointment_id, contact_id)`. Composite foreign keys `(appointment_id, organization_id) references appointments (id, organization_id) on delete cascade` and `(contact_id, organization_id) references contacts (id, organization_id)`.
- `notifications`: `id uuid primary key default gen_random_uuid()`, `organization_id uuid not null`, `user_id uuid not null references auth.users (id) on delete cascade`, `kind text not null check (kind in ('lease_ending_soon','lease_grace','lease_expired','registration_due','registration_overdue','appointment_reminder'))`, `title text not null`, `body text`, `link text`, `lease_id uuid`, `appointment_id uuid`, `dedupe_key text not null`, `read_at timestamptz`, `emailed_at timestamptz`, `email_error text`, `created_at timestamptz not null default now()`. Constraints: `unique (organization_id, user_id, dedupe_key)`; composite foreign keys to `leases` and `appointments` (nullable).
- `auth.user_roles` (local stub only): `user_id uuid references auth.users (id) on delete cascade`, `role text not null`, primary key `(user_id, role)`.

Triggers and indexes:
- `set_updated_at` before update on `appointments` and `appointment_participants`.
- `check_appointment_staff` (before insert or update of `assigned_user_id` on `appointments`): when set, the user must have a role in `('org_admin','manager')` in `auth.user_roles` and `metadata->>'organization_id'` equal to the row's organization. Raises `appointment_staff_invalid` (errcode `23514`).
- Indexes: `appointments (organization_id, starts_at)`, `appointments (assigned_user_id, starts_at)`, `appointment_participants (contact_id)`, `notifications (user_id, read_at)`, `notifications (organization_id, created_at)`.

- [ ] **Step 1: Write the failing test (part 1)**

In `db/tests/0004_calendar_notifications.test.sql`, one `do $$ ... $$` block that ends by raising `OK: all calendar tests passed`. Inside `begin ... exception when others` sub-blocks, assert:
- an appointment with `ends_at = starts_at` raises `23514`;
- a participant whose contact belongs to another organization raises `23503`;
- `assigned_user_id` pointing to a user without `org_admin`/`manager` raises `appointment_staff_invalid`;
- two `notifications` rows with the same `(organization_id, user_id, dedupe_key)` raise `23505`.

Use the demo organization id from `db/seeds/0001_demo_data.sql` and the fixture pattern of `db/tests/0003_leases.test.sql` (`pg_temp` helper functions). The final raise rolls back every fixture.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash scripts/db-local.sh up`, then `bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: FAIL, `relation "public.appointments" does not exist`.

- [ ] **Step 3: Write the migration and the local stub**

Write `db/migrations/0004_calendar_notifications.sql` with the tables, constraints, trigger and indexes above. Its header comment: "0004: calendar appointments, participants and notifications. Apply after 0003; then run db/tests/0004_calendar_notifications.test.sql. ASCII only." Add `auth.user_roles` to `db/local/stubs.sql`. No view, function or grant in this task.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: `OK: all calendar tests passed`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0004_calendar_notifications.sql db/local/stubs.sql db/tests/0004_calendar_notifications.test.sql
git commit -m "feat(db): calendar appointments, participants and notifications (migration 0004, part 1)"
```

---

### Task 2: Views — `staff_members` and `calendar_feed`

**Files:**
- Modify: `db/migrations/0004_calendar_notifications.sql` (append)
- Modify: `db/tests/0004_calendar_notifications.test.sql` (part 2)

**Interfaces:**
- Consumes: Task 1 tables; `public.lease_rule`, `public.today_tunis()`; `leases`, `lease_units`, `lease_parties`, `units`, `properties` (for `branch_id`); `auth.users`, `auth.user_roles`.
- Produces: `public.staff_members` (`user_id uuid`, `organization_id uuid`, `display_name text`, `email text`, `role text`). `public.calendar_feed` with exact columns: `event_id text`, `organization_id uuid`, `source text` (`appointment` | `lease`), `kind text`, `title text`, `starts_at timestamptz`, `ends_at timestamptz`, `all_day boolean`, `status text`, `appointment_id uuid`, `lease_id uuid`, `unit_id uuid`, `branch_id uuid`, `assigned_user_id uuid`, `contact_ids uuid[]`, `location text`, `notify_by_email boolean`.

Rules:
- `staff_members`: one row per user with a role in `('org_admin','manager')`, `disabled = false`, organization from `metadata->>'organization_id'`. `select distinct` so a user with two staff roles appears once.
- `calendar_feed` appointment rows: `event_id = 'a:' || id`, `source = 'appointment'`, `all_day = false`, `kind` and `title` from the appointment, `contact_ids` = participant contacts (empty array when none), `branch_id` from the appointment's unit (null without a unit).
- `calendar_feed` lease rows: one row per `lease_units` row of an `active` lease. `event_id = 'l:' || lease_id || ':' || unit_id || ':' || kind`, `source = 'lease'`, `all_day = true`. `starts_at` = the day at 00:00 `Africa/Tunis`, `ends_at` = the following day at 00:00 `Africa/Tunis` (end-exclusive, R4). Kinds: `lease_start` (`start_date`), `lease_end` (`end_date`), `registration_deadline` (`signed_at + lease_rule('registration_days')`, only when `registered_at` is null and `signed_at` is not null). `contact_ids` = the renters and guarantors of the lease.

- [ ] **Step 1: Write the failing test (part 2)**

Add to the same test block:
- an active lease starting today produces one `lease_start` row whose `starts_at` equals `(public.today_tunis()::timestamp at time zone 'Africa/Tunis')`;
- a draft lease produces no lease event;
- a cancelled appointment is still returned by `calendar_feed` (the web filters it out) and its `contact_ids` lists its participants;
- `staff_members` has a row for a `manager` of organization X and none for a `viewer`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: FAIL, `relation "public.staff_members" does not exist`.

- [ ] **Step 3: Write the views**

Append both views to the migration. `calendar_feed` is a `union all` of the two sources. It is not filtered by SQL; Hasura filters by organization.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: `OK: all calendar tests passed`

- [ ] **Step 5: Live check (user step; the agent does not run it)**

After 0004 is applied to Nhost, ask the user to run in the SQL console: `select user_id, organization_id, role from public.staff_members;`. Expected: one row per org_admin or manager. If it is empty, Ruling R2 is wrong: stop and ask before Task 3.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/0004_calendar_notifications.sql db/tests/0004_calendar_notifications.test.sql
git commit -m "feat(db): staff_members and calendar_feed views (migration 0004, part 2)"
```

---

### Task 3: `generate_daily_notifications()` and the thresholds it needs

**Files:**
- Modify: `db/migrations/0004_calendar_notifications.sql` (append)
- Modify: `db/tests/0004_calendar_notifications.test.sql` (part 3)

**Interfaces:**
- Consumes: `public.lease_overview` (0003: `is_ending_soon`, `in_grace`, `registration_state`), `public.staff_members` (Task 2), `public.today_tunis()`, `public.lease_rule(text)`.
- Produces: `public.generate_daily_notifications() returns integer` (number of rows inserted). Admin only: revoked from `public`, granted to `nhost_hasura` and `postgres` when those roles exist (same DO-block pattern as 0003).
- `public.lease_rule` is replaced with `create or replace` keeping the 0003 values and adding `expired_notice_days` = 7 and `notification_retention_days` = 90.

Rules (every insert uses `on conflict (organization_id, user_id, dedupe_key) do nothing`):
- `lease_ending_soon`: active, unarchived leases with `is_ending_soon`; title « Bail N° {number} se termine bientôt »; dedupe `lease_ending_soon:{lease_id}:{end_date}`; recipients: every staff member (R3).
- `lease_grace`: `in_grace`; dedupe `lease_grace:{lease_id}:{end_date}`; every staff member.
- `lease_expired`: status `expired` and `ended_on >= today_tunis() - lease_rule('expired_notice_days')` (R5); dedupe `lease_expired:{lease_id}`; every staff member.
- `registration_due` (`registration_state = 'due_soon'`) and `registration_overdue` (`'overdue'`); dedupe `{kind}:{lease_id}:{registration deadline}`; every staff member.
- `appointment_reminder`: appointments with `status = 'planned'` whose Tunis date is `today_tunis() + 1`; dedupe `appointment_reminder:{appointment_id}`; recipient is the assigned staff member, or every staff member when none is assigned (R3). Sets `reminder_sent_at = now()` on those appointments.
- Cleanup: delete notifications with `created_at < now() - lease_rule('notification_retention_days') * interval '1 day'`.

- [ ] **Step 1: Write the failing test (part 3)**

Assert:
- running the function twice on the same day inserts rows the first time and zero the second (Review Focus 2);
- a cancelled appointment tomorrow produces no reminder (Review Focus 1); a planned one tomorrow produces exactly one reminder, for its assigned user;
- a lease that ended 8 days ago produces no `lease_expired`; one that ended 2 days ago produces one;
- a notification created 91 days ago is deleted and one created 89 days ago is kept;
- `has_function_privilege('public', 'public.generate_daily_notifications()', 'execute')` is false.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: FAIL, `function public.generate_daily_notifications() does not exist`.

- [ ] **Step 3: Write the function, the `lease_rule` update and the grants**

Write `lease_rule` with `create or replace` (new names added). Write the function as `language plpgsql security definer set search_path = public, pg_temp`. Order: leases first, then registrations, then appointments, then cleanup. Revoke execute from `public`; grant to `nhost_hasura` and `postgres` when those roles exist.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: `OK: all calendar tests passed`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0004_calendar_notifications.sql db/tests/0004_calendar_notifications.test.sql
git commit -m "feat(db): daily notification generator with dedupe and retention (migration 0004, part 3)"
```

---

### Task 4: Demo seed for calendar and notifications

**Files:**
- Create: `db/seeds/0004_demo_calendar.sql`

**Interfaces:**
- Consumes: the demo organization, units and contacts of `db/seeds/0001_demo_data.sql` and `0002_demo_core_records.sql`; leases of `db/seeds/0003_demo_leases.sql`.
- Produces: appointments over the next days in several kinds and statuses, participants with and without e-mail, one cancelled appointment. The seed creates no users.

Rules:
- Appointments are relative to `today_tunis()`: a viewing today 10:00; a move-in tomorrow 09:00 (a reminder will be generated); a cancelled meeting tomorrow 15:00; a `done` move-out seven days ago; a planned meeting in five days; one appointment with no assigned staff.
- `assigned_user_id` is the first user in `auth.user_roles` with `org_admin` or `manager` for the demo organization; when none exists the column stays null.
- Participants are the renters of the demo leases (`lease_parties`), and one prospect contact without an e-mail address.
- Idempotent: `on conflict do nothing`, fixed UUIDs in the `b0000000-0000-4000-8000-0000000002xx` range (distinct from 0003).

- [ ] **Step 1: Write the seed**

One transaction with fixed UUIDs. Header comment: "Demo calendar. Safe to run twice. Needs 0001–0004 applied."

- [ ] **Step 2: Verify the seed locally**

Run: `bash scripts/db-local.sh up`
Expected: `applying 0004_demo_calendar.sql` with no error. Then `bash scripts/db-local.sh psql` and `select count(*) from public.appointments;` returns 6.

- [ ] **Step 3: Commit**

```bash
git add db/seeds/0004_demo_calendar.sql
git commit -m "feat(db): demo calendar seed (appointments, participants, one cancelled)"
```

---

### Task 5: Hasura permissions for calendar and notifications

**Files:**
- Modify: `scripts/apply-hasura-permissions.mjs`

**Interfaces:**
- Consumes: the existing `TRACK`, `SELECT_COLUMNS`, `WRITE_COLUMNS`, `RELATIONSHIPS`, `ADMIN_FUNCTIONS` structures and helpers (`orgFilter`, `linkedToOrg`, `ownUpload`).
- Produces: tracked tables and views `appointments`, `appointment_participants`, `notifications`, `staff_members`, `calendar_feed`; relationships `appointments.participants`, `appointments.unit`, `appointments.lease`, `appointments.assigned_user`, `appointment_participants.appointment`, `appointment_participants.contact`, `contacts.appointment_participants`, `leases.appointments`, `notifications.lease`, `notifications.appointment`.

Permissions (exact):
- `select` on `appointments`, `appointment_participants`, `calendar_feed`, `staff_members`: writers and `viewer`, filtered by `organization_id = X-Hasura-Org-Id`.
- `select` on `notifications`: every role, filtered by `organization_id = X-Hasura-Org-Id` **and** `user_id = X-Hasura-User-Id`.
- `insert` on `appointments`: writers; preset `organization_id` from `X-Hasura-Org-Id`.
- `update` on `appointments`: writers; filter by organization; columns `kind, title, location, starts_at, ends_at, status, assigned_user_id, unit_id, lease_id, notify_by_email, notes`. Never `reminder_sent_at`.
- `insert` on `appointment_participants`: writers; preset `organization_id`.
- `update` on `appointment_participants`: writers; columns `role, email_status` (the `email_status` update is used only by Renvoyer, R6).
- `delete` on `appointment_participants`: writers; filter by organization.
- `update` on `notifications`: every role; filter own rows; column `read_at` only.
- `generate_daily_notifications` goes in `ADMIN_FUNCTIONS` (no role permission).

- [ ] **Step 1: Record the current dry run**

Run: `node scripts/apply-hasura-permissions.mjs --dry-run`
Expected before the change: the summary does not mention `appointments`. Record the counts.

- [ ] **Step 2: Extend the script**

Add the names to `TRACK`, the columns to `SELECT_COLUMNS` and `WRITE_COLUMNS`, the relationships to `RELATIONSHIPS`, and the permission rules above. Follow the existing `leases` entries exactly. Update the summary counts.

- [ ] **Step 3: Verify**

Run: `node scripts/apply-hasura-permissions.mjs --dry-run`
Expected: counts grew by the new tables, relationships and permissions; no error. Then `node --check scripts/apply-hasura-permissions.mjs` exits 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/apply-hasura-permissions.mjs
git commit -m "feat(hasura): calendar and notification permissions and relationships"
```

---

### Task 6: Hasura triggers script (cron and event triggers)

**Files:**
- Create: `scripts/apply-hasura-triggers.mjs`

**Interfaces:**
- Consumes: the Hasura metadata helper pattern of `scripts/apply-hasura-permissions.mjs` (`metadata(body)`, `HASURA_URL`, `HASURA_ADMIN_SECRET`, `--dry-run`).
- Produces: additive creation of four triggers. Each sends the header `x-nhost-webhook-secret` (value from `NHOST_WEBHOOK_SECRET`) to `NHOST_FUNCTIONS_URL` plus a path:
  - cron trigger `lease_daily`: schedule `0 6 * * *`, timezone `Africa/Tunis`, path `/lease-daily`;
  - event trigger `notification_email` on `notifications`, operation `insert`, path `/send-notification-email`;
  - event trigger `appointment_invitation` on `appointment_participants`, operations `insert` and `update` of `email_status`, path `/send-appointment-email`;
  - event trigger `appointment_changed` on `appointments`, operation `update` of `starts_at, ends_at, location, status`, path `/send-appointment-email`.
- Each event trigger: retries 3, interval 60 s.

The script deletes and re-creates only these four names. It never touches other triggers.

- [ ] **Step 1: Write the failing check**

Run: `node scripts/apply-hasura-triggers.mjs --dry-run`
Expected: FAIL, `Cannot find module` (file not written yet).

- [ ] **Step 2: Write the script**

Support `--dry-run` (print the JSON bodies, send nothing). Without `HASURA_ADMIN_SECRET`, `NHOST_FUNCTIONS_URL` or `NHOST_WEBHOOK_SECRET`, print which one is missing and exit 1. Use the same batching of 20 as the permissions script.

- [ ] **Step 3: Verify**

Run: `node scripts/apply-hasura-triggers.mjs --dry-run` with the three variables set to dummy values.
Expected: four create bodies (one cron, three event), exit 0. `node --check` passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/apply-hasura-triggers.mjs
git commit -m "feat(hasura): cron and event trigger script for the daily job and e-mail"
```

---

### Task 7: Nhost functions scaffold and the daily job

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/vitest.config.ts`
- Create: `functions/lib/hasura.ts`, `functions/lib/webhook.ts`
- Create: `functions/lease-daily.ts`, `functions/lease-daily.test.ts`

**Interfaces:**
- `functions/lib/hasura.ts`: `createHasuraClient(options: { url: string; adminSecret: string; fetch?: typeof fetch }): { request<T>(query: string, variables?: Record<string, unknown>): Promise<T> }`. Throws an `Error` with the GraphQL messages joined.
- `functions/lib/webhook.ts`: `isAuthorizedWebhook(headers: Record<string, string | undefined>, expected: string | undefined): boolean`. Constant-time comparison; a missing `expected` returns false.
- `functions/lease-daily.ts`: `runLeaseDaily(client): Promise<{ expired: number; notified: number }>`, and the default `handler(request: Request): Promise<Response>`. The handler returns 401 when the webhook check fails and 200 with the counts otherwise. It calls only `expire_overdue_leases` (counted by returned rows) and then `generate_daily_notifications`, in that order.

Environment, read only inside the handler: `HASURA_GRAPHQL_URL`, `HASURA_ADMIN_SECRET`, `NHOST_WEBHOOK_SECRET`.

- [ ] **Step 1: Write the failing test**

`functions/lease-daily.test.ts` with a fake client that records queries and returns canned data:
- `runLeaseDaily` calls `expire_overdue_leases` before `generate_daily_notifications`;
- it returns `{ expired: 2, notified: 5 }` when the fakes return 2 rows and a count of 5;
- `handler` returns 401 when `x-nhost-webhook-secret` does not match, and sends no query;
- `handler` returns 200 with the JSON counts when the secret matches.

- [ ] **Step 2: Run the test to verify it fails**

Run from `functions/`: `npm install && npx vitest run`
Expected: FAIL, `Cannot find module './lease-daily'`.

- [ ] **Step 3: Implement the scaffold and the handler**

`package.json`: name `erp-functions`, `type: module`; dev dependencies `vitest`, `typescript`, `@types/node`; scripts `test` and `typecheck`. The handler builds the Hasura client from the environment, checks the webhook, then calls `runLeaseDaily`.

- [ ] **Step 4: Run the test to verify it passes**

Run from `functions/`: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add functions/
git commit -m "feat(functions): daily lease job (expiry and notifications) with webhook check"
```

---

### Task 8: SMTP sender and the notification e-mail handler

**Files:**
- Create: `functions/lib/mailer.ts`, `functions/lib/mailer.test.ts`
- Create: `functions/lib/mail-templates.ts`
- Create: `functions/send-notification-email.ts`, `functions/send-notification-email.test.ts`
- Modify: `functions/package.json` (add `nodemailer`; dev `@types/nodemailer`)

**Interfaces:**
- `functions/lib/mailer.ts`: `createMailer(config: { host: string; port: number; user: string; password: string; from: string; transport?: { sendMail(message: object): Promise<unknown> } }): { send(message: { to: string; subject: string; text: string }): Promise<void> }`. Uses nodemailer; port 465 is implicit TLS, otherwise STARTTLS. `transport` is injected in tests.
- `functions/lib/mail-templates.ts`: `notificationMail(n: { title: string; body: string | null; link: string | null }): { subject: string; text: string }` and `appointmentMail(kind: 'invitation' | 'update' | 'cancellation', a: { title: string; kind: string; startsAt: string; endsAt: string; location: string | null }): { subject: string; text: string }`. French text; times formatted with `Intl.DateTimeFormat('fr-TN', { timeZone: 'Africa/Tunis', dateStyle: 'full', timeStyle: 'short' })`.
- `functions/send-notification-email.ts`: default `handler(request)`. Returns 401 when the webhook check fails. Reads `event.data.new` (the notification). Loads the recipient's e-mail from `staff_members` by `user_id`. Sends one message. On success writes `emailed_at = now()`. On failure writes `email_error` (the message, at most 500 characters) and still returns 200, so a mail problem never blocks. A row that already has `emailed_at` is skipped, which makes Nhost's retries harmless.

Environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, plus the Hasura variables. A missing SMTP variable returns 500 naming the variable (never its value).

- [ ] **Step 1: Write the failing tests**

- `mailer.test.ts`: `send` passes `from`, `to`, `subject` and `text` to the injected transport; a transport rejection rejects `send`.
- `send-notification-email.test.ts`, with a fake Hasura and a fake mailer: a notification with `emailed_at` already set sends nothing; a send failure writes `email_error` and returns 200; a recipient without an e-mail address writes `email_error = 'destinataire sans e-mail'` and sends nothing; success writes `emailed_at`; the French subject contains the notification title.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `functions/`: `npx vitest run`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement**

Run from `functions/`: `npm install nodemailer && npm install -D @types/nodemailer`. The handler delegates to `loadRecipient`, `mailer.send` and `markNotification`, and stays under 60 lines.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `functions/`: `npx vitest run && npx tsc --noEmit`
Expected: all pass; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add functions/
git commit -m "feat(functions): SMTP sender and notification e-mail handler"
```

---

### Task 9: Appointment e-mail handler (invitation, update, cancellation, Renvoyer)

**Files:**
- Create: `functions/send-appointment-email.ts`, `functions/send-appointment-email.test.ts`

**Interfaces:**
- Consumes: `createMailer`, `appointmentMail`, `createHasuraClient`, `isAuthorizedWebhook` (Tasks 7–8).
- Produces: default `handler(request)`. Reads the Nhost event: `event.op` (`INSERT` or `UPDATE`), `event.data.new`, `event.data.old`, and `table.name` (`appointments` or `appointment_participants`).
- Pure decision functions, unit-tested directly:
  - `decideParticipantAction(event): 'invite' | 'skip' | 'none'`
  - `decideAppointmentAction(event): 'cancel' | 'update' | 'none'`

Rules:
- Participant insert: `invite` when the appointment has `notify_by_email = true`, `status = 'planned'`, and the contact has an e-mail address (read through Hasura). `skip` otherwise: the participant's `email_status` becomes `skipped`.
- Participant update where `email_status` changes to `pending` (Renvoyer, R6): `invite`, same conditions.
- Participant row whose `email_status` is already `sent`: `none` (Review Focus 3, a retried insert sends nothing).
- Appointment update: `cancel` when `status` changed to `cancelled`; `update` when `starts_at`, `ends_at` or `location` changed and `status` is `planned`; `none` otherwise (a change to `notes` alone sends nothing).
- For `cancel` and `update`, send to participants with an e-mail address and `email_status` not `skipped`, when `notify_by_email` is true. Each participant's `email_status` becomes `sent`, or `failed` with `email_error`; a participant without an address becomes `skipped`.
- A missing webhook secret returns 401. An SMTP error marks that participant `failed` and still returns 200.

- [ ] **Step 1: Write the failing tests**

Cover, with fakes: invitation to a participant with an e-mail address; `skipped` for a participant without one (Review Focus 4); a retried insert whose row is already `sent` sends nothing (Review Focus 3); Renvoyer sends again; cancellation to all participants when the status becomes `cancelled`; no send when only `notes` changed; SMTP failure writes `failed` and returns 200.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `functions/`: `npx vitest run`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

Keep the two decision functions pure. The handler applies each decision through Hasura and the mailer.

- [ ] **Step 4: Run the tests to verify they pass**

Run from `functions/`: `npx vitest run && npx tsc --noEmit`
Expected: all pass; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add functions/send-appointment-email.ts functions/send-appointment-email.test.ts
git commit -m "feat(functions): appointment invitation, update, cancellation and resend e-mail"
```

---

### Task 10: Web — pure calendar and appointment logic, dependencies

**Files:**
- Modify: `web/package.json` (add `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/list`, `@fullcalendar/interaction`, all version 6)
- Create: `web/src/lib/appointment-types.ts`
- Create: `web/src/lib/appointments.ts`, `web/src/lib/appointments.test.ts`
- Create: `web/src/lib/calendar.ts`, `web/src/lib/calendar.test.ts`
- Create: `web/src/lib/notifications.ts`, `web/src/lib/notifications.test.ts`

**Interfaces:**
- `appointment-types.ts`: `AppointmentKind`, `AppointmentStatus`, `ParticipantRole`, `EmailStatus`, `NotificationKind` (string unions matching the SQL checks), and `FeedRow` (the `calendar_feed` columns as returned by GraphQL, with `startsAt`/`endsAt` as ISO strings).
- `appointments.ts`:
  - `APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string>`: viewing « Visite », move_in « État des lieux d'entrée », move_out « État des lieux de sortie », meeting « Rendez-vous », other « Autre ».
  - `PARTICIPANT_ROLE_LABELS`, `APPOINTMENT_STATUS_LABELS` (planned « Prévu », done « Fait », cancelled « Annulé »).
  - `tunisToIso(date: string, time: string): string` → `${date}T${time}:00+01:00` (R7).
  - `isoToTunisParts(iso: string): { date: string; time: string }`: Tunis date and `HH:mm`.
  - `findStaffConflicts(candidate: { id?: string; assignedUserId: string | null; startsAt: string; endsAt: string }, others: { id: string; assignedUserId: string | null; startsAt: string; endsAt: string; status: AppointmentStatus }[]): string[]`: ids of planned appointments of the same staff member that overlap; cancelled and done are ignored; the candidate's own id is excluded.
  - `emailStatusLabel(status: EmailStatus): string`: sent « E-mail envoyé », failed « E-mail non envoyé · Renvoyer », skipped « Pas d'adresse e-mail », pending « En attente ».
- `calendar.ts`:
  - `filterFeed(rows: FeedRow[], filters: { kinds: string[]; contactId: string | null; staffId: string | null; branchId: string | null; includeCancelled: boolean }): FeedRow[]`. An empty filter value means no filter.
  - `toEventInput(row: FeedRow): { id: string; title: string; start: string; end: string; allDay: boolean; classNames: string[]; extendedProps: { source: string; kind: string; appointmentId: string | null; leaseId: string | null; unitId: string | null; status: string } }`. For all-day rows `start` and `end` are the Tunis midnights, `end` exclusive.
  - `calendarRangeQuery(from: string, to: string): { from: string; to: string }`: `from` at `T00:00:00+01:00`, `to` at `T23:59:59+01:00`.
- `notifications.ts`:
  - `NOTIFICATION_KIND_LABELS` for the six kinds.
  - `notificationHref(row: { link: string | null; leaseId: string | null; appointmentId: string | null }): string`: the stored `link` when set; else `/baux/{leaseId}`; else `/calendrier?rendezvous={appointmentId}`; else `/`.

- [ ] **Step 1: Install dependencies**

Run from `web/`: `npm install @fullcalendar/core@6 @fullcalendar/react@6 @fullcalendar/daygrid@6 @fullcalendar/timegrid@6 @fullcalendar/list@6 @fullcalendar/interaction@6`
Expected: installs without error.

- [ ] **Step 2: Write the failing tests**

Each function gets its cases in its test file. Required cases: `tunisToIso` then `isoToTunisParts` at 23:30 Tunis does not shift the day; `findStaffConflicts` ignores cancelled and self and reports only overlapping planned rows of the same staff member; `filterFeed` drops cancelled rows unless `includeCancelled`; `toEventInput` for a lease row gives `allDay: true` and `end` equal to the next Tunis midnight; `notificationHref` precedence.

- [ ] **Step 3: Run the tests to verify they fail**

Run from `web/`: `npx vitest run src/lib/appointments.test.ts src/lib/calendar.test.ts src/lib/notifications.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 4: Implement**

Pure functions only: no React, no fetch.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `web/`: `npx vitest run src/lib/ && npx tsc --noEmit`
Expected: all pass; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/appointment-types.ts web/src/lib/appointments.ts web/src/lib/appointments.test.ts web/src/lib/calendar.ts web/src/lib/calendar.test.ts web/src/lib/notifications.ts web/src/lib/notifications.test.ts
git commit -m "feat(web): appointment, calendar and notification logic with FullCalendar dependencies"
```

---

### Task 11: Calendar page `/calendrier` and the FullCalendar wrapper

**Files:**
- Create: `web/src/components/calendar/calendar-view.tsx` (the only file that imports `@fullcalendar/*`)
- Create: `web/src/components/calendar/calendar-filters.tsx`, `web/src/components/calendar/calendar-filters.test.tsx`
- Create: `web/src/app/(app)/calendrier/page.tsx`
- Modify: `web/src/lib/navigation.ts` (add « Calendrier », href `/calendrier`, under Pilotage)

**Interfaces:**
- `CalendarView` props: `{ events: EventInput[]; view: 'dayGridMonth' | 'timeGridWeek' | 'listWeek'; date: string; onViewChange(v); onDateChange(d: string); onEventClick(id: string); onSelectSlot(startIso: string) }`. Loaded by the page with `next/dynamic` and `ssr: false`, so the library is code-split. Locale `fr`, timezone `Africa/Tunis`, `firstDay: 1`.
- `CalendarFilters` props: `{ value: CalendarFilterState; staff: StaffOption[]; contacts: ContactOption[]; branches: BranchOption[]; onChange(next: CalendarFilterState) }`. `CalendarFilterState` = `{ kinds: string[]; contactId: string | null; staffId: string | null; branchId: string | null; includeCancelled: boolean }`.
- Page: loads `calendar_feed` for the visible range (`calendarRangeQuery`), plus `staff_members`, branches and contacts for the filters, through `useGraphql`. The view and date live in the query string (`?vue=semaine&date=2026-10-16`), so a reload keeps them. `?rendezvous=<id>` opens the detail sheet (Task 12).
- Empty state: « Aucun rendez-vous sur cette période. » The « + » button calls `onCreate`, which Task 12 wires; until then the button is present and disabled with a `title`.

- [ ] **Step 1: Write the failing test**

`calendar-filters.test.tsx` (Testing Library): choosing a staff member calls `onChange` with `staffId` set; the cancelled toggle flips `includeCancelled`. The FullCalendar wrapper is checked by the browser pass and by Task 14, not by jsdom.

- [ ] **Step 2: Run the test to verify it fails**

Run from `web/`: `npx vitest run src/components/calendar`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

The wrapper maps `onEventClick` from `info.event.id` and `onSelectSlot` from `info.startStr`. Plugins: `dayGridPlugin`, `timeGridPlugin`, `listPlugin`, `interactionPlugin`. Keep the wrapper under 150 lines and the page under 200.

- [ ] **Step 4: Verify**

Run from `web/`: `npx vitest run src/components/calendar && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass; `/calendrier` appears in the build output.

- [ ] **Step 5: Browser check, desktop and 375 px**

Start the app with `preview_start`. Open `/calendrier`; the month view renders; week and list views work. At 375 px (`resize_window` preset `mobile`, then `desktop`) the toolbar wraps and the page has no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/calendar web/src/app/\(app\)/calendrier web/src/lib/navigation.ts
git commit -m "feat(web): calendar page with FullCalendar wrapper and filters"
```

---

### Task 12: Appointment dialog, detail sheet, lease Calendrier tab and contact appointments

**Files:**
- Create: `web/src/components/calendar/appointment-dialog.tsx`, `web/src/components/calendar/appointment-dialog.test.tsx`
- Create: `web/src/components/calendar/appointment-sheet.tsx`
- Create: `web/src/components/calendar/appointment-mutations.ts`
- Create: `web/src/components/calendar/lease-calendar-tab.tsx`
- Create: `web/src/components/calendar/contact-appointments.tsx`
- Modify: `web/src/app/(app)/calendrier/page.tsx` (wire `onCreate`, `onSelectSlot`, the sheet)
- Modify: `web/src/app/(app)/baux/[id]/page.tsx` (add the « Calendrier » tab)
- Modify: `web/src/app/(app)/contacts/[id]/page.tsx` (replace the appointments placeholder with `ContactAppointments`)

**Interfaces:**
- `AppointmentDialog` props: `{ open; onOpenChange; initial?: { startsAt?: string; leaseId?: string; unitId?: string; kind?: AppointmentKind; participants?: ParticipantInput[] }; editingId?: string; existing: FeedRow[]; staff: StaffOption[]; contacts: ContactOption[]; onSaved(id: string) }`. Fields (React Hook Form and zod): kind, title, date, time, duration (default 60 min), place or unit, assigned staff (optional), participants (contact picker with a role select per row), « Prévenir par e-mail » (checked by default). `findStaffConflicts` output is shown as a non-blocking alert: « Ce collaborateur a déjà un rendez-vous à cette heure. ». The end must be after the start: « La date de fin doit suivre la date de début. ». Title required.
- `appointment-mutations.ts`: `insertAppointmentMutation` is one GraphQL request with two root fields, `insert_appointments_one` and `insert_appointment_participants`, with a client-generated UUID (the pattern of the Plan A lease create). `updateAppointmentMutation` updates the appointment and replaces its participants (delete, then insert) in one request. `resendParticipantMutation(appointmentId, contactId)` sets `email_status` to `pending` (Renvoyer).
- `AppointmentSheet` props: `{ appointmentId: string | null; onOpenChange; onEdit(id: string) }`. Shows participants with `emailStatusLabel`, a link to the lease, request or unit, and the actions « Marquer comme fait » (status `done`), « Annuler » (confirm dialog, status `cancelled`) and « Reporter » (opens the dialog in edit mode). Failures go through `showError` with « Réessayer ».
- `LeaseCalendarTab` props: `{ leaseId: string }`. Lists the lease's appointments and offers « Planifier un état des lieux », which opens the dialog with kind `move_in`, the lease, the first leased unit, and the renters as participants. The kind select in the dialog allows `move_out`.
- `ContactAppointments` props: `{ contactId: string }`. Upcoming and past appointments of the contact, from `calendar_feed` rows whose `contact_ids` include `contactId` (filtered with `filterFeed`).

- [ ] **Step 1: Write the failing tests**

`appointment-dialog.test.tsx`:
- submitting without a title shows the French title error and does not call `onSaved`;
- an end before the start shows « La date de fin doit suivre la date de début. »;
- a same-staff overlap shows the warning and still allows saving;
- the « Prévenir par e-mail » checkbox is checked by default.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `web/`: `npx vitest run src/components/calendar/appointment-dialog.test.tsx`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

Keep each component under 250 lines; move the form sections into `appointment-form-fields.tsx` if the dialog grows past that. Reuse `contact-picker.tsx` for participants, `confirm-dialog.tsx` for the cancellation, and `show-error.ts` for failures.

- [ ] **Step 4: Verify**

Run from `web/`: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Browser check, desktop and 375 px**

Create an appointment from `/calendrier` with a renter as participant. Open it in the sheet. On a participant with no e-mail address, the label « Pas d'adresse e-mail » shows. Mark it done. The contact page lists it. The lease fiche Calendrier tab lists it. Take a screenshot of each for the user.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/calendar web/src/app/\(app\)/calendrier web/src/app/\(app\)/baux web/src/app/\(app\)/contacts
git commit -m "feat(web): appointment dialog, detail sheet, lease calendar tab and contact appointments"
```

---

### Task 13: Notification bell and dashboard tile

**Files:**
- Create: `web/src/components/notifications/notification-bell.tsx`, `web/src/components/notifications/notification-bell.test.tsx`
- Create: `web/src/components/notifications/notification-mutations.ts`
- Modify: `web/src/components/app-header.tsx` (mount the bell in the topbar)
- Modify: `web/src/app/(app)/page.tsx` (tile « Rendez-vous aujourd'hui »; Plan A already has the « Baux à renouveler » and « Enregistrements à faire » tiles)

**Interfaces:**
- `NotificationBell`: no props. Reads the 20 most recent notifications of the current user (`notifications(order_by: {created_at: desc}, limit: 20)`) and the unread count (`notifications_aggregate` filtered on `read_at` null), through `useGraphql` with `reloadKey` changing every 60 s (no websocket). The dropdown lists each notification with its `NOTIFICATION_KIND_LABELS` label, title, time in Tunis, and a link from `notificationHref`. « Tout marquer comme lu » sets `read_at` on unread rows in one mutation (`update_notifications` with the `read_at` null filter).
- Dashboard tile: `appointments_today: calendar_feed_aggregate(where: {source: {_eq: "appointment"}, status: {_eq: "planned"}, starts_at: {_gte: $dayStart, _lt: $dayEnd}}) { aggregate { count } }`, with `$dayStart` and `$dayEnd` from `calendarRangeQuery(today, today)`. Links to `/calendrier`.

- [ ] **Step 1: Write the failing tests**

`notification-bell.test.tsx` (Testing Library, with `useGraphql` mocked): the badge shows the unread count; an empty list shows « Aucune notification. »; « Tout marquer comme lu » calls the mutation once; a row links to `notificationHref`.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `web/`: `npx vitest run src/components/notifications`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

Use the shadcn `DropdownMenu` already in `components/ui`. The bell is a client component; the header stays a shell.

- [ ] **Step 4: Verify**

Run from `web/`: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Browser check, desktop and 375 px**

Open the dashboard and check the bell badge and dropdown. Before the live seed is applied the list shows the empty state. Check the new tile links to `/calendrier`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/notifications web/src/components/app-header.tsx web/src/app/\(app\)/page.tsx
git commit -m "feat(web): notification bell and today's appointments tile"
```

---

### Task 14: E2E scenario and final verification

**Files:**
- Create: `web/e2e/calendar.spec.ts`
- Modify: `web/e2e/helpers.ts` only if an appointment helper is missing (add it; do not change existing helpers)

**Interfaces:**
- Consumes: the login and cleanup helpers of Plan A (`web/e2e/helpers.ts`).
- Produces: one Playwright scenario. Schedule a move-in on an active demo lease with the renter as participant; it shows in `/calendrier` week view; it appears on the contact page; cancel it; it disappears from the default filter and reappears with « Inclure les annulés ». The scenario cancels its own appointment at the end (spec section 10).

- [ ] **Step 1: Write the scenario**

Same structure as `web/e2e/leases.spec.ts`. Prefer roles and labels; add `data-testid` only where needed.

- [ ] **Step 2: Run the local suites (agent)**

Run from `web/`: `npx vitest run --coverage && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass; coverage on the new `lib/*.ts` files at least 80 %.

Run from `functions/`: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

Run from the repository root: `bash scripts/db-local.sh up && bash scripts/db-local.sh test db/tests/0003_leases.test.sql && bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql`
Expected: both print `OK: all …`.

Run from the repository root: `node scripts/apply-hasura-permissions.mjs --dry-run && node scripts/apply-hasura-triggers.mjs --dry-run`
Expected: both exit 0 with their summaries.

- [ ] **Step 3: Live steps (user only; the agent never types a secret)**

1. Nhost SQL console: run `db/migrations/0004_calendar_notifications.sql` (copied with `Get-Content -Raw -Encoding UTF8`), then `db/seeds/0004_demo_calendar.sql`.
2. Run `select user_id, role from public.staff_members;` and report the result (R2 check).
3. With `HASURA_ADMIN_SECRET` set: `node scripts/apply-hasura-permissions.mjs`, then `node scripts/check-hasura.mjs`.
4. In the Nhost dashboard, set the function secrets `HASURA_GRAPHQL_URL`, `HASURA_ADMIN_SECRET`, `NHOST_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Set `NHOST_FUNCTIONS_URL`, then run `node scripts/apply-hasura-triggers.mjs`.
5. The user decides when to push to GitHub (this deploys `functions/`).
6. From `web/`: `npm run test:e2e -- e2e/calendar.spec.ts` (credentials in `web/.env.test.local`; delete `web/test-results` afterwards).

- [ ] **Step 4: Commit**

```bash
git add web/e2e/calendar.spec.ts web/e2e/helpers.ts
git commit -m "test(e2e): calendar scenario (schedule, contact card, cancel, filter)"
```

---

## Self-review

- **Spec coverage:** section 3.1 `appointments`, `appointment_participants`, `notifications`, `calendar_feed`, `staff_members` → Tasks 1–2; `generate_daily_notifications` and thresholds → Task 3; section 5 functions and triggers → Tasks 6–9; section 6 permissions → Task 5; section 7 `/calendrier`, lease Calendrier tab, contact appointments, bell, dashboard tile → Tasks 11–13; section 8 wrapper → Task 11; section 9 non-blocking e-mail and « Renvoyer » → Tasks 9 and 12; section 10 tests → Tasks 1–3, 7–10, 14; section 11 slice 1 steps 4–5 → Tasks 1–14.
- **Not in this plan (by design):** rent requests (`rent_request_id`, `rent_requests`, matching, conversion) → Plan C; inspections and deposit → Plan D; the `/baux/demandes` page → Plan C.
- **Consistency:** `calendar_feed` columns (Task 2) match the GraphQL fields used in Tasks 10–13; `findStaffConflicts`, `filterFeed` and `toEventInput` are named identically across Tasks 10–12; `email_status` values (`pending | sent | failed | skipped`) match Tasks 1, 9 and 12.
- **Placeholders:** none intended; each task names its files, interfaces and verification command with the expected output.
