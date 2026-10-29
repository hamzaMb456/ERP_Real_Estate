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
| 2026-10-29 | **Client space & dashboard (Espace réservé)** — authenticated `/compte` dashboard inspired by Tecnocasa with greeting, 4 stat cards (favoris, recherches sauvegardées, annonces masquées, visites), quick search saver (ville, type, louer/acheter), hidden listings section with unhide action, recently viewed properties; dedicated `/compte/profil` page (client details, password reset link, logout); hide toggle (`HideButton` / `EyeOff`) on listing cards; hidden listings filtered client-side in `search-results.tsx` with localized count note; listing view recorded on `ListingPageContent`; full fr/en/ar i18n parity; 3 new DynamoDB tables (`SavedSearch`, `HiddenListing`, `ListingView`) deployed to `dev` and `main` stacks with 8 CLIENT-role ops and passed int test `client-space.int.test.ts`; all unit tests green (80/80 suites, 647/647 tests) and Next.js build clean (46/46 routes). | `web/src/components/site/client-dashboard.tsx`, `web/src/lib/site/client-space.ts` |

Commits: `f5e2ac7` (cutover) → `591a603` (purge) → `86f78c8` (purge handoff) → `98647f3`/`1b22ac5`/`8b87ba7` (memory) on branch `vitrine`.

## Rules that survive all sessions

1. Never edit applied SQL identifiers in `db/` (`nhost_hasura`, `hasura.user`, `x-hasura-*`, `hasura_session`) — comments only.
2. Docs keep historical artifacts (deleted-script names, commit messages, code blocks); older docs' Nhost/Hasura mentions refer to the former backend — see `docs/00-documentation-map.md`.
3. The web ↔ ops wire contract stays Hasura-shaped (`$where`, `_ilike`, `by_pk`, `affected_rows`) — deliberately not renamed; `assertWritable` guard in `web/src/lib/backend.ts`.

## Current state (2026-10-29)

- Branch `vitrine`, working tree has the client space & dashboard complete: backend (domain + ops + int tests), frontend data layer (`client-space.ts`), `/compte` dashboard, `/compte/profil`, hide button on cards, search hidden listings filtering, listing view recording, full fr/en/ar i18n. Both `dev` and `main` stacks deployed with the 3 new tables.
- All test suites green: `web` (80 test files, 647 tests passed), `infra` int tests (`client-space.int.test.ts`, `two-org-isolation.int.test.ts`, `places.int.test.ts`), Next.js build clean (46 routes generated).
- **Deploy gotcha**: `npm run deploy` defaults to env `dev`, which is a SEPARATE sandbox stack (`amplify-erp-dev-sandbox-*`, api `2cacd929…`) — the web (`web/.env.local` → `APPSYNC_URL`) talks to the `main` stack (`amplify-erp-main-sandbox-0a9d62828b`, api `861df1f5118d47acb3576c3db2`, tables `*-861df1f5118d47acb3576c3db2-NONE`). Deploy lambda changes with `npm run deploy -- main --yes`.
- Next work (awaiting the user's go, pace "take it easy"): WhatsApp button, rate-limit/CAPTCHA hardening, ±25 % similar-listings — full analysis in the tecnocasa notes file above.
