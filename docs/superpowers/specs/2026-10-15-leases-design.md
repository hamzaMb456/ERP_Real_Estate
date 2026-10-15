# Project 2 — Leases (Baux), rent requests, inspections, deposit, calendar (design)

Date: 2026-10-15 · Branch: `claude/continuation-bdded2` · Depends on: Project 1 (core records)
Sources: `docs/reference/05-scope-matrix.md` §4.5, UML "Renters and leases" (buttons 1–31),
glossary (Lease, Renter, Guarantor, Rent Request, Security Deposit), Stitch pages 3–6.

## 1. Goals

Staff record who rents which unit, on what terms, and follow the lease through its life. The unit
status then follows the lease. Around the lease:

- **Core lease:** several renters and guarantors per lease, one lease for several units, dates, payment
  day, deposit amount, fixed recoverable charges, rent changes with history, renewal, end, expiry,
  signed documents, registration at the tax office, "ending soon" follow-up.
- **Rent requests (Demandes de location):** record people who want to rent, their needs, viewings,
  match them to free units, turn a request into a renter and a lease.
- **Move-in / move-out checks** with photos and a comparison.
- **Deposit:** money received, deductions, refund, balance.
- **Calendar and scheduling:** one shared calendar with appointments that have participants
  (renters, guarantors, prospects, buyers) and a staff member in charge.
- **Reminders:** bell notifications, dashboard tiles and email (Google SMTP) for leases ending
  soon, the grace week, registration deadlines and appointments.

Success: every Stitch lease page works on live data, a lease can go draft → active → renewed → ended
with the unit status following, all four extras work, the calendar shows leases and appointments,
and the daily job expires overdue leases and sends reminders.

Not in this project (Finance, per the roadmap): rent invoices and generation, payments, receipts,
arrears. The lease stores what Finance needs later: payment day, rent and charges by effective date,
deposit amount and movements.

## 2. Decisions (with the reason)

| # | Decision | Reason |
|---|---|---|
| D1 | All four extras are in: rent requests, registration tracking, move-in/out checks, deposit return. | User choice. Matrix puts checks in V1 and deposits in Finance; they are done here by decision. |
| D2 | Rent requests are built for staff entry now (D-010: no external login). The table has a `source` column and no login dependency. | A client-facing site (e-commerce view) will feed requests later without a redesign. |
| D3 | A lease past its end date **stays active for a 7-day grace**, shown « Échu · à renouveler ». On day 8 a daily job sets it `expired` and frees the unit. | Never frees a unit someone may still occupy, but cannot stay stale forever. |
| D4 | Renewal **extends the same lease**: the end date moves and a `lease_terms` row logs the term (optionally with a new rent). | User choice; no copying of parties and units. |
| D5 | Registration warning only in the **last 10 days** before the 60-day deadline, and when overdue. Deadline = signed date + 60 days (to confirm with the accountant). | User choice; the legal rule is in the Regulatory & Legal Register. |
| D6 | Rules and every multi-step action live in Postgres (constraints, triggers, SQL functions). Nhost functions are used only for the daily job and email. | Latency (one call, no cold start), consistency, no deploy needed for normal use. |
| D7 | Derived values are views, not stored copies: current rent, deposit balance, ending soon, registration state, calendar feed, request matches. | Storage and no stale data. |
| D8 | Reminders: bell notifications + dashboard tiles + email. Email via Google SMTP; the credentials are Nhost secrets entered by the user. | User choice (Nhost email is paid). |
| D9 | One shared `appointments` table and one calendar component for all modules; lease-derived dates come from a view. | Other modules (maintenance, sales viewings, security) plug in later. |
| D10 | The day thresholds (grace 7, ending soon 60, registration 60, warning 10) are defined once in the SQL function `lease_rule(name)`. Views return ready-made flags; the web never recomputes them. | One source of truth. |
| D11 | The **lessor (bailleur)** shown on a lease is the unit's current owner from Project 1 (`current_owners`), not a stored copy. | Ownership changes (a sale) must not rewrite leases. |
| D12 | Only draft leases can be archived. Active, ended and expired leases stay in history. | Same "no hard delete" rule as properties; keeps financial history. |
| D13 | A lease can be activated with a future start date; the unit becomes `rented` at activation (reserved), not on the start date. | No daily flip needed; staff activate when the lease is signed. |

## 3. Data model

