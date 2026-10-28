# Handoff: Nhost purge complete — repo cleanup after the Floci cutover (2026-10-28)

Branch `vitrine`. Committed: `591a603` "refactor: purge Nhost/Hasura references after Floci cutover" (83 files, +290/−331). Working tree clean. Previous commit: `f5e2ac7` "migration complete sur floci".

This file is the memory of the cleanup session that followed the Nhost → Floci migration.

## Context

- The user fully migrated the real-estate ERP from **Nhost** (cloud Postgres + Hasura GraphQL + Nhost Auth + Nhost Storage) to a self-hosted **Floci AWS stack**: AppSync GraphQL API over Lambda ops on DynamoDB, S3 for files, **Cognito** for auth, EventBridge Scheduler for the daily cron, DynamoDB Streams for e-mail events. The cutover runbook `infra/amplify-data/RUNBOOK-floci-persistent.md` (steps C1–C13) was **executed**: Floci runs in `persistent` mode, data restored, `web/.env.local` points at the new AppSync API. Nothing reads Nhost anymore.
- The user then asked to **delete everything Nhost-related from the repository**. Chosen scope ("2+3"): complete cleanup **+ historical docs reworded** **+ internal module renames**.
- Discussion language with the user: French; keep implementation lightweight.

## Rules that were fixed (and must stay)

1. **Never edit applied SQL identifiers** in `db/` — `nhost_hasura` (role in `GRANT` loops), `hasura.user` (GUC read by `current_setting`), `x-hasura-*` (session keys), `hasura_session` (function argument). Only **comment lines** (matching `^\s*--`) were reworded.
2. **Docs keep historical artifacts** for accuracy: deleted-script names (`scripts/apply-hasura-permissions.mjs`, `scripts/check-hasura.mjs`, `scripts/apply-hasura-triggers.mjs`), commit messages (`feat(hasura): …`), and code-block contents (plans replicate the exact SQL/scripts of their time). `docs/00-documentation-map.md` carries a note (late October 2026) saying Nhost/Hasura mentions in older documents refer to the former backend.
3. **The wire contract was deliberately NOT renamed**: web → ops Lambda still speaks the Hasura-shaped query format (`$where`, `$orderBy`, `_ilike`, `by_pk`, `affected_rows` in GraphQL operation text) because the web sends its existing queries unchanged. Guard: `assertWritable` in `web/src/lib/backend.ts`.
4. Env-var renames applied in docs prose: `NHOST_WEBHOOK_SECRET` → `FUNCTIONS_WEBHOOK_SECRET`, `NHOST_FUNCTIONS_URL` → `FUNCTIONS_URL` (the real runtime secret `erp-functions-config` still needs a manual purge — see "Runtime steps remaining").

## What was changed, layer by layer

### Web layer (`web/src`)
- ~29 stale comments reworded ("Nhost Storage" → S3/Floci, "Hasura" → data layer / row filter, "Nhost client" → presigned S3/Floci url, per-project subdomain photo wording → public bucket url…). Files touched include: `lib/backend.ts`, `lib/contact-duplicates.ts`, `app/api/storage/presign/route.ts`, `app/api/storage/delete/route.ts`, `lib/errors.ts`, `components/files/storage-image.tsx`, `components/files/photo-viewer.tsx` (+ its test), `lib/site/listing-details.ts`, `lib/site/listings-queries.ts`, `lib/site/request-actions.ts`, `components/calendar/use-calendar-feed.ts`, `components/calendar/appointment-mutations.ts`, `components/notifications/notification-mutations.ts`, `components/site/home-hero.tsx`, `components/site/listing-gallery.tsx`, `components/site/listing-card.tsx`, `components/site/request-dialog.tsx`, `i18n/messages/fr/errors.ts`.
- **Real bug fixed (not just comments)**: `accountErrorKey` in `web/src/lib/site/account.ts` still mapped dead **Nhost** error codes (`email-already-in-use`, `password-in-hibp-database`, `password-too-short`, `invalid-email`, `signup-disabled`) while `/api/auth` (Cognito) returns raw **Cognito** codes. New mapping: `UsernameExistsException` → `emailTaken`; `InvalidPasswordException` → `weak`; `InvalidParameterException`, `NotAuthorizedException`, `CodeMismatchException`, `ExpiredCodeException`, `invalid-request` → `invalid`; default → `other`. The `disabled` key was removed from `AccountErrorKey` and from `errors.account` in all three languages (`fr/en/ar site.ts`); `account.test.ts` updated to the Cognito codes.

