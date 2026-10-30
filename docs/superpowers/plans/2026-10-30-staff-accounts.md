# Regional Staff Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manager creates a regional staff account; the person activates it from a one-time email link (own password plus a required authenticator-app code); the backend refuses a staff login that has not finished; a kill switch locks the account at once.

**Architecture:** Cognito (Floci emulator) holds the login. The login role is `staff_pending` until activation completes, then `staff`; the backend authorizer only accepts `staff`, so an unfinished account is refused by the API even if the sign-in page is bypassed. Cognito admin calls run only in Next.js server routes. Records, invitations and the activity trail live in DynamoDB through backend operations. The invitation email is sent by the existing Mailer function when a `StaffInvitation` row is inserted. The invitation token is signed (HMAC), not stored.

**Tech Stack:** Next.js (App Router, vitest), Node 24 `node --test` for `infra/amplify-data`, Amplify Gen 2 + CDK deploy to Floci, Cognito, DynamoDB streams, nodemailer via `functions/_lib`.

**Spec:** `docs/superpowers/specs/2026-10-30-staff-accounts-design.md`

## Global Constraints

- Authenticator app required for `staff` only; managers and org_admins keep their current sign-in. No SMS.
- Invitation link: valid 24 hours, usable once. The email never contains a password.
- Only `manager` and `org_admin` may create, resend, disable or reset. Checked on the server, never only in the browser.
- Cognito admin calls run only in server code; the browser never holds admin rights.
- Unknown, expired, used and revoked tokens give the same answer (`{ ok: false }` / the same error code).
- Disable = disable login, sign out every session, remove agencies. Reset authenticator = clear the second step, role back to `staff_pending`, new invitation.
- Email already used by a client account: refuse with `email_taken`.
- Forms use the existing multi-step `QuestionFlow` (`web/src/components/forms/question-flow.tsx`). French strings first, then en and ar (the `typeof fr` pattern).
- Look things up with `graphify query` first; read only the files it cites.
- The user has not asked for commits: do not commit. Each task ends with a checkpoint (suites green), not a commit.
- Run tests: `node --test <file>` from `infra/amplify-data`; `npx vitest run <path>` and `npx tsc --noEmit -p .` from `web`.
- **Decision recorded here (differs from the spec text):** the token is `id.HMAC-SHA256(secret, id + "." + expires_at)`, so nothing about it is stored except the invitation row (id, expiry, used/revoked). A database leak alone cannot produce a valid link. The "second step confirmed" flag is the role value: `staff_pending` then `staff`.

## Review Focus

- An account whose password is set but whose authenticator code was never verified must not reach the API (`staff_pending` is refused by the authorizer).
- Resend revokes the previous link: the old link must fail exactly like an unknown one.
- A wrong authenticator code must not change the role and must not burn the invitation.
- Creating a staff login for an email that already has a login (client or staff) must fail cleanly and leave no Cognito user or DynamoDB rows behind.
- Disabling while a session is open: the refresh token must stop working and the agencies must be gone.

---

### Task 1: Spike the authenticator flow on Floci (blocks the web tasks)

**Files:**
- Create: `infra/amplify-data/scripts/totp.mjs`, `infra/amplify-data/scripts/totp.test.mjs`
- Create: `infra/amplify-data/scripts/staff-mfa-check.mjs`
- Create: `infra/amplify-data/scripts/enable-pool-mfa.mjs`

**Interfaces:**
- Produces: `totp(secretBase32: string, atSeconds?: number, digits = 6): string` in `totp.mjs` (RFC 6238, SHA-1, 30 s step). `enable-pool-mfa.mjs` is idempotent: sets the pool MFA to OPTIONAL with software-token MFA on.