Money is `numeric(12,3)` (TND). Every table has `organization_id` with composite foreign keys
`(id, organization_id)` as in Project 1. `updated_at` triggers as in Project 1. Migrations are applied by
the user in the Nhost SQL Console (clipboard, UTF-8) and reviewed by the `database-reviewer` agent.

Migrations are split by plan: `0003_leases.sql` (core: `lease_rule`, `today_tunis`, leases, units, parties,
rents, terms, files, guard triggers, unit-status sync, lease functions, views `lease_overview`,
`current_lease_rents`, `unit_current_lease`), `0004_calendar_notifications.sql` (appointments,
participants, notifications, `staff_members`, `calendar_feed`, `generate_daily_notifications`),
`0005_rent_requests.sql`, `0006_inspections_deposit.sql`. In section 3.1 the `appointments`,
`appointment_participants`, `notifications` and `calendar_feed` definitions belong to `0004`.

### 3.1 Migration `0003_leases.sql` (Plan A: core leases)

**`lease_rule(name text) returns integer`** (immutable): `grace_days` 7, `ending_soon_days` 60,
`registration_days` 60, `registration_warning_days` 10. Also `today_tunis()` returning
`(now() at time zone 'Africa/Tunis')::date`; all "today" logic uses it.

**`leases`**
- `number integer` — per organization, assigned by trigger under an advisory lock; shown « Bail N° 12 ».
- `status text` in `draft | active | ended | expired`, default `draft`.
- `start_date date`, `end_date date` (current term bounds), check `end_date > start_date`.
- `payment_day smallint` 1–28, default 1 (monthly rent only).
- `deposit_amount numeric(12,3)` ≥ 0, default 0 (agreed amount).
- `signed_at date`, `registered_at date`, `registration_receipt text`; check `registered_at >= signed_at`.
- `ended_on date`, `end_reason text` in `term_reached | terminated_by_renter | terminated_by_owner |
  expired_auto | other`.
- `archived_at`, timestamps. `unique (organization_id, number)`.

**`lease_units`** `(lease_id, unit_id)` primary key; composite foreign keys to `leases` and `units`.
Units can be added or removed only while the lease is a draft.

**Overlap rule** (trigger `check_lease_overlap`, advisory lock per unit, like ownership shares): a unit
cannot be on two leases of status `active`, `ended` or `expired` whose occupied periods overlap. The
occupied period is `[start_date, coalesce(ended_on, end_date)]`. Drafts reserve nothing; the check runs
at activation and at renewal (units cannot change on a non-draft lease).

**`lease_parties`** `(lease_id, contact_id)` primary key, `role` in `renter | guarantor`. A contact has
one role per lease. Trigger `ensure_renter_role` adds `contact_roles(renter)` when someone is added as
renter (same pattern as `ensure_owner_role`).

**`lease_rents`** — `id`, `lease_id`, `unit_id`, `effective_from date`, `rent_amount`, `charges_amount`
(fixed recoverable charges, default 0), `reason`. `unique (lease_id, unit_id, effective_from)`,
`effective_from >= lease start_date`. The first row (effective at the start date) is created with the
lease. Current rent = the latest row with `effective_from <= today_tunis()`; a future row is a scheduled
change. This table is the history Finance reads later.

**`lease_terms`** — `id`, `lease_id`, `kind` in `initial | renewal`, `start_date`, `end_date`,
`recorded_on`, `note`. The initial row is created at activation; `renew_lease` adds a row and moves
`leases.end_date`.

**`lease_files`** — mirrors `property_files`: `lease_id`, `storage_file_id` (unique, to `storage.files`),
`category` in `signed_lease | id_document | registration_receipt | inspection_report |
inspection_photo | other`, `title`. Trigger `check_lease_file_storage`: the file is in bucket
`lease-files` and was uploaded by the same user. Bucket `lease-files`: private, 10 MB, presigned URLs,
created by the migration.

**`appointments`** (shared)
- `kind` in `viewing | move_in | move_out | meeting | other`, `title`, `location`.
- `starts_at timestamptz`, `ends_at timestamptz`, check `ends_at > starts_at`.
- `status` in `planned | done | cancelled`, default `planned`.
- `assigned_user_id uuid` → `auth.users(id)` (staff in charge), `on delete set null`.
- `unit_id`, `lease_id` (nullable); `rent_request_id` added in 0004.
- `notify_by_email boolean` default true, `reminder_sent_at`, `notes`.

