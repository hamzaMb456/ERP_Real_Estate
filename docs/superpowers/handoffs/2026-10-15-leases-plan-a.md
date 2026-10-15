# Handoff — Project 2, Plan A (core leases)

Date: 2026-10-15 · Branch: `claude/continuation-bdded2` (worktree `.claude/worktrees/continuation-bdded2`, not pushed)
Plan: `docs/superpowers/plans/2026-10-15-leases-core.md` · Spec: `docs/superpowers/specs/2026-10-15-leases-design.md`

## What is built (Tasks 0–15, all committed)

| Task | Deliverable |
|---|---|
| 0 | Vitest repaired on Windows (see « Vitest fix » below) |
| 1 | Spec amendments (migration split, four insert fields, webhook secret, `staff_members` view) |
| 2 | `dates.ts` (`todayTunis`, `addDays`, `daysBetween`), `errors.ts` lease codes, `show-error.ts` (« Réessayer ») |
| 3–5 | Migration `0003_leases.sql`: tables, triggers, `activate_lease` / `renew_lease` / `end_lease` / `change_rent` / `expire_overdue_leases`, views `current_lease_rents`, `lease_overview`, `unit_current_lease`; SQL tests 1–23; local Docker harness `scripts/db-local.sh` |
| 6 | `scripts/apply-hasura-permissions.mjs` extended (15 tables/views, 40 relationships, 137 permissions, 5 functions), `scripts/check-hasura.mjs` |
| 7 | Demo seed `db/seeds/0003_demo_leases.sql`; database review fixes (tests 16–23) |
| 8–10 | `lease-types.ts`, `leases.ts`, list page `/baux`, form `/baux/nouveau` and `/baux/[id]/modifier` |
| 11 | Fiche `/baux/[id]`: activate, renew, end, archive, registration, terms timeline, overview |
| 12 | Rents tab and « Changer le loyer » |
| 13 | Documents tab (bucket `lease-files`) |
| 14 | « Bail en cours » card on the unit page, lease cards on the contact page, dashboard tiles, deep-linkable tabs (`/baux#renew`) |
| 15 | `web/e2e/helpers.ts`, `web/e2e/leases.spec.ts`, whole-project checks |

## Verified locally (this session)

- `npx tsc --noEmit`, `npm run lint`: clean.
- `npm test`: 20 files, 157 tests pass. `npm run test:coverage`: 98.5 % statements, 96 % branches (threshold 80 %).
- `npm run build`: succeeds, routes `/baux`, `/baux/[id]`, `/baux/[id]/modifier`, `/baux/nouveau` present.
- Local Postgres: `OK: all lease tests passed` and `OK: all core-records tests passed`.

## NOT verified yet: needs the live Nhost database (user steps, the agent never types the admin secret)

1. Nhost SQL editor: run `db/migrations/0003_leases.sql` (ASCII only; copy with `Get-Content -Raw -Encoding UTF8`), tick « Track this » off.
2. Run `db/tests/0003_leases.test.sql` → expect `OK: all lease tests passed`.
3. Run `db/seeds/0003_demo_leases.sql`.
4. From the worktree, with `$env:HASURA_ADMIN_SECRET` set: `node scripts/apply-hasura-permissions.mjs`, then `node scripts/check-hasura.mjs`.
5. Assumption to check: Hasura's database role is `nhost_hasura`. If lease mutations fail with « permission denied for function », grant `EXECUTE` on the lease functions to the role Hasura really uses (one `GRANT`).
6. Then, from `web/`: `npm run test:e2e -- e2e/leases.spec.ts` and `npm run test:e2e -- e2e/core-records.spec.ts` (credentials in `web/.env.test.local`; delete `web/test-results` afterwards, snapshots contain typed credentials). Expect 1 passed each.
7. Browser pass of every new page (plan Task 15 step 5): `/baux`, `/baux/nouveau`, `/baux/<id>` (three tabs, each header action), `/baux/<id>/modifier`, unit page, contact page, dashboard tiles, desktop and 375 px.

## Still to do on the lease side

- **Daily expiry.** `expire_overdue_leases` exists and is admin-only, but nothing calls it yet: Plan B deploys the Nhost function. Until then, expired leases are not auto-expired (run it by hand with the admin secret).

## Vitest fix (Task 0)

Vitest 4 would not start on this machine (rolldown native binding missing). Fix, no tracked change: from `web/`, `npm install --no-save @rolldown/binding-win32-x64-msvc@1.2.14`. A later `npm install` can remove it; rerun the command.

## Deferred (not fixed on purpose)

- Branch filter on the lease list.
- Database review MEDIUM/minor items left open: `renew_lease` with a duplicate `unit_id` in `p_rents` surfaces the raw unique violation; migration `create` statements are not idempotent (applied once); `search_path` could be `pg_catalog, public, pg_temp`.
- « Réessayer » (`showError`) is used by the lease pages only; the Project 1 pages still use plain toasts.

## Next step

Write **Plan B** (migration `0004`: calendar `appointments`, `notifications`, `calendar_feed`, `staff_members`; the daily Nhost function for expiry, reminders and Google e-mail; FullCalendar), against the real interfaces built here. Ask the user before starting. Plans C (rent requests, `0005`) and D (inspections and deposit, `0006`) follow.

## Final review (done)

An independent review of the whole branch found 0 Critical, 3 Important (fixed, each test first) and 10 Minor (deferred, listed below).

Fixed: a lease activated for a future start can now be cancelled (`end_lease` accepts an end date from the start date when the lease has not started; the dialog follows); an active lease past its grace week now shows « Échu · à terminer », stays in « À renouveler » and counts in the dashboard tile; `/baux/demandes` (sidebar) is a fixed placeholder route again.

If `0003_leases.sql` was applied to the live database BEFORE this fix, re-run only the `create or replace function public.end_lease(...)` block of the file (it is idempotent); the rest is unchanged.

Deferred minors: « 1.250 » typed for 1 250 TND reads as 1.250; the edit route `/baux/[id]/modifier` is not gated by `useCanEdit`; document dates use the UTC day; errcodes 42501/P0002 may show English « database query error » for stale ids; the rents tab shows « renewal » in English; the grace-week renewal message omits the « after today » rule; an active lease's occupied period ends at `end_date` (not at the end of grace); the form cannot prepare a back-to-back lease on a rented unit; lock order between the daily expiry and staff actions (add `order by unit_id` in `leases_sync_units`); a future registration date is accepted; a lease cancelled before it started keeps its start day occupied.
