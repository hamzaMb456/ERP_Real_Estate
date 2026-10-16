# Handoff — Project 2, Plan B (calendar, notifications, daily job, e-mail)

Date: 2026-10-16 · Branch: `claude/project-3-2c84b8` (worktree `.claude/worktrees/project-3-2c84b8`, not pushed)
Plan: `docs/superpowers/plans/2026-10-16-leases-calendar-notifications.md` · Spec: `docs/superpowers/specs/2026-10-15-leases-design.md`

## What is built (Tasks 1–14, all committed, plus the review fix pass)

| Task | Deliverable |
|---|---|
| 1–3 | Migration `0004_calendar_notifications.sql`: `appointments`, `appointment_participants`, `notifications`; views `staff_members`, `calendar_feed`; `generate_daily_notifications()` (returns the inserted rows); `lease_rule` gains `expired_notice_days` 7 and `notification_retention_days` 90; trigger that drops stale reminders; SQL tests `db/tests/0004_calendar_notifications.test.sql` |
| 4 | Demo seed `db/seeds/0004_demo_calendar.sql` (6 appointments, one cancelled, one failed e-mail, a prospect without e-mail) |
| 5–6 | `scripts/apply-hasura-permissions.mjs` (20 tracked, 50 relationships, 165 permissions, 6 functions), `scripts/apply-hasura-triggers.mjs` (1 cron + 3 event triggers) |
| 7–9 | `functions/`: `lease-daily.ts`, `send-notification-email.ts`, `send-appointment-email.ts`, shared code in `functions/_lib/`, tests in `functions/_tests/` (93 tests) |
| 10–13 | `/calendrier` (FullCalendar), appointment dialog and sheet, lease « Calendrier » tab, contact « Rendez-vous » card, notification bell, dashboard tile « Rendez-vous aujourd’hui » |
| 14 | `web/e2e/calendar.spec.ts` (written, not run) |
| Fix pass | An independent review found 1 Critical + 7 Important; all fixed test-first (commits `5fb0040`, `e43bc95`, `15e5770`) |

## Verified locally

- `web`: 238 tests, `tsc`, `lint`, `build` (route `/calendrier`). `functions`: 93 tests, `tsc`. Local Postgres: `OK: all core-records tests passed`, `OK: all lease tests passed`, `OK: all calendar tests passed`. Both Hasura scripts `--dry-run` OK.
- NOT verified: anything against the live Nhost project, a logged-in browser (desktop and 375 px), real SMTP.

## User steps, in this order (the agent never types a secret)

0. Finish the Plan A live steps first (`docs/superpowers/handoffs/2026-10-15-leases-plan-a.md`, steps 1–7): `0004` builds on `0003`.
1. Nhost SQL console: run `db/migrations/0004_calendar_notifications.sql` (copy with `Get-Content -Raw -Encoding UTF8`, « Track this » off), then `db/tests/0004_calendar_notifications.test.sql` → expect `OK: all calendar tests passed`, then `db/seeds/0004_demo_calendar.sql`.
2. **Check ruling R2:** `select user_id, organization_id, role from public.staff_members;` must list your org_admin / manager users. If it is empty, tell the agent: the staff source (`auth.user_roles` + `auth.users.metadata->>'organization_id'`) is wrong and `staff_members` must change before anything else works.
3. With `$env:HASURA_ADMIN_SECRET` set: `node scripts/apply-hasura-permissions.mjs`, then `node scripts/check-hasura.mjs` (expect the 5 new names tracked, `generate_daily_notifications` tracked, no inconsistent metadata).
4. Nhost dashboard: secrets for the functions `HASURA_GRAPHQL_URL`, `HASURA_ADMIN_SECRET`, `NHOST_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, optionally `APP_URL` (links in e-mails). Hasura needs `NHOST_FUNCTIONS_URL` and `NHOST_WEBHOOK_SECRET` in its own environment (the trigger script resolves them there; the secret is never written to the metadata). Google SMTP needs an app password.
5. You decide when to push to GitHub: that deploys `functions/`. Then `node scripts/apply-hasura-triggers.mjs`. Hasura cron runs in UTC: `0 5 * * *` = 06:00 Tunis (no daylight saving time).
6. From `web/`: `npm run test:e2e -- e2e/calendar.spec.ts` and `leases.spec.ts` (credentials in `web/.env.test.local`; delete `web/test-results` afterwards).
7. Browser pass: `/calendrier` (month / week / list, filters, « + », the sheet, Reporter, Annuler), a lease fiche → « Calendrier », a contact page, the bell, the dashboard tile; desktop and 375 px. Also confirm the URL keeps `?vue=…&date=…` on reload (`history.replaceState` vs `useSearchParams` in this Next version).
8. One real e-mail check: create an appointment with a participant whose e-mail is yours.

## Things to know

- Rulings R1–R8 are at the top of the plan. R1: the spec called `0004` both « calendar » and « rent requests »; `0004` is calendar, rent requests will be `0005` and add `appointments.rent_request_id`, inspections and deposit `0006`.
- Notification titles in the database are ASCII (`Bail 12`, or the appointment title); the French wording comes from the kind (`web/src/lib/notifications.ts`, `functions/_lib/mail-templates.ts`).
- FullCalendar runs with `timeZone: 'UTC'` and timed events are shifted to Tunis wall clock (Tunisia is UTC+1 with no DST).
- Nhost deploys every file under `functions/` as an endpoint except names starting with `_`, hence `_lib/` and `_tests/`.
- `generate_daily_notifications` and `expire_overdue_leases` have no role permission: only the admin secret (the daily job) can call them.

## Deferred minors (not fixed on purpose)

Role change on a participant re-sends the invitation; reminders and lease notifications carry no date/time in the bell and e-mail; `appointment_staff_invalid` is not mapped to French; the staff-conflict warning only sees the visible range and the feed is capped at 1000 rows; an appointment created after 06:00 for the next day gets no reminder; the dialog text mentions a status field that does not exist; the E2E spec invites a demo address (switch it to the prospect without e-mail before SMTP goes live); a transient SMTP failure on a staff e-mail is not retried or shown in the UI.

## Next step

Plan C (rent requests, migration `0005`, `/baux/demandes`, `appointments.rent_request_id`), then Plan D (inspections and deposit, `0006`). Ask the user before starting each.