**`appointment_participants`** `(appointment_id, contact_id)` primary key, `role` in
`renter | guarantor | prospect | buyer | other`, `email_status` in `pending | sent | failed | skipped`,
`email_error`. A participant is always a contact; a prospect from a rent request is linked to a contact
when the viewing is scheduled (the contact is created without a role, with the Project 1 duplicate
warning).

**`notifications`** — one row per recipient: `user_id` (staff), `kind` in `lease_ending_soon |
lease_grace | lease_expired | registration_due | registration_overdue | appointment_reminder`, `title`,
`body`, `link`, `lease_id`, `appointment_id`, `dedupe_key`, `read_at`, `emailed_at`, `email_error`.
`unique (organization_id, user_id, dedupe_key)` makes the daily job idempotent. Rows older than 90 days
are deleted by the daily job.

**Unit status trigger** `sync_unit_status(unit_id)`, run after any change to a lease's status or units:
the unit becomes `rented` if an `active` lease covers it, otherwise `vacant`. It touches the status only
when it is currently `rented` or `vacant`; `for_sale`, `sold` and `under_maintenance` are never
overridden. The manual status correction on the unit page (Project 1) stays.

**Views** (select-only, tracked in Hasura, filtered by `organization_id`):
- `lease_overview` — lease, aggregated units and renters, current total rent and charges, and the flags:
  `is_ending_soon` (active, end within 60 days), `in_grace` (active, end date passed, within 7 days),
  `registration_deadline`, `registration_state` in `not_applicable | registered | pending | due_soon |
  overdue` (`due_soon` = within the last 10 days before the deadline).
- `current_lease_rents` — current and next rent per leased unit.
- `unit_current_lease` — the active lease on a unit.
- `calendar_feed` — appointments plus lease-derived all-day events (`lease_start`, `lease_end`,
  `registration_deadline` for unregistered active leases), with kind, lease, unit, status, assigned user.

### 3.2 Migration `0004_rent_requests.sql` (slice 2)

**`rent_requests`** — `full_name`, `phone`, `email`, `contact_id` (nullable until linked),
`source` in `staff | phone | walk_in | web` (default `staff`), `budget_max`, `rooms_min`, `unit_type`
(same values as units), `area` (free text matched on city, governorate, address), `move_in_date`,
`notes`, `status` in `open | converted | closed`, `closed_reason`, `converted_lease_id`,
`assigned_user_id`, `archived_at`. Also adds `appointments.rent_request_id`.

**View `rent_request_matches`** `(request_id, unit_id)` for open requests and vacant, unarchived units:
rent ≤ `budget_max` (when both set), rooms ≥ `rooms_min`, type equal (when set), area contained in the
property's city, governorate or address (when set). No scoring beyond "matches".

### 3.3 Migration `0005_inspections_deposit.sql` (slice 3)

**`inspections`** — `lease_id`, `unit_id`, `kind` in `move_in | move_out`, `inspected_on`, `notes`;
`unique (lease_id, unit_id, kind)`. **`inspection_items`** — `inspection_id`, `room`,
`condition` in `good | fair | damaged | missing`, `notes`, `position`. `lease_files` gains
`inspection_item_id` (photos). **View `inspection_comparison`**: items joined by `(lease, unit, room)`
with `condition_in`, `condition_out` and `changed`.

**`deposit_movements`** — `lease_id`, `kind` in `received | deduction | refund`, `amount > 0`,
`occurred_on`, `reason`, `note`. **View `deposit_balances`**: received − deductions − refunds per lease.
A trigger under an advisory lock per lease keeps the balance ≥ 0.

## 4. Actions (SQL functions, one atomic call each)

All are `SECURITY DEFINER`, `set search_path = public, pg_temp`, take the Hasura session
(`session_argument`) and check explicitly that the caller's organization owns the lease and that the
role is `org_admin` or `manager`. Exposed as Hasura mutations. Raised exceptions carry a stable code so
the web can map them to French messages (§9).

