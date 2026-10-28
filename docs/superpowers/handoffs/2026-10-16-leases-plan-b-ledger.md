# SDD ledger — plan: docs/superpowers/plans/2026-10-16-leases-calendar-notifications.md

Spec: docs/superpowers/specs/2026-10-15-leases-design.md (reachable). Base: 0614b0f.

Pre-flight:
- Task 1 → Tasks 2, 3, 4, 5: tables appointments / appointment_participants / notifications / auth.user_roles with the exact column names of Task 1. Consumers use the same names. Consistent.
- Task 2 → Tasks 3, 5, 10: staff_members and calendar_feed columns. Consistent with FeedRow in Task 10.
- Task 7 → Tasks 8, 9: createHasuraClient and isAuthorizedWebhook. Consistent.
- Task 8 → Task 9: createMailer and appointmentMail (kind union invitation | update | cancellation). Consistent.
- Numbering: spec section 3.2 header says 0004_rent_requests.sql; section 3 header and section 11 say 0004 is calendar. Ruling R1 (plan): 0004 = calendar; rent requests = 0005. Cost if wrong: one renumber in Plan C.
- Staff source: spec says auth.users; plan uses auth.user_roles (R2). Verified live by the user in Task 2 step 5, before Task 3 relies on it.
Pre-flight: done.
Task 1: Ruling: RED failed on missing auth.user_roles (fixture line) before appointments — both are Task 1 objects, failure reason equivalent — cost if wrong: none.
Task 1: Ruling: stub auth.user_roles uses id pk + unique (user_id, role) instead of pk (user_id, role) — mirrors the legacy backend's real table shape — cost if wrong: none (local stub only).
Task 1: complete (commits 0614b0f..22585dc, tests: bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql → CONTEXT:  PL/pgSQL function inline_code_block line 61 at RAISE)
Task 2: Ruling: lease event title is 'Bail <number>' (ASCII, migration rule); the web adds the French kind label — cost if wrong: one label change in the web.
Task 2: Ruling: a user with both staff roles appears once in staff_members with role org_admin (distinct on, org_admin first) — cost if wrong: role column shows the higher role only.
Task 2: Ruling: test fixture creates its own unit (demo units are all leased) — cost if wrong: none.
Task 2: Deferred user step: live check `select user_id, organization_id, role from public.staff_members;` after 0004 is applied (R2). Carried to Task 14 live steps.
Task 2: complete (commits 22585dc..a71d196, tests: bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql → CONTEXT:  PL/pgSQL function inline_code_block line 120 at RAISE)
Task 3: Ruling: notification titles are ASCII ('Bail <number>' or the appointment title), not the French « Bail N° … se termine bientôt » the plan quoted — the migration is ASCII-only (Global Constraints win). The French wording comes from the kind. Consequence carried to Task 8: notificationMail takes { kind, title, body, link }; Task 10/13: the bell shows NOTIFICATION_KIND_LABELS[kind] + title. Cost if wrong: one template change.
Task 3: Ruling: check_appointment_staff execute also revoked from public (trigger functions are not checked at fire time) — cost if wrong: none.
Task 3: complete (commits a71d196..b3aa96e, tests: bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql → CONTEXT:  PL/pgSQL function inline_code_block line 171 at RAISE)
Task 4: Ruling: seed participants carry email_status sent/failed/skipped (not pending), so installing the triggers later never e-mails the example.tn demo addresses; one guarantor is 'failed' to demo « Renvoyer » — cost if wrong: demo shows no pending state.
Task 4: complete (commits b3aa96e..db18bcd, tests: bash scripts/db-local.sh apply db/seeds/0004_demo_calendar.sql → (no output))
Task 5: Ruling: appointment_participants client update is email_status only, with check email_status = 'pending' (Renvoyer); role changes go through delete + insert (Task 12) — prevents a client from marking an e-mail 'sent' — cost if wrong: role edit needs delete/insert.
Task 5: Ruling: appointments.assigned_user relationship targets staff_members (not auth.users, which our roles cannot read) — cost if wrong: none.
Task 5: Ruling: check-hasura.mjs also lists the five new names and generate_daily_notifications (not in plan) — cost if wrong: none.
Task 5: dry run before 15/40/137/5, after 20/50/165/6 (+28 permissions = 15 selects + 4 appointments + 4 participants + 3 notification updates + 2 Renvoyer).
Task 5: complete (commits db18bcd..bebef4f, tests: node scripts/apply-hasura-permissions.mjs --dry-run → Dry run: 20 tracked tables/views, 50 relationships, 165 permissions, 6 functions. Nothing sent.)
Task 6: Ruling: cron schedule is '0 5 * * *' UTC (the legacy cron triggers have no timezone field; Tunisia is UTC+1 with no DST, so this is 06:00 Tunis) — cost if wrong: job runs one hour off.
Task 6: Ruling: function URL and webhook secret are resolved by the data layer from its env ({{NHOST_FUNCTIONS_URL}}, value_from_env NHOST_WEBHOOK_SECRET) instead of being read by the script from NHOST_FUNCTIONS_URL / NHOST_WEBHOOK_SECRET — the secret never lands in metadata; the script needs only HASURA_ADMIN_SECRET. Cost if wrong: the user sets those two variables in the data layer's environment.
Task 6: Ruling: replace: true instead of delete-then-create (same additive effect, one request per trigger) — cost if wrong: none.
Task 6: complete (commits bebef4f..4b78861, tests: node scripts/apply-hasura-triggers.mjs --dry-run → Dry run: 1 cron trigger, 3 event triggers. Nothing sent.)
Tasks 7-10: dispatched in parallel (dispatching-parallel-agents): agent A = functions/ (Tasks 7-9), agent B = web/src/lib (Task 10); disjoint files, agents did not commit; coordinator re-ran every suite.
Task 7: Ruling: the legacy backend deployed every .ts under functions/ as an endpoint except _-prefixed names → shared code in functions/_lib, tests in functions/_tests, config functions/_vitest.config.ts (plan said lib/ and *.test.ts beside the handlers) — cost if wrong: tests or helpers exposed as endpoints.
Task 7: Ruling: the legacy functions are Express-style (req, res), not Fetch Request/Response → pure cores handleLeaseDaily / handleNotificationEmail / handleAppointmentEmail return {status, body}; default exports are 3-line adapters — cost if wrong: adapter rewrite only.
Task 7/3: Ruling (integration finding): the data layer cannot track a SQL function returning integer → generate_daily_notifications now returns setof notifications (inserted rows); lease-daily selects { id } and counts rows. RED→GREEN both sides (functions lease-daily test, SQL test 8), commit 602d991 — cost if wrong: none.
Task 8: Ruling: notificationMail takes { kind, title, body, link } (+ appUrl from env APP_URL) per Task 3 ruling; French subject from kind — cost if wrong: one template change.
Task 8: Ruling: SMTP env checked only when a mail must be sent; a skipped notification never 500s — cost if wrong: none.
Task 9: Ruling: decideParticipantAction(event, context?) takes the appointment/contact context read from the data layer for the skip cases; handler re-reads stored email_status so a retry never double-sends — cost if wrong: none.
Task 10: Ruling: all-day lease events use date-only start/end strings (Tunis day, end exclusive) so the browser zone cannot shift them — cost if wrong: none.
Task 10: Ruling: PARTICIPANT_ROLE_LABELS = Locataire / Garant / Prospect / Acheteur / Autre (plan gave none) — cost if wrong: wording change.
Task 10: Ruling: LEASE_EVENT_KIND_LABELS (Début du bail / Fin du bail / Échéance d'enregistrement); lease event title = '<label> · Bail <n>' — cost if wrong: wording change.
Task 7: complete (commits 4b78861..a8769d1, tests: npm --prefix functions test →    Duration  528ms (transform 457ms, setup 0ms, import 1.13s, tests 104ms, environment 1ms))
Task 8: complete (commits 4b78861..a8769d1, tests: npm --prefix functions test →    Duration  501ms (transform 489ms, setup 0ms, import 1.13s, tests 102ms, environment 1ms))
Task 9: complete (commits 4b78861..a8769d1, tests: npm --prefix functions test →    Duration  578ms (transform 555ms, setup 0ms, import 1.37s, tests 128ms, environment 1ms))
Task 10: complete (commits 5bbd5e6..a8769d1, tests: npm --prefix web test →    Duration  6.33s (transform 2.74s, setup 22.42s, import 8.31s, tests 2.52s, environment 54.75s))
Tasks 11-13: Tasks 11+12 (agent A) and Task 13 (agent B) dispatched in parallel on disjoint files; coordinator re-ran vitest (31 files at last run), tsc, lint, build; added calendar-view.test.tsx smoke test (FullCalendar renders in jsdom).
Task 11: Ruling: FullCalendar runs timeZone 'UTC' with timed events shifted to their Tunis wall clock via isoToTunisParts/tunisToIso (no named-timezone plugin) — Tunis is UTC+1 with no DST so this is exact — cost if wrong: events shift if Tunisia adopts DST.
Task 11: Ruling: view/date live in the query string, updated with history.replaceState (not router.replace) so the datesSet patches do not overwrite each other — cost if wrong: useSearchParams may not follow replaceState in this Next version; to confirm in the browser pass.
Task 12: Ruling: contact page had no appointments placeholder; ContactAppointments card added after the guaranteed-leases card — cost if wrong: none.
Task 12: Ruling: appointment edits send only changed columns and only changed participants (no delete+insert of unchanged participants) so unchanged participants are never re-invited — cost if wrong: none.
Task 12: Ruling: appointment end is a duration in minutes in the form (hint « Fin à HH:mm »); 0 or less → « La date de fin doit suivre la date de début. » — cost if wrong: UX only.
Task 13: Ruling: dashboard tile « Rendez-vous aujourd’hui » shows only when count > 0, like the two lease tiles — cost if wrong: tile hidden on empty days.
Task 13: Ruling: the bell keeps the last successful list during a refetch (useGraphql returns loading again on reloadKey change) — cost if wrong: none.
Not verified (needs the live data layer / a logged-in browser, so not run by the agent): every GraphQL operation of Tasks 11-13 (listed in the agents' reports), browser rendering at desktop and 375 px, useSearchParams vs replaceState. Carried to the user steps in Task 14.
Task 11: complete (commits a8769d1..ff38fe9, tests: npm --prefix web test →    Duration  7.97s (transform 3.75s, setup 20.86s, import 17.75s, tests 9.47s, environment 71.83s))
Task 12: complete (commits a8769d1..ff38fe9, tests: npm --prefix web test →    Duration  7.70s (transform 3.69s, setup 18.92s, import 16.46s, tests 9.31s, environment 68.19s))
Task 13: complete (commits a8769d1..ff38fe9, tests: npm --prefix web test →    Duration  7.83s (transform 2.92s, setup 20.84s, import 15.84s, tests 9.36s, environment 69.72s))
Task 14: Ruling: E2E spec and live steps written but NOT run (needs live migration 0004, data-layer permissions, secrets, and the user's test login in web/.env.test.local, absent in this worktree). Playwright lists 3 specs. Whole-project local checks green: web 219 tests, coverage lines 99.3 / branches 96.6 on measured files, tsc, lint, build (route /calendrier); functions 71 tests + tsc; SQL tests 0002/0003/0004 OK; both data-layer script dry runs OK.
Task 14: complete (commits ff38fe9..6ea154b, tests: npm --prefix web test →    Duration  18.94s (transform 14.35s, setup 94.43s, import 58.75s, tests 28.40s, environment 61.95s))
Final: review by a fresh Opus reviewer (13 commits, 82 files). Re-graded: C1 Critical stands; I1-I7 Important stand; promoted to Important by effect: staff_members malformed org id (one bad metadata value would fail the view for every organization: daily job, staff picker, recipients).
Final: fixed C1 (lease_expired keyed on end_date + grace + 1; fixture now produced by the real expire_overdue_leases) — SQL test 10 RED→GREEN, 0004 suite OK.
Final: fixed I1 (reminder key carries the Tunis day; reminder_sent_at = last covering run) + I2 SQL (trigger drop_stale_appointment_reminders on status / Tunis-day change; read reminders too) — tests 9c, 9d RED→GREEN.
Final: fixed I3 (test gap): appointments at 00:30 Tunis tomorrow / day after; mutation check with a UTC-day version of the function FAILED the test as intended, real function restored — suite OK.
Final: fixed staff_members strict 8-4-4-4-12 org id with CASE guard — test 5b RED→GREEN (the 36-char malformed id was in fact accepted by the old view).
Final: I5 trigger part: scripts/apply-hasura-triggers.mjs lists notify_by_email in appointment_changed columns (dry run shows it).
Final: fixed I2 handler — send-notification-email skips appointment_reminder when the appointment is no longer planned (records email_error, 200); tests RED→GREEN (2 failing → passing), suite 93/93.
Final: fixed I5 handler — decideAppointmentAction returns invite_all on notify_by_email false→true (planned); handler invites skipped/pending/failed participants with an address; update/cancel include a skipped participant only if they got an address later and mails were on before; tests RED→GREEN, suite 93/93.
Final: fixed I7 — failures writing a participant result / emailed_at are counted and return 200 (never 5xx after a mail went out); a read failure before any send still gives 500 so the data layer retries; 5 tests RED→GREEN, suite 93/93, tsc OK.
Final: fixed I4 — contact card queries appointment_participants(where contact_id) server-side (no org-wide fetch, no limit-500 truncation); 4 tests RED→GREEN.
Final: fixed I5 (web part) — participantEmailLabel: « E-mail désactivé » when notifications are off, « Pas d'adresse e-mail » only when on and no address; Renvoyer only for a failed mail on a planned appointment (also the reviewer's Renvoyer-on-cancelled minor) — RED→GREEN.
Final: I6 — reviewer's premise was partly wrong: FullCalendar 6.1.22 already makes events focusable (tabindex 0, Enter/Space work, tests passed before the change); the real gap was no role=button. Added eventInteractive + role=button via eventDidMount — test RED→GREEN for the role; focus/keyboard tests kept as guards.
Final: whole suite after the fix pass: web 238 tests, tsc, lint, build OK; functions 93 + tsc; SQL 0003 and 0004 OK; both data-layer dry runs OK.
Final: minor (deferred): role change on a participant deletes + re-inserts it, which re-sends the invitation; a participant added in the same save as a time change gets invitation and update.
Final: minor (deferred): reminder e-mail and bell show no date/time; lease notifications omit end/deadline dates (body is never set).
Final: minor (deferred): appointment_staff_invalid and participant PK violations are not mapped to French in web/src/lib/errors.ts.
Final: minor (deferred): staff-conflict warning only sees appointments loaded for the visible range; calendar feed query limit 1000 truncates a very busy month silently.
Final: minor (deferred): an appointment created after 06:00 for the next day gets no reminder (the run looks one day ahead only).
Final: minor (deferred): dialog text says changing the status notifies participants but the form has no status field.
Final: minor (deferred): web/e2e/calendar.spec.ts invites SARL Carthage Digital (a demo address): once SMTP is live every run mails it; use the e-mail-less prospect Yassine Mansouri from seed 0004 instead.
Final: minor (deferred): on a transient SMTP failure the notification handler returns 200, so the data layer never retries and nothing in the UI shows email_error or offers a resend of a staff e-mail.
Final: Ruling: reviewer's « Declined to judge » items (data-layer role access to functions exposed as mutations, {{NHOST_FUNCTIONS_URL}} / value_from_env resolution, the legacy bundling of extensionless ESM imports, useSearchParams vs history.replaceState, staff e-mails visible to viewers, registration_overdue repeating after 90-day retention, no notification for manually ended leases, ended/expired leases off the calendar (R4), appointments without a unit hidden by the branch filter, repeated Renvoyer, calendar_feed performance at scale) — accepted as they stand: each needs the live project or a product decision — cost if wrong: see each; the live ones are on the user check list.