### Infra / internal renames
- `infra/amplify-data/lambda/api/hasura-eval.ts` → **`query-eval.ts`** (+ its test file). Bulk token replace over 12 files: `functions/_lib/appointment-decisions.ts`, `functions/_lib/event.ts`, `functions/_tests/appointment-decisions.test.ts`, `infra/.../api/ops/{calendar,leases,office,people,places,public}.ts`, `api/hasura-eval.test.ts`, `api/org-data.ts`, `lambda/domain/mail-events.ts`.
- `HasuraEvent` → **`RowChangeEvent`** everywhere, including `asHasuraEvent` → `asRowChangeEvent` in `lambda/domain/mail-events.ts`.
- Comment rewordings in: `query-eval.ts` ("row-query language", "Row-filter expression"), `org-data.ts`, `registry.ts`, `lambda/daily/index.ts` (EventBridge Scheduler line), `lambda/domain/mail-events.ts` (Postgres→DynamoDB wording), `api/ops/places.ts` line ~152 (current_lease array relationship), `amplify/data/schema.graphql` line ~382, `functions/_lib/event.ts` ("Row-change event body"), `functions/_lib/secrets.ts` (secret now holds SMTP_* + APP_URL only), `functions/_lib/appointment-decisions.ts` line 6.

### Deletions (legacy Nhost bridge, confirmed dead post-cutover)
- `functions/dist/` (3 zips + 3 bundle dirs for `lease-daily`, `send-notification-email`, `send-appointment-email`) — never git-tracked.
- `functions/scripts/` (empty).
- `infra/amplify-data/scripts/remap-user-ids.mjs` (one-off Nhost→Cognito user-id rewrite, already done).
- The live stack reuses only `functions/_lib/{appointment-decisions,event,mail-templates,secrets,smtp-env}` (+ `mailer`, `runtime` transitively); nothing calls the legacy REST webhook path (`x-nhost-webhook-secret` header) anymore.

### db/ prose cleanup (18 files)
- Files: `db/migrations/0001,0003,0004,0005,0006,0007,0008,0009,0013*.sql`, `db/tests/0002…0009*.test.sql`, `db/local/stubs.sql`.
- Method: PowerShell script applying a **list of replacement pairs** (NOT a hashtable — the first attempt failed with a parse error: duplicate key `'Nhost dashboard SQL Editor'` in a `[ordered]@{}` literal; three near-identical "Nhost dashboard … SQL editor/editor" variants had to be merged). Comment lines only (`^\s*--`); read raw, split on `\n`, rejoined, written UTF-8 no BOM → line endings and the U+2192 (→) arrow in `db/tests/0002_core_records.test.sql:1` preserved.
- Sample rewordings: "Hasura database role" → "data-layer database role"; "Paste into the Nhost dashboard SQL Editor" → "…the legacy console SQL Editor"; "called by the lease-daily Nhost function" → "…the lease-daily function"; stubs header → "Local stand-ins for the auth and storage schemas… Never applied to the cloud backend"; "Nhost keeps every role" → "The old auth kept every role"; "Nhost always has a default bucket" → "The old storage always has…"; 0013 header → "file storage moved from the old cloud storage to Floci/S3".
- **Verified**: after the run, every remaining `nhost|hasura` match in `db/` is SQL code (identifiers), zero comments.

