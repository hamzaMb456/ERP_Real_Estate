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

Commits: `f5e2ac7` (cutover) → `591a603` (purge) → `86f78c8` (purge handoff) → `98647f3`/`1b22ac5` (memory) on branch `vitrine`.

## Rules that survive all sessions

1. Never edit applied SQL identifiers in `db/` (`nhost_hasura`, `hasura.user`, `x-hasura-*`, `hasura_session`) — comments only.
2. Docs keep historical artifacts (deleted-script names, commit messages, code blocks); older docs' Nhost/Hasura mentions refer to the former backend — see `docs/00-documentation-map.md`.
3. The web ↔ ops wire contract stays Hasura-shaped (`$where`, `_ilike`, `by_pk`, `affected_rows`) — deliberately not renamed; `assertWritable` guard in `web/src/lib/backend.ts`.

## Current state (2026-10-28)

- Branch `vitrine`, working tree clean, all suites green (web 635/639 + tsc, functions 36/36 + tsc, infra 113/113).
- Runtime steps pending (outside the repo): purge `HASURA_GRAPHQL_URL` + `HASURA_ADMIN_SECRET` from Floci secret `erp-functions-config` (keep `SMTP_*` + `APP_URL`); optionally delete legacy REST API `floci-functions` + 3 legacy Lambdas.
- Next work (awaiting the user's go, pace "take it easy"): WhatsApp button, rate-limit/CAPTCHA hardening, ±25 % similar-listings — full analysis in the tecnocasa notes file above.