| Function | Does |
|---|---|
| `activate_lease(lease_id, signed_on)` | draft only; needs ≥ 1 renter, ≥ 1 unit, a first rent per unit; overlap check; sets `active`, `signed_at`, inserts the initial `lease_terms` row; syncs unit status. |
| `renew_lease(lease_id, new_end_date, rents jsonb, note)` | active (including the grace week) only; `new_end_date` after the current end; overlap check; inserts a `renewal` term row and moves `end_date`; optional new rents become `lease_rents` rows effective the day after the old end date. |
| `end_lease(lease_id, ended_on, reason)` | active only; sets `ended`, `ended_on`, `end_reason`; syncs unit status. The UI then offers the move-out check and the deposit refund. |
| `change_rent(lease_id, unit_id, effective_from, rent, charges, reason)` | adds a `lease_rents` row; date ≥ lease start. |
| `add_deposit_movement(...)` (0005) | `received` once the lease is active; `deduction` and `refund` only after it ended or expired; balance never below 0. |
| `convert_rent_request(request_id, contact_id, lease_id)` (0004) | open request and draft lease of the same organization; links the contact, adds the renter party and renter role, sets the request `converted` with `converted_lease_id`. |
| `expire_overdue_leases()` | **admin only** (no role permission): active leases with `end_date + grace_days < today_tunis()` become `expired` (`ended_on = end_date`, reason `expired_auto`); syncs unit status; returns the ids. |
| `generate_daily_notifications()` | **admin only**: inserts notifications (deduplicated) for ending soon, grace week, expired, registration due and overdue, and appointments planned for tomorrow; deletes notifications older than 90 days. |

**Creating a lease** is one GraphQL request with four insert fields (lease, units, parties, first rents)
that Hasura runs in order in one transaction (nested inserts are not used: the relationships are
manual, with composite keys). A draft is edited the same way: delete its units and parties, update the
lease, insert them again. **Converting a request** sends, in one request (Hasura runs the root fields of a mutation
in one transaction), the optional contact insert, the draft lease insert with client-generated UUIDs,
and `convert_rent_request`.

## 5. Daily job and email (Nhost functions)

New folder `functions/` at the repository root (TypeScript, deployed by Nhost when the user pushes to
GitHub — nothing is pushed without the user's decision).

- `functions/lease-daily.ts` — called by a Hasura **cron trigger** at 06:00 `Africa/Tunis`: runs
  `expire_overdue_leases` then `generate_daily_notifications` through Hasura with the admin secret from
  the function environment. It contains no business rules.
- `functions/send-notification-email.ts` — called by a Hasura **event trigger** on `notifications`
  insert: sends one email to the staff member and sets `emailed_at` or `email_error`.
- `functions/send-appointment-email.ts` — **event trigger** on `appointment_participants` insert and on
  `appointments` update of `starts_at`, `ends_at`, `location` or `status`: sends an invitation or an
  update (or a cancellation) to participants with an email when `notify_by_email` is on, and sets each
  participant's `email_status`.
- Event triggers retry 3 times (60 s apart). Handlers are idempotent and check the Nhost-provided
  `x-nhost-webhook-secret` header (value from `NHOST_WEBHOOK_SECRET`); requests without it get 401.
- Email: `nodemailer` over Google SMTP. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and
  `SMTP_FROM` are Nhost project secrets entered by the user in the Nhost dashboard;
  they are never in the repository or in chat. A Google account with an app password is required.
- Triggers are created by `scripts/apply-hasura-triggers.mjs` (admin secret from the environment, run by
  the user), through the Hasura metadata API, additively; Hasura metadata is never replaced wholesale.
- Staff list for "staff in charge" and notification recipients: users of the organization from
  `auth.users`, matched on `metadata.organization_id` (the claim source used for `X-Hasura-Org-Id`)
  with roles `org_admin` or `manager`. A `staff_members` view over `auth.users` (organization, user id,
  display name, email, role) is created in `0004` and tracked in Hasura.

## 6. Permissions (`scripts/apply-hasura-permissions.mjs`, additive)

- New tables and views: select for `org_admin`, `manager`, `viewer` filtered by
  `organization_id = X-Hasura-Org-Id`.
- Insert on `leases`, `lease_units`, `lease_parties`, `lease_rents`, `lease_files`, `appointments`,
  `appointment_participants`, `rent_requests`, `inspections`, `inspection_items`: `org_admin`, `manager`;
  `organization_id` set from the JWT on insert, never updatable. Leases are never deleted (drafts are
  archived). Delete is allowed only on `lease_units` and `lease_parties` of a draft lease (trigger-checked),
  on `lease_files`, `appointment_participants` and `inspection_items`.
- `leases` update: only editable columns (`payment_day`, `deposit_amount`, `registered_at`,
  `registration_receipt`, `signed_at` while draft, `start_date`/`end_date` while draft, `archived_at`
  for drafts). `status`, `ended_on`, `end_reason` and the dates of non-draft leases change only through
  the functions. `notifications`: users read and update only `read_at` on their own rows.
- `deposit_movements` and `lease_terms`: insert only through functions (no client insert permission).
- Functions `activate_lease`, `renew_lease`, `end_lease`, `change_rent`, `add_deposit_movement`,
  `convert_rent_request`: allowed for `org_admin`, `manager`. `expire_overdue_leases` and
  `generate_daily_notifications`: no role permission (admin secret only).
- Storage: bucket `lease-files`; `storage.files` insert for writers with `bucket_id = 'lease-files'`;
  select and delete for rows linked from `lease_files` in the user's organization (same manual
  relationship pattern as Project 1).