### Docs (subagent, sessionID `ses_e7df179e0ffey1k23pu3xWHbIS`) — 20 files
README.md (backend paragraph → local Floci container at http://localhost:4566, external `floci` Docker network), docker-compose.yml (header), scripts/db-local.sh, 3 e2e comment files (calendar.spec, helpers.ts, front-office.spec), RUNBOOK (one status line added under the title; body untouched as migration record), infra/amplify-data/metrics/CV-notes-2026-10-27.md, docs/00-documentation-map.md (+ note), 12 specs/plans/handoffs under docs/superpowers.

## Verification (final state of `nhost|hasura`, case-insensitive, outside node_modules)

| Zone | Residue |
|---|---|
| `web/src` + `web/e2e` | **0** |
| `functions/` | **0** |
| `infra/amplify-data` | RUNBOOK only (status line + historical body) |
| `db/` | SQL identifiers only (`nhost_hasura` ×4 loops, `hasura.user` GUC, `x-hasura-*` keys, `hasura_session` params — verified per file) |
| `docs/` | historical artifacts: deleted-script names, commit messages, code blocks, legacy env names in task ledgers, `X-Hasura-Org-Id` in design records |
| `.github/` | 0 (already clean) |

## Tests run (2026-10-28)

| Suite | Result |
|---|---|
| `web` vitest | 635/639 passed + `tsc --noEmit` 0 errors. The 4 failures are flaky 5 s timeouts under full-suite parallel load (different set each run: `listing-booking-card.test.tsx`, `appointment-dialog.test.tsx`); both files pass 11/11 in isolation in ~4 s. Not a code regression. |
| `functions` vitest (`--config _vitest.config.ts`) | 36/36 + `tsc --noEmit` clean |
| `infra/amplify-data` (`node --test`) | 113/113, incl. the renamed `query-eval.test.ts`, `mail-events.int.test.ts`, AppSync integration suites, backup/restore tests |

Note: `infra/amplify-data/deploy-dev*.log` files (10) + `log-signatures.txt` exist on disk but are **git-ignored** (checked).

## Runtime steps remaining (outside the repo)

1. **Purge the Secrets Manager secret `erp-functions-config`** in Floci: remove the dead keys `HASURA_GRAPHQL_URL` + `HASURA_ADMIN_SECRET`; keep `SMTP_*` + `APP_URL`. Security gain: the old admin secret has no business being there.
2. Optional: delete from Floci the legacy deployment leftovers if still present — REST API `floci-functions` and the 3 legacy Lambdas (`lease-daily`, `send-notification-email`, `send-appointment-email`).

## Deferred feature work (awaiting the user's go — "take it easy" pace)

Source: REA analysis of tecnocasa.tn (4 browser scenarios; evidence IDs `ev_18297…`, `ev_5c7eb…`, `ev_98f241…`, `ev_35a31c…`; 5.7 MB bundle at `C:\Users\mbark\AppData\Local\Temp\opencode\rea-detail-bundle.json`).

- WhatsApp button on the public listing page.
- Hardening of the public request endpoints (per-IP rate limit + CAPTCHA, e.g. Cloudflare Turnstile — the known gap recorded in handoff 2026-10-23).
- ±25% similar-listings query.
- Candidate profile: the 3-feature "light MVP" (listings page, simple search, contact) is already implemented; still placeholders in the ERP (finance, maintenance, fournisseurs, ventes, rapports, audit, users/roles admin) via `web/src/app/erp/(app)/[...slug]/page.tsx`.

## Post-cutover architecture cheat-sheet

- Web → AppSync (`APPSYNC_URL`) via `web/src/lib/backend.ts` (`appsyncRequest`: raw JWT or PUBLIC_TOKEN, **no** "Bearer " prefix — Floci routes Bearer tokens to OIDC, not to the Lambda authorizer).
- Auth: Cognito via `web/src/app/api/auth/route.ts` (`AUTH_COGNITO_URL`); error codes passed raw to the client; JWT carries `custom:role` and `custom:org_id`.
- Storage: presigned S3/Floci via `web/src/app/api/storage/*` (`S3_ENDPOINT=http://localhost:4566` locally; `web/.env.example` is Floci-only).
- Daily cron: EventBridge Scheduler 05:00 UTC (06:00 Tunis) → `lambda/daily` (expire leases, then notifications, owners refresh).
- E-mails: DynamoDB Streams → `lambda/domain/mail-events.ts` (RowChangeEvent adapter) → `lambda/mailer`, which imports `functions/_lib/{smtp-env,secrets,mailer,mail-templates,appointment-decisions,event}`.
- Ops data layer: `infra/amplify-data/lambda/api` (registry by GraphQL operation name, ops/* resolvers, `query-eval.ts` for where/orderBy, `org-data.ts` per-org loads); `amplify/data/schema.graphql` exposes `whoami` and `run(op, variables)` via `@function`.
