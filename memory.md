# Memory — ERP_Real_Estate

> Long-term memory of AI-assisted work on this project. Kept deliberately small:
> one line per session, links to the detailed files, plus the current state.
> Working language with the user: French. Implementation style: lightweight.

## Session index

| Date | Session | Details |
|---|---|---|
| 2026-10-24 | Nhost → Floci cutover executed (runbook C1–C13: persistent mode, data restored, web → new AppSync) | `infra/amplify-data/RUNBOOK-floci-persistent.md` (status line added; body = migration record) |
| 2026-10-28 | **Nhost purge complete** — every Nhost/Hasura reference removed or reworded (comments, module renames, legacy deletions); real bug fixed: `accountErrorKey` now maps Cognito codes | `docs/superpowers/handoffs/2026-10-28-nhost-purge-complete.md` |
| 2026-10-28 | **tecnocasa.tn reverse engineering + app state audit** — competitor features extracted via 4 REA browser scenarios; light-MVP verdict: already implemented | `docs/superpowers/notes/2026-10-28-tecnocasa-features.md` |
| 2026-10-28 | **Feature deep-dive + HTML prototypes** — graph-audit found ±25 % similar already live; prototypes for WhatsApp contact, anti-abus (CAPTCHA/limiteur IP), similaires, badge prix, fiche PDF in `prototypes/tecnocasa-features/` (all flows browser-tested) | `prototypes/tecnocasa-features/index.html` |
| 2026-10-29 | **Unit hard delete + row actions on the biens list** — `deleteUnit` refuses any unit still referenced (LeaseUnit, lease `unit_ids`, Ownership, VisitRequest, RentalRequest, Appointment) with `unit_not_deletable`, else deletes Unit + FileLink + PublicListing + code Lock in one transaction; `DeleteUnit` op + int test; list page row menus (property: modifier/archiver; unit: modifier/archiver/supprimer), delete button on the unit fiche; also map NaN guard (`latitude ?? null` in the Property op, finite checks in the picker/overview) and next-themes React 19 script warning (`scriptProps={{ type: 'text/javascript' }}`) | `infra/amplify-data/lambda/domain/places.ts`, `web/src/app/erp/(app)/biens/page.tsx` |

Commits: `f5e2ac7` (cutover) → `591a603` (purge) → `86f78c8` (purge handoff) → `98647f3`/`1b22ac5` (memory) on branch `vitrine`.

## Rules that survive all sessions

1. Never edit applied SQL identifiers in `db/` (`nhost_hasura`, `hasura.user`, `x-hasura-*`, `hasura_session`) — comments only.
2. Docs keep historical artifacts (deleted-script names, commit messages, code blocks); older docs' Nhost/Hasura mentions refer to the former backend — see `docs/00-documentation-map.md`.
3. The web ↔ ops wire contract stays Hasura-shaped (`$where`, `_ilike`, `by_pk`, `affected_rows`) — deliberately not renamed; `assertWritable` guard in `web/src/lib/backend.ts`.

## Current state (2026-10-29)

- Branch `vitrine`, working tree has uncommitted changes: i18n rename « Biens recommandés » (fr/en/ar + test + component), new `lambda/api/two-org-isolation.int.test.ts`, unit delete + list row actions (see session row above), map/theme fixes, `memory.md`, untracked `prototypes/`, `graphify-out/`, `AGENTS.md`, `CLAUDE.md`; all suites green (web + tsc, functions 36/36 + tsc, infra incl. the two-org and delete tests; two known timing flakes pass in isolation: `mail-events.int.test.ts` and the site booking/appointment dialog tests).
- **Deploy gotcha**: `npm run deploy` defaults to env `dev`, which is a SEPARATE sandbox stack (`amplify-erp-dev-sandbox-*`, api `2cacd929…`) — the web (`web/.env.local` → `APPSYNC_URL`) talks to the `main` stack (`amplify-erp-main-sandbox-0a9d62828b`, api `861df1f5118d47acb3576c3db2`, tables `*-861df1f5118d47acb3576c3db2-NONE`). Deploy lambda changes with `npm run deploy -- main --yes`. A stray dev stack was created by mistake on 2026-10-29 (tables are RETAIN — harmless clutter; delete by hand if desired).
- Two REAL agencies provisioned for manual testing (re-runnable `scripts/two-org-demo.mjs`): `admin-a@agence-a.test` / `admin-b@agence-b.test`, password `Demo!Agence2026`, both org_admin via Floci Cognito (AdminCreateUser + AdminSetUserPassword + AdminUpdateUserAttributes for custom:role/custom:org_id). Cross-org verified through the REAL AppSync HTTP path with real ID tokens: foreign detail reads answer null, foreign writes surface DomainError contact/lease/unit_not_found, own lists scoped. NOTE: Floci dev container is memory-mode — accounts and seed vanish on restart; re-run the script (it creates fresh orgs + accounts each run). `null` (detail ops return `{x: null}`, only writes throw `*_not_found`), foreign writes refused, public catalogs per org, `public_org_required` without org. Gotcha found during debug: caller `orgId` must be the SAME uuid as fixture `organization_id` (first version used two different random uuids → all reads empty).
- Runtime steps pending (outside the repo): purge `HASURA_GRAPHQL_URL` + `HASURA_ADMIN_SECRET` from Floci secret `erp-functions-config` (keep `SMTP_*` + `APP_URL`); optionally delete legacy REST API `floci-functions` + 3 legacy Lambdas.
- Next work (awaiting the user's go, pace "take it easy"): WhatsApp button, rate-limit/CAPTCHA hardening, ±25 % similar-listings — full analysis in the tecnocasa notes file above.
