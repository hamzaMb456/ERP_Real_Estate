# Handoff: visitor requests, favorites and the booking card (2026-10-23)

Branch `vitrine`. Nothing is committed or pushed. Local checks: `tsc` clean, `eslint` clean, vitest 589 passing, DB tests 0006, 0007 and 0008 passing on the local Postgres (`bash scripts/db-local.sh up`).

## What a visitor can do now

On `/logement/<id>` the sticky card replaces the old "contact" card:

- **Demander à louer** (units for rent only): start date (today to +1 year) and lease duration (3, 6, 12, 24, 36 months or 1 to 120 typed).
- **Demander une visite** (rent and sale): a day (tomorrow to +30 days, no Sunday) and a half-hour slot 09:00 to 17:30. Slots already confirmed by staff are greyed out.
- Both ask for name and phone (e-mail and message optional) and show a thank-you state.
- **Favorites**: a live heart on every card and on the unit page, kept in the browser (`localStorage`), listed on `/favoris` (new "Favoris" link in the header).
- **Share**: copy link, WhatsApp.
- **Quick filters** above the results: Meublé, 2+/3+/4+ pièces, Disponible maintenant (plain links, they keep the list or map view).
- The map of the unit and the list/map toggle on the search page already existed.

## What staff see in the ERP

- **Demandes de location** (`/erp/baux/demandes`, was a placeholder): status chips with counts, search, a card per request with call and e-mail links, the unit, the start date and duration, the visitor's message and an internal note. Actions: contacted, accept, decline, close, reopen, and "Créer un bail" (opens the new-lease form with the unit chosen).
- **Visites** (`/erp/visites`, new nav item under Calendrier): same board. "Confirmer la visite" creates a half-hour `viewing` appointment in the calendar and confirms the request in ONE GraphQL request. Two confirmed visits can never share a slot (unique index; the page words the error). "Marquer effectuée" / "Annuler la visite" also update the calendar appointment.
- Each new request notifies every staff member (bell), linking to the right page.

## To apply on the legacy backend (the steps of the time), in this order

1. `db/migrations/0007_unit_details.sql` (if not yet applied).
2. `db/migrations/0008_visitor_requests.sql` (safe to run twice). Test with `db/tests/0008_visitor_requests.test.sql`: the expected result is the error "OK: all visitor request tests passed".
3. From the main folder: `node scripts/apply-hasura-permissions.mjs` (you type the admin secret). This also fixes the anonymous photos (403): the public role can now read the file records and the bucket of published listings.
4. Check on `/logement/<id>` in a private window: photos show, the request dialogs open, a test request arrives under `/erp/baux/demandes` and `/erp/visites`.

## Abuse protection and what is NOT covered

Database side: 3 requests per phone (digits only) per hour and per kind, 30 per organization per 10 minutes, identical pending request refused, names without control, `<`, `>` or bidi characters, strict e-mail format (no `?` or `&`, so a `mailto:` link cannot be abused), a hidden honeypot field.

Known gap (security review): the data-layer endpoint is public, so a determined attacker can call the two mutations directly, rotate fake phone numbers and exhaust the organization cap (visitors then see "trop de demandes") and flood staff notifications. SQL cannot see an IP address. Before a public launch add, at the edge or at the backend, a per-IP rate limit on the two mutations and a CAPTCHA token (for example Cloudflare Turnstile) checked by the server action.

Other notes from the review: a request keeps its unit from being deleted (archive units instead); `public_listings` is readable for every organization of the database (fine with one agency, add an organization filter if the database ever hosts several).

## Not done (decided or left)

- Reviews and online payment: skipped on purpose.
- Map beside the results with price pins: the list/map toggle exists; a split view was not built.
- "Good to know" block, agency/contact page, report-a-listing: not built.
- Favorites live in the browser only; there is no visitor account.
- The photo 403 is only fixed once step 3 above is run.