- [ ] **Step 1: Write the failing test** in `totp.test.mjs`: `totp` of the base32 of ASCII `12345678901234567890` at `atSeconds = 59` with `digits = 8` equals `94287082`; at `1111111109` equals `07081804`; default 6 digits at 59 equals `287082`.
- [ ] **Step 2: Run** `node --test scripts/totp.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `totp`** with `node:crypto` HMAC-SHA1 and a base32 decoder.
- [ ] **Step 4: Run it again.** Expected: PASS.
- [ ] **Step 5: Implement `enable-pool-mfa.mjs`:** read pool id and endpoint from `web/.env.local` the way `scripts/two-org-demo.mjs` does; call `SetUserPoolMfaConfig` with `MfaConfiguration: 'OPTIONAL'`, `SoftwareTokenMfaConfiguration: { Enabled: true }`; print only OK or the error code.
- [ ] **Step 6: Implement `staff-mfa-check.mjs`** (manual integration check against Floci, never in the default test glob). It: creates a throwaway user with `custom:role = staff_pending` and `custom:org_id` of a random UUID; sets a permanent password; `InitiateAuth` for tokens; `AssociateSoftwareToken`; `VerifySoftwareToken` with `totp(secret)`; `SetUserMFAPreference` (software token enabled and preferred); `AdminUpdateUserAttributes` role to `staff`; then `InitiateAuth` again and expects `ChallengeName === 'SOFTWARE_TOKEN_MFA'`; answers it with a fresh `totp` code and expects an `IdToken` whose `custom:role` is `staff`. Deletes the user at the end. Prints one PASS/FAIL line per step.
- [ ] **Step 7: Run** `node scripts/enable-pool-mfa.mjs` then `node scripts/staff-mfa-check.mjs`. Expected: every step PASS. **If any step fails, stop and tell the user: the design needs a fallback (record which step failed and what Floci answered).**
- [ ] **Checkpoint:** `node --test scripts/totp.test.mjs` passes.

### Task 2: Authorizer accepts `staff`, refuses `staff_pending`

This also fixes a gap in the earlier region-scope work: the deployed authorizer ignores `staff`, so a staff login could never act.

**Files:**
- Modify: `infra/amplify-data/lambda/authorizer/claims.mjs` (`STAFF_ROLES`)
- Test: `infra/amplify-data/lambda/authorizer/claims.test.mjs`

**Interfaces:**
- Consumes: `toResolverContext(payload)` as it is.
- Produces: `toResolverContext` returns a context for role `staff` with an org; `null` for `staff_pending`.

- [ ] **Step 1: Write the failing tests** (names): `staff with an organization acts as staff` (payload role `staff`, sub `u1`, valid org uuid → `{ role: 'staff', userId: 'u1', orgId }`); `staff without an organization is refused` (→ `null`); `staff_pending is refused` (→ `null`).
- [ ] **Step 2: Run** `node --test lambda/authorizer/claims.test.mjs`. Expected: the first and third FAIL.
- [ ] **Step 3: Add `'staff'` to `STAFF_ROLES`** in `claims.mjs`. Leave `staff_pending` out on purpose and say so in a one-line comment.
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Checkpoint:** `node --test lambda/authorizer/claims.test.mjs lambda/domain/*.test.ts` all pass.

### Task 3: Signed invitation tokens

**Files:**
- Create: `infra/amplify-data/lambda/domain/staff-invitations.ts`
- Test: `infra/amplify-data/lambda/domain/staff-invitations.test.ts`

**Interfaces:**
- Produces:
  - `INVITATION_TTL_HOURS = 24`
  - `newInvitation(now: Date): { id: string; expires_at: string }` (random uuid, ISO expiry)
  - `signToken(secret: string, id: string, expiresAt: string): string` → `"<id>.<hex hmac>"`
  - `type InvitationRow = { id: string; expires_at: string; used_at?: string | null; revoked_at?: string | null }`
  - `checkToken(secret: string, token: string, row: InvitationRow | undefined, now: Date): { ok: true; id: string } | { ok: false }`

- [ ] **Step 1: Write the failing tests** (names and assertions): `a fresh token checks out` (ok true, id equal); `expires after 24 hours` (`expires_at - now = 24 h`; one second past → `{ ok: false }`); `a used or revoked invitation fails`; `a tampered signature fails`; `a token signed with another secret fails`; `a malformed token or a missing row fails`; `every failure is the same value` (`deepEqual` of the failures from expired, used, revoked, tampered, unknown).
- [ ] **Step 2: Run** `node --test lambda/domain/staff-invitations.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** HMAC-SHA256 over `` `${id}.${expiresAt}` ``; compare with `timingSafeEqual` after length check; the row's `expires_at` must be what was signed.
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Checkpoint:** all `lambda/domain/*.test.ts` pass.

### Task 4: Backend tables, domain and operations

**Files:**
- Modify: `infra/amplify-data/amplify/data/schema.graphql` (new `StaffInvitation`, `StaffActivity`; `StaffMember` gains `disabled_at: AWSDateTime`, `confirmed_at: AWSDateTime`)
- Modify: `infra/amplify-data/amplify/backend.ts` (give the Api function `SECRET_NAME` and `secretsmanager:GetSecretValue`; add `'StaffInvitation'` to `MAILED_MODELS`)
- Create: `infra/amplify-data/lambda/domain/staff-accounts.ts`, `infra/amplify-data/lambda/api/ops/staff.ts`
- Modify: `infra/amplify-data/lambda/api/ops/index.ts` (register `staffOps`), `infra/amplify-data/lambda/api/ops/agencies.ts` (`BranchesAdmin` staff rows gain `status`)
- Test: `infra/amplify-data/lambda/domain/staff-accounts.test.ts`

**Interfaces:**
- Consumes: Task 3 (`newInvitation`, `signToken`, `checkToken`); `requireWriter` (`domain/auth.ts`); `resolveSecretEnv` from `functions/_lib/secrets` (path five levels up from `lambda/api/ops`).
- Tables: `StaffInvitation { id, organization_id @index(byOrg), user_id @index(byUser), email, display_name, expires_at, used_at, revoked_at, created_by_user_id, created_at }`; `StaffActivity { id, organization_id @index(byOrg, sort created_at), user_id, kind, actor_user_id, created_at, detail }`. `kind` is one of `created | invited | resent | activated | disabled | mfa_reset | branches_changed`.
- Produces in `staff-accounts.ts`:
  - `createStaffRecord(caller: Caller, input: { user_id: string; email: string; display_name: string; branch_ids: string[] }): Promise<{ invitation_id: string }>` writes `StaffMember` (id = Cognito sub, role `staff`), assignments, a `StaffInvitation`, activity `created`/`invited`.
  - `resendInvitation(caller, userId: string): Promise<{ invitation_id: string }>` sets `revoked_at` on every open invitation of the user, inserts a new one, activity `resent`.
  - `offboardStaff(caller, userId: string): Promise<void>` removes the user's `StaffAssignment` rows, sets `StaffMember.disabled_at`, revokes open invitations, activity `disabled`.
  - `resetStaffMfa(caller, userId: string): Promise<{ invitation_id: string }>` clears `confirmed_at`, activity `mfa_reset`, then behaves like `resendInvitation`.
  - `checkInvitation(env: { INVITE_SECRET?: string }, token: string): Promise<{ ok: true; user_id: string; email: string; display_name: string } | { ok: false }>`
  - `confirmActivation(env, token: string): Promise<{ ok: boolean }>` re-checks the token, sets `used_at`, `StaffMember.confirmed_at`, activity `activated`.
  - `listStaffActivity(caller): Promise<Item[]>` newest first, manager only.
- Operations (`staff.ts`): `CreateStaffRecord`, `ResendStaffInvitation`, `OffboardStaff`, `ResetStaffMfa`, `StaffActivityList` with `WRITERS`; `StaffInvitationCheck`, `ConfirmStaffActivation` with `ANYONE` (public activation page). Variable names: `user_id`, `email`, `display_name`, `branch_ids`, `token`.
- `BranchesAdmin` staff rows add `status: 'invited' | 'confirmed' | 'disabled'` (disabled_at wins, then confirmed_at, else invited).

- [ ] **Step 1: Write the failing tests** (names): `only a manager or org_admin may create a staff record` (calls with roles `staff`, `viewer`, `user` reject with code `permission_denied` before any database call); the same for `resendInvitation`, `offboardStaff`, `resetStaffMfa`, `listStaffActivity`; `checkInvitation answers { ok: false } when the secret is missing`; `the status of a staff member` (a pure helper `staffStatus(row): 'invited' | 'confirmed' | 'disabled'` exported from `staff-accounts.ts`, three cases).
- [ ] **Step 2: Run** `node --test lambda/domain/staff-accounts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the domain file and the schema/backend edits.** Writes use `transact` with `Put`/`Delete` items as in `domain/branches.ts`. A staff member's open invitations are found through the `byUser` index.
- [ ] **Step 4: Implement `ops/staff.ts` and register it; extend `BranchesAdmin`.** Also make `setStaffBranches` in `lambda/domain/branches.ts` write a `branches_changed` activity row (detail: the new branch ids). The "first sign-in" of the spec is recorded as the `activated` row, written when the person finishes activation.
- [ ] **Step 5: Add `lambda/api/staff-accounts.int.test.ts`** following `lambda/domain/requests.int.test.ts` (run against Floci): create → invitation row exists → resend revokes the first → offboard removes assignments → `checkInvitation` of a revoked token is `{ ok: false }`.
- [ ] **Step 6: Run** `node --test lambda/domain/staff-accounts.test.ts`, then `node -e "import('./lambda/api/ops/index.ts').then(m=>console.log(Object.keys(m.OPS).length))"`. Expected: PASS and the operation count printed (previous total plus 7).
- [ ] **Checkpoint:** all `lambda/domain/*.test.ts` pass.

### Task 5: The invitation email

**Files:**
- Modify: `infra/amplify-data/lambda/domain/mail-events.ts` (`handleChange` routes model `StaffInvitation`; `MailDeps` gains `inviteSecret?: string`)
- Modify: `infra/amplify-data/lambda/mailer/index.ts` (pass `inviteSecret: env.INVITE_SECRET`)
- Modify: `functions/_lib/mail-templates.ts` (add `staffInvitationMail`)
- Test: `infra/amplify-data/lambda/domain/mail-events.test.ts` (create if absent, using a fake `Mailer`)

**Interfaces:**
- Consumes: Task 3 `signToken`, `checkToken`.
- Produces: `staffInvitationMail(name: string, link: string): MailContent` (French subject and text; the text states the 24-hour validity; never a password).

- [ ] **Step 1: Write the failing tests** (names): `an inserted invitation sends one mail to its address` (fake mailer records one message to `row.email`); `the link is APP_URL + /erp/invitation?token= and the token passes checkToken`; `no mail on MODIFY or REMOVE`; `a revoked or used invitation sends nothing`; `the mail text has no password`; `without INVITE_SECRET nothing is sent and the handler reports it`.
- [ ] **Step 2: Run** `node --test lambda/domain/mail-events.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `onStaffInvitation(change, deps)`** in `mail-events.ts` and the template; route it in `handleChange`.
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Checkpoint:** all `lambda/domain/*.test.ts` and `functions` vitest (`cd functions && npx vitest run`) pass.

### Task 6: Server routes for create, resend, disable, reset (web)

**Files:**
- Modify: `web/src/lib/server/auth.ts` (`SessionClaims` gains `orgId: string` from `custom:org_id`; add `requireManager(session)` allowing only `org_admin` and `manager`)
- Create: `web/src/lib/server/staff-accounts.ts`, `web/src/app/api/staff/route.ts`
- Test: `web/src/lib/server/staff-accounts.test.ts`, `web/src/app/api/staff/route.test.ts`

**Interfaces:**
- Consumes: `cognito`, `userPoolId` (`web/src/lib/server/cognito.ts`); `clientQuery(accessToken, query, variables)` (`web/src/lib/site/public-api.ts`); Task 4 operations.
- Produces in `staff-accounts.ts` (all admin calls via `cognito(..., { admin: true })`):
  - `createStaffLogin(input: { email: string; name: string; orgId: string }): Promise<{ userId: string }>`: `AdminCreateUser` with `MessageAction: 'SUPPRESS'`, a random 24-character temporary password, `custom:role = staff_pending`, `custom:org_id`, `email_verified = true`. `UsernameExistsException` becomes `StaffError('email_taken')`.
  - `deleteStaffLogin(email: string): Promise<void>` (`AdminDeleteUser`, rollback).
  - `lockStaffLogin(email: string): Promise<void>`: `AdminDisableUser`, `AdminUserGlobalSignOut`, `AdminUpdateUserAttributes` role `staff_pending`.
  - `resetStaffAuthenticator(email: string): Promise<void>`: `AdminSetUserMFAPreference` software token disabled, role `staff_pending`.
- Route `POST /api/staff` with body `{ action: 'create' | 'resend' | 'disable' | 'resetmfa', ... }` and `Authorization: Bearer <id token>`; 401 without a valid session, 403 for non-managers.

- [ ] **Step 1: Write the failing tests** (names): `a non-manager gets 403 on every action`; `create makes the login, then the record, in that order`; `create deletes the login again when the record call fails`; `an existing email answers 409 email_taken and writes no record`; `disable disables, signs out everywhere, then removes the agencies`; `resetmfa disables the second step and sets the role back to staff_pending`; `no action sends a password in any response`. Mock `cognito` and `clientQuery`.
- [ ] **Step 2: Run** `npx vitest run src/lib/server/staff-accounts.test.ts src/app/api/staff/route.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The route reads the manager's token from the header, `requireSession` then `requireManager`; the org id comes from the token, never from the body.
- [ ] **Step 4: Run again, then** `npx tsc --noEmit -p .`. Expected: PASS and no type errors.
- [ ] **Checkpoint:** `npx vitest run` (whole web suite) passes.

### Task 7: Activation route and page (web)

**Files:**
- Create: `web/src/app/api/staff/activate/route.ts`, `web/src/app/erp/invitation/page.tsx`, `web/src/components/staff/activation-flow.tsx`
- Modify: `web/package.json` (add `qrcode` and `@types/qrcode`)
- Test: `web/src/app/api/staff/activate/route.test.ts`, `web/src/components/staff/activation-flow.test.tsx`

**Interfaces:**
- Consumes: Task 4 public operations through `publicQuery`; `cognito` helpers; Task 1 flow order.
- Produces: `POST /api/staff/activate` with `{ action: 'check' | 'setpassword' | 'verify', token, ... }`:
  - `check` → `{ email, name }` or the generic `{ error: 'invalid-invitation' }`.
  - `setpassword` (`token`, `password`) → `AdminSetUserPassword` permanent, `InitiateAuth` for tokens, `AssociateSoftwareToken` → `{ setupKey, otpauthUrl, accessToken }`.
  - `verify` (`token`, `code`, `accessToken`) → `VerifySoftwareToken`, `SetUserMFAPreference`, `AdminUpdateUserAttributes` role `staff`, then `ConfirmStaffActivation` → `{ ok: true }`.
  - Password rule: same minimum as the client sign-up (reuse its validator).
- Page `/erp/invitation?token=…` shows three steps: choose password → scan code (QR from `otpauthUrl`, plus the setup key as text) and enter a code → done with a link to sign in.

- [ ] **Step 1: Write the failing tests** (names): `unknown, expired, used and revoked tokens all answer the same error`; `setpassword does nothing for an invalid token` (no Cognito call made); `a wrong code leaves the role unchanged and the invitation unused` (no `AdminUpdateUserAttributes`, no `ConfirmStaffActivation`); `a right code switches the role then confirms`; `the flow shows the setup key and moves through three steps` (component test with mocked fetch).
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement route and flow component;** install the dependency with an exact pinned version.
- [ ] **Step 4: Run again plus** `npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Checkpoint:** `npx vitest run` passes.

### Task 8: Sign-in asks for the code (web)

**Files:**
- Modify: `web/src/app/api/auth/route.ts` (`signIn` returns `{ challenge: 'mfa', email, challengeSession }` for `SOFTWARE_TOKEN_MFA`; new action `mfa`), `web/src/components/auth-provider.tsx` and the staff sign-in page `web/src/app/erp/connexion/page.tsx` (a code step)
- Test: `web/src/app/api/auth/route.test.ts` (extend), the sign-in page test beside it

**Interfaces:**
- Produces: action `mfa` with `{ email, code, challengeSession }` → `RespondToAuthChallenge` (`SOFTWARE_TOKEN_MFA`, `SOFTWARE_TOKEN_MFA_CODE`) → `{ session }`.

- [ ] **Step 1: Write the failing tests** (names): `signin returns an mfa challenge when Cognito asks for the code`; `mfa with a right code returns a session whose role is staff`; `mfa with a wrong code answers an error and no session`; `the sign-in page shows the code field after the password` (follow how the existing new-password step is tested).
- [ ] **Step 2: Run** `npx vitest run src/app/api/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the existing `new-password` challenge untouched.
- [ ] **Step 4: Run again plus** `npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Checkpoint:** `npx vitest run` passes.

### Task 9: Manager screens (web)

**Files:**
- Create: `web/src/components/domain/staff-create-dialog.tsx` (multi-step `QuestionFlow`: name, email, agencies with `MultiChips`), `web/src/components/domain/staff-actions.tsx` (resend, reset authenticator, disable with a confirm step), `web/src/components/domain/staff-activity.tsx`
- Modify: `web/src/app/erp/(app)/administration/agences/page.tsx` (new button, status chip, actions, activity list; query adds `status` and `StaffActivityList`)
- Modify: `web/src/i18n/messages/{fr,en,ar}/properties.ts` (strings under `branchForm`), `{fr,en,ar}/errors.ts` (`email_taken`)
- Test: `web/src/components/domain/staff-create-dialog.test.tsx`

**Interfaces:**
- Consumes: Task 6 route (`fetch('/api/staff', …)` with the stored session token — reuse the helper `graphql` uses to read it).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests** (names): `the email must look like an email before the flow moves on`; `at least one agency must be chosen`; `submit posts action create with name, email and branch_ids`; `an email_taken answer shows the translated message`; `disable asks for confirmation before posting`.
- [ ] **Step 2: Run** `npx vitest run src/components/domain/staff-create-dialog.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the components and wire the page; add the strings in the three languages.**
- [ ] **Step 4: Run again plus** `npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Checkpoint:** `npx vitest run` passes.

### Task 10: Secrets, deploy and live verification

**Files:**
- Create: `infra/amplify-data/scripts/set-invite-secret.mjs` (adds a random `INVITE_SECRET` to the Floci secret `erp-functions-config`, keeping the other keys; prints only that it was set)

- [ ] **Step 1: Run** `node scripts/set-invite-secret.mjs`. Expected: `INVITE_SECRET set`.
- [ ] **Step 2: Deploy to dev first:** `npm run deploy -- dev` from `infra/amplify-data`. Expected: `UPDATE_COMPLETE`.
- [ ] **Step 3: Run** `node scripts/enable-pool-mfa.mjs` and `node scripts/staff-mfa-check.mjs`; run the Task 4 integration test. Expected: all PASS.
- [ ] **Step 4: Deploy to main:** `npm run deploy -- main --yes`. Expected: `UPDATE_COMPLETE`. Confirm the new tables are ACTIVE.
- [ ] **Step 5: Test send.** Ask the user for a test address; create one staff account through the screen and confirm the email arrives (SMTP delivery is unverified until now).
- [ ] **Step 6: Walk the whole path by hand:** create → open link → password → code → sign in with code → dashboard shows only the assigned agencies → manager disables → the old tab's next request fails and sign-in is refused.
- [ ] **Checkpoint:** record the outcome of each step in the final report to the user.