- Relationships: `leases.units`, `leases.parties`, `leases.rents`, `leases.terms`, `leases.files`,
  `leases.deposit_movements`, `leases.inspections`, `units.leases`, `units.current_lease`,
  `contacts.lease_parties`, `contacts.rent_requests`, `appointments.participants`,
  `contacts.appointment_participants`.

## 7. Pages (French UI, shadcn/ui, same shell as Project 1)

Navigation: « Locataires et baux » keeps `/baux` and `/baux/demandes`; a new « Calendrier »
(`/calendrier`) is added under Pilotage. The placeholder catch-all stops serving these routes.

- **`/baux`** — list (Stitch #3). Tabs: Tous / Actifs / Brouillons / À renouveler (ending soon or
  grace) / Terminés. Filters: search (renter, unit, number), branch. Columns: number, renters, units,
  period, total rent, status, registration badge. Reads `lease_overview`.
- **`/baux/nouveau`** — form (Stitch #5): vacant units (several), renters and guarantors with the contact
  picker (can create a contact, with the duplicate warning of Project 1), dates, payment day, rent and
  charges per unit (prefilled from the unit's rent), deposit amount. Saves a **draft**. Accepts
  `?demande=<id>` to prefill from a rent request.
- **`/baux/[id]`** — fiche du bail (Stitch #4). Header buttons by status: Activer (draft), Renouveler
  and Terminer (active), Archiver (draft). Tabs:
  - **Aperçu:** renter, unit and lessor (current owner) cards, terms timeline, registration card (state
    and deadline; the warning shows only in the 10-day window or when overdue), « Échu · à renouveler »
    banner during the grace week.
  - **Loyers:** history from `lease_rents`, « Changer le loyer » (effective date, rent, charges, reason).
  - **Dépôt** (slice 3): agreed amount, movements, balance, « Rendre le dépôt ».
  - **États des lieux** (slice 3): move-in and move-out per unit, items per room, photos, comparison.
  - **Documents:** upload by category (Project 1 uploader reused).
  - **Calendrier:** appointments of this lease, « Planifier un état des lieux ».
- **`/baux/demandes`** (slice 2) — list and form (Stitch #6): needs, status, source, assigned staff;
  detail with « Visites » (appointments), « Unités libres correspondantes » (from the match view),
  « Convertir en bail » (opens `/baux/nouveau?demande=<id>`), « Clôturer » with a reason.
- **`/calendrier`** (slice 1) — month, week and agenda views. Filters: type, person (contact), staff,
  branch. « + » opens the appointment dialog: kind, title, date and time, place or unit, staff in
  charge, participants (contact picker with role), « Prévenir par e-mail ». Clicking an event opens its
  detail (participants, link to the lease, request or unit, mark done, cancel, reschedule). A warning
  (not a block) appears when the same staff member has an overlapping appointment.
- **Existing pages:** contact page — the renter placeholder card becomes the real card (current and
  past leases, leases as guarantor, appointments, requests); unit page — « Bail actuel » card and the
  status note updated; dashboard — tiles « Baux à renouveler », « Enregistrements à faire (≤ 10 jours) »,
  « Rendez-vous aujourd'hui »; topbar bell — notifications dropdown with mark as read and links.

## 8. Calendar component

FullCalendar (`@fullcalendar/react`, day grid, time grid, list, French locale), loaded with a dynamic
import only on calendar surfaces so the rest of the app stays light. One wrapper module
(`web/src/components/calendar/`) turns `calendar_feed` rows and appointments into events and is the only
place that imports the library, so it can be swapped. Times are stored as `timestamptz` and displayed in
`Africa/Tunis`; derived lease dates are all-day events. Other modules reuse the wrapper later.

## 9. Errors

The shared mapper (`web/src/lib/errors.ts`) is extended with stable database error codes and gets the
« Réessayer » action on network and permission toasts (the item deferred from Project 1):

| Cause | Message |
|---|---|
| overlapping lease | « Cette unité est déjà louée sur cette période (bail N° …). » |
| activate without renter / unit / rent | « Ajoutez au moins un locataire avant d'activer le bail. » (and the unit / rent variants) |
| end ≤ start; renewal not after current end | « La date de fin doit suivre la date de début. » |
| deposit movement above balance | « Le montant dépasse le dépôt détenu (X TND). » |
| deposit deduction or refund while the lease is active | « Le dépôt ne peut être rendu qu'après la fin du bail. » |
| request already converted / closed | « Cette demande est déjà traitée. » |
| lease not in the right status | « Ce bail ne peut plus être modifié. » |
| permission / network | toast with « Réessayer »; form values kept |

Email problems never block an action: the notification or appointment is saved, the failure is stored
(`email_error`, `email_status = failed`) and shown as « E-mail non envoyé · Renvoyer ».

## 10. Testing

- **Database** — `db/tests/0003_leases.test.sql`, `0004_*`, `0005_*`, each in a rolled-back transaction:
  overlap, activation rules, unit-status sync (`for_sale` untouched; ending one of two active leases keeps
  `rented`), renewal, current and future rent, deposit never below 0, registration deadline and the
  10-day window, grace boundary (day 7 stays active, day 8 expires), request matching, atomic
  conversion, notification idempotency, appointment constraints, session checks of the `SECURITY DEFINER`
  functions (wrong organization, wrong role). Cross-organization isolation through Hasura in E2E.
- **Unit (Vitest)** — Tunis-time date maths, error mapper, calendar event mapping, email templates,
  function handlers with a fake SMTP and fake Hasura.
- **Components (Testing Library)** — lease form, activate and end dialogs, rent change, deposit,
  inspection comparison, calendar filters and appointment dialog.
- **E2E (Playwright)** — draft lease on 2 units with a renter and a guarantor → activate → unit shows
  rented → future rent change → renew → schedule a move-in with the renter as participant → it shows in
  the calendar and on the contact page → end lease → unit vacant → refund deposit; and rent request →
  viewing → convert to lease. Test records archive or end themselves at the end.
- Coverage ≥ 80 % on new logic; browser check of each page at desktop and 375 px. One manual real-email
  check by the user once the SMTP secrets are set.
- **Step 0:** repair Vitest first (the `rolldown` native binding is missing in the worktree).

## 11. Build order and user steps

0. Repair Vitest; extend the error mapper; add the « Réessayer » action.
1. **Slice 1 — core leases** (`0003_leases.sql`):
   1. Migration, DB tests, permissions, seed `db/seeds/0003_demo_leases.sql` (leases in every state,
      one in grace, one with registration due, appointments).
   2. Lease list, create-draft and fiche; activate and end; unit-status sync; unit and contact cards.
   3. Rent changes, renewal, registration tracking, documents.
   4. Appointments, calendar page and component, participants.
   5. Notifications, bell, dashboard tiles, daily function, emails.
2. **Slice 2 — rent requests** (`0004`): pages, viewings through appointments, matching, conversion.
3. **Slice 3 — inspections and deposit** (`0005`): checks with photos and comparison, deposit movements
   and refund.

Each slice is usable and verified on its own. Steps done by the user, as in Project 1: run SQL in the
Nhost SQL Console (clipboard copied with `-Encoding UTF8`); run the permissions and triggers scripts
with the admin secret; enter the SMTP secrets in the Nhost dashboard; decide when to push to GitHub
(deploys the functions).

## 12. Assumptions to confirm

- Registration deadline = signed date + 60 days (confirm with the accountant; changing it is one value
  in `lease_rule`).
- Staff members can be read from `auth.users` metadata through Hasura (verified in plan step 1).
- A Google account with an app password is available for SMTP; daily sending limits of the account
  apply.

## 13. Out of scope

Rent invoices, generation, payments and receipts (Finance); automatic rent revision, late fees,
renter and owner portals, structured recoverable-charge reconciliation (V1/V2); Google Calendar sync.
Not in this project yet: lease notes, merging renters, Excel export, items left by a renter, printing a
lease, free-form email to a renter from the ERP.
