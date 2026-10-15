# Handoff — Project 1 "Core records" (2026-10-14)

Read this first in a new session. Branch `claude/continuation-bdded2`
(worktree `.claude/worktrees/continuation-bdded2`). Not pushed.

## Where things are

- Spec: `docs/superpowers/specs/2026-10-14-core-records-design.md`
- Plan (15 tasks): `docs/superpowers/plans/2026-10-14-core-records.md`
- Roadmap: Project 1 core records → Project 2 leases (Baux) → Project 3 sales (Ventes).
  When Project 1 is finished, **ask the user whether to start Project 2**.

## Done

- All 15 plan tasks coded: ownership on units (shares, dates, transfer, co-owners, the
  organization as its own owner), edit forms for biens/units/contacts, contact archive +
  duplicate warning, photos/documents (bucket `property-files`), map (Leaflet + OSM,
  Nominatim search), common areas + thousandths, "Fiches incomplètes" page, dashboard tile.
- Unit/component tests: `cd web && npm test` → 63 passing; coverage gate ≥ 80 % met
  (`npm run test:coverage`). Lint and build clean.
- Final whole-branch review done; 6 findings fixed, 5 minors deferred (below).
- **Live Nhost project** (`rxcugiymqkyghsuixmhi`):
  - `db/migrations/0002_core_records.sql` applied (after renaming a clashing constraint to
    `property_files_category_matches_kind`).
  - `db/tests/0002_core_records.test.sql` → `OK: all core-records tests passed`.
  - `scripts/apply-hasura-permissions.mjs` → 23 relationships, 82 permissions.
  - `scripts/check-hasura.mjs` → 6/6 new tables/views tracked, manager can query them.

## Not done yet (next session, in this order)

1. **Demo data probably not applied**: the check showed B-101 `common_share = null`
   (seed sets 221). Re-run `db/seeds/0002_demo_core_records.sql` in the Nhost SQL Console
   (safe to re-run).
2. **Browser test of every page** (user signed in at http://localhost:3000, role manager):
   dashboard tile, `/biens` (owner column/filter, cover photo, "Carte"), bien tabs
   (Aperçu with owners + mini map, Unités with bulk owner, Photos, Documents, Parties
   communes), bien edit + map pin search, unit tabs (Propriétaires: transfer, co-owner,
   cancel upcoming transfer; `#modifier` dialog), contacts (edit, duplicate warning on
   phone `20 000 001`, archive, owned units), `/biens/carte`, `/biens/parties-communes`,
   `/biens/fiches-incompletes`. Check desktop + 375 px mobile, no console errors.
   Confirm live: first photo upload works (hasura-storage + storage.files permissions),
   and a transfer above 100 % shows the French message.
3. **E2E**: user writes `web/.env.test.local` with `E2E_EMAIL` / `E2E_PASSWORD`
   (never typed by the agent), then `cd web && npm run test:e2e`.
4. Fix anything found (test first), then ask the user whether to start Project 2.

## How things are applied (user runs; agent never types secrets)

- SQL: Nhost dashboard → Database → SQL Console. The agent can put a file in the user's
  clipboard: `Get-Content -Raw -Encoding UTF8 <file> | Set-Clipboard` (PowerShell 5.1 — without
  `-Encoding UTF8` accents turn into mojibake, e.g. "intÃ©rieur").
- Metadata: `$env:HASURA_ADMIN_SECRET = "<secret>"` then
  `node <worktree>\scripts\apply-hasura-permissions.mjs`, check with `scripts\check-hasura.mjs`.
  Run them by full path from the worktree — the main checkout has older copies until merged.
- The admin secret was pasted into chat once; the user chose to keep it. Suggest rotating later.

## Decisions taken during execution (rulings)

- No commits during execution (user asked); everything committed at session end.
- DB hardening from database-reviewer: file links must point to a `property-files` bucket
  file uploaded by the same user; advisory lock per unit in the 100 % share check;
  `record_gaps` CTE not materialized; "today" = Africa/Tunis; full `units(property_id)` index;
  houses/plots created before 0002 back-filled with their unit; self contact cannot be archived.
- Vitest 4 without `@vitejs/plugin-react` (peer conflicts); Testing Library cleanup in
  `web/src/test/setup.ts`.
- `useWatch` instead of `watch()` in the bien form; contact form keeps the created id in state
  (React Compiler lint rules).
- Deleting an upcoming ownership row also reopens the holdings it had closed.
- Downloads get their file extension back (`downloadName`).

## Deferred minors

- "Proposer selon les surfaces" gives 0 ‰ to units without surface without saying so.
- An archived bien is still editable on Photos / Documents / Parties communes tabs.
- Owner-role lock on contact edit ignores upcoming holdings.
- Dashboard tile counts missing items, not records.
- No « Réessayer » button on network/permission error toasts.
