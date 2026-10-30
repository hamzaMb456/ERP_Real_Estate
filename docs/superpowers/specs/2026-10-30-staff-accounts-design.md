# Regional staff accounts: invitation, authenticator step, offboarding

Date: 2026-10-30. Status: draft awaiting approval.

## Intent

Regional staff (role `staff`) work only inside the agencies assigned to them (see the region-scope work already built).
Today nothing in the app creates a staff login or a staff record: only the client sign-up route and demo scripts create
users. This design adds the missing piece: a manager creates a staff account, the person activates it from an email
link, and a manager can lock it again at once.

The point is security as much as convenience: the manager never knows the person's password, an account does nothing
until two separate things have happened, and a leaver is cut off in one click.

## Goals

- A manager or org_admin creates a staff account from the Agences et équipes screen (multi-step form, like the other forms).
- The person activates the account from a one-time email link: they choose their own password and set up an
  authenticator app (a time-based code). Both are required.
- Required for `staff` only. Managers and org_admins keep their current sign-in.
- An account that is not fully activated, or has no agency, can do nothing.
- A kill switch disables the account, signs out every session and removes its agencies.
- An activity trail records who created the account, when the person first signed in, and agency changes.

## Non-goals

- No second-step requirement for managers or org_admins.
- No change to client (public site) accounts or their sign-up.
- No self-service staff sign-up. Only a manager creates staff.
- No SMS codes. Authenticator app only.

## Anti-goals (would make this a failure)

- The manager, or anyone, can read or set a staff member's password.
- A staff member can use the ERP before finishing activation.
- A leaked database lets someone activate or sign in as a staff member.

## The flow (decided with the user)

1. **Create.** The manager enters name, email and agencies. The system creates the login with the `staff` role and a
   random password nobody sees, a staff record, the agency assignments, and a one-time invitation.
2. **Invite.** An email carries a link. The link holds a random token, valid 24 hours, usable once. Only a hash of the
   token is stored. The email never contains a password.
3. **Key 1, identity.** On the link the person chooses a password and enrols an authenticator app (scan a code, enter
   one valid code). The account becomes "confirmed" only after both.
4. **Key 2, scope.** The person sees data only for the agencies assigned to them. With none, they see an empty dashboard.
5. **First screen.** The dashboard they already get, limited to their agencies.
6. **Resend.** The manager can send a new invitation. The old link stops working.
7. **Kill switch.** The manager disables the account, signs out all sessions and removes the agencies in one action.
8. **Lost phone (my call).** The manager resets the authenticator step; the person enrols again from a fresh
   invitation link.

## What I found in the code (constraints)

- Cognito runs on the local Floci emulator. The app already calls Cognito admin operations from server code with a
  shared helper (`web/src/lib/server/cognito.ts`) and a demo script creates users with `AdminCreateUser`.
- The sign-in already handles the "choose your password on first sign-in" challenge (`newpassword` action in
  `web/src/app/api/auth/route.ts`).
- The emulator answers the authenticator-app, sign-out and disable operations. A full sign-in with the second step is
  not yet tested.
- The role comes from the login token claim `custom:role`; the backend authorizer maps claims to the role.
- The mail sender (Mailer function, SMTP settings read from a secret) exists for appointment emails.
- Roles and agency scope are enforced in the backend operations, not in the browser.

## Security rules the builder must keep

- Cognito admin calls run only on the server. The browser never holds admin rights.
- Only `manager` and `org_admin` may create, resend, disable or reset. Checked on the server.
- Invitation tokens: signed with a server secret (HMAC), not stored at all; the invitation row keeps only its id, expiry and used/revoked marks. 24-hour expiry, single use. Resend invalidates the previous token. (Changed from "stored hashed" during planning: the mailer must put the token in the email, so a stored hash could not be used; a signed token needs no stored secret material and a database leak alone cannot produce a valid link.)
- The authorizer treats a `staff` login as having no role until its second-step flag is set by the server after a
  verified code. This is the real enforcement: a staff login that skipped the step is refused by the backend even if
  the sign-in page is bypassed.
- Disabling an account also signs out all its sessions and deletes its agency assignments.
- Same answer for unknown or used tokens, so the activation page cannot be probed.

## Data (additions)

- An invitation record: hashed token, account id, expiry, used-at, created-by.
- The "second step confirmed" flag is the login role itself: `staff_pending` until activation completes, then `staff`. The authorizer accepts only `staff`.
- An activity record for the trail. The builder may reuse an existing log table if there is one.

## Left to the builder

- Where each step runs (Next.js server route versus backend operation) as long as the security rules hold.
- How the Cognito pool is configured for the authenticator step, once tested against the emulator.
- Exact email wording (French first, like the other messages).
- The shape of the activity trail.

## My calls (change if wrong)

- Email already used by a client account: refuse and say so; staff and client accounts stay separate.
- Lost phone: manager reset plus a new invitation, not a self-service reset.
- Trail kept as simple records shown to the manager; no separate audit screen in this pass.

## Open questions only the user can answer

1. Is the email sending (SMTP settings) really configured and working on this setup today?
2. Which public web address should the invitation link point to?

## Tests to expect

- Token rules: expiry, single use, resend invalidates, wrong token answers the same as an expired one.
- A staff login without the confirmed flag is refused by the backend operations.
- Disable removes sessions and agencies; a disabled account cannot sign in.
- Only manager and org_admin can run the four actions.
