# Front office (vitrine) — public site for renters and buyers (design)

Date: 2026-10-22 · Branch: `vitrine` · Status: **draft — questions answered, awaiting final approval**

## 1. Intent

The agency needs a public website where people find an apartment or a unit and act on it themselves:
a renter applies to rent, a buyer makes an offer or reserves, both book visits and follow their file
in a client space. Everything they do lands in the ERP as real records that staff process (rent
requests, visits, purchase offers, reservations, payments), so the public site, the leasing work, the
sales work and finance share one source of truth.

This **overrides decision D-010** ("no renter/owner portal in the MVP") and the scope-matrix line
"Prospect / Buyer: no access, the sales agent manages the record", by user decision of 2026-10-21.

## 2. Goals, non-goals, anti-goals

**Goals**
- Six public screens designed in Stitch, built in the existing Next.js app with the GSAP design system:
  home, search (rent / buy), unit page, rental application, purchase offer / reservation, client space.
- Real data: listings come from the ERP units the staff choose to publish; every client action creates
  an ERP record; staff have ERP pages to process those records; the client sees the outcome.
- Client accounts (sign up, sign in, email verification, password reset).
- Public site at `/`; the ERP moves to `/erp`.

**Non-goals (this project)**
- Online card payment through a payment gateway (see §13 — needs a merchant account; until then
  "Payer" means bank transfer + proof upload, confirmed by staff).
- Electronic signature of leases or sales documents; notary workflow; commission rules.
- Owner portal; mobile apps; a CMS for marketing pages; listing syndication to portals.
- Full Finance module (rent invoicing, arrears, accounting exports): only the payments the client
  space needs (§6.6).

**Anti-goals (a failure even if it "works")**
- A client can see or change anything that is not theirs, or another organization's data.
- The ERP looks or behaves differently for staff after the move, apart from the `/erp` prefix.
- Client submissions that staff never see (no ERP inbox, no notification).
- Public pages that need JavaScript to show listings (they render on the server for SEO and speed).
- Personal documents (ID, payslips, bank approvals) readable by anyone but the client and staff.

## 3. Decisions taken

| # | Decision | By |
|---|---|---|
| F1 | Public site at `/`, ERP at `/erp/…` (staff login `/erp/connexion`). Old ERP URLs redirect (`/biens/…` → `/erp/biens/…`, same for `/baux`, `/contacts`, `/calendrier`, `/administration`, `/connexion`). | User |
| F2 | Full flow now: client accounts + new tables so forms land in the ERP. | User |
| F3 | Look: Stitch project `projects/18117543231921807105`, design system « Emerald Vitrine » (`assets/13284678866910658658`). Screens: Accueil `73944003ff204a708656f918ec88b559`, Logements à louer `32680b4e46ea4f86a7758d0df5727ee7`, Fiche logement `44c57dc4b6b54e2086e11282b3110c62`, Demande de location `d0f8f73e731b4c72b2a4bedcea7e1fa3`, Faire une offre `23bbd2a4b3ff4b0cb5b20854083c4963`, Espace client `03373468ac23464190264a579d734764`. | User |
| F4 | Built with the existing GSAP design system (icons from `@/components/icons`, gloss buttons, `PageHeader`, `ScrollStagger`, `gsapTokens`, reduced-motion safe). | User |
| F5 | One agency per deployment for the public site: it serves the organization `NEXT_PUBLIC_AGENCY_ORG_ID`. Client writes never trust a client-supplied organization: SQL functions take it from the unit. | My call (security) |
| F6 | All client writes go through `SECURITY DEFINER` SQL functions exposed as Hasura mutations (pattern of `activate_lease`), never direct table inserts. | My call |
| F7 | Text in the i18n catalogs (fr, en, ar), French first; amounts in TND with the existing formatters. | Existing convention |
| F8 | Rent requests reuse the table planned in the leases spec (Plan C, `rent_requests`, source `web`), extended with the application fields. Plan C is absorbed here. | My call |

## 4. URL map

Public (route group `(site)`, public layout: top bar, footer, language switch):

| Path | Screen |
|---|---|
| `/` | Accueil |
| `/louer`, `/acheter` | Search results (one page, mode from the path); filters in the query string |
| `/logement/[listingId]` | Unit page (rent or sale listing) |
| `/logement/[listingId]/demande` | Rental application (4 steps; sign-in required before sending) |
| `/logement/[listingId]/offre` | Purchase offer or reservation (sign-in required) |
| `/compte/connexion`, `/compte/inscription`, `/compte/mot-de-passe` | Client auth |
| `/espace-client` (+ `/demandes`, `/offres`, `/bail`, `/paiements`, `/documents`, `/visites`, `/favoris`, `/profil`) | Client space |

ERP: everything under `/erp` (route group moved, `navigation.ts`, breadcrumbs, `sectionOf`, every
`href` / `router.push` literal, E2E specs). A client user hitting `/erp/*` is sent to `/espace-client`;
an anonymous user hitting `/erp/*` goes to `/erp/connexion`; staff may browse the public site.

## 5. Accounts and permissions

- Same Nhost project. Staff keep roles `org_admin | manager | viewer` and `metadata.organization_id`.
- New Hasura role **`client`** for public sign-ups (Nhost email + password, email verification on).
  New Hasura role **`public`** (unauthenticated) to read published listings.
- The user configures in the Nhost dashboard: default role for sign-ups = `client`, allowed roles for
  sign-ups = `[client]`, email verification on, the site's redirect URLs. Staff accounts keep being
  created by an admin with their roles. Exact steps go in the plan.
- A client is linked to one ERP contact: `client_accounts (user_id pk, contact_id, organization_id,
  created_at)`, created by `ensure_client_contact()` on the first client action: it reuses a contact of
  the agency with the same verified email or creates one; the action adds role `renter` or `buyer`.
- **`public` role:** select on the `public_listings` view only (published, not archived; no owner, no
  internal notes) and on the photos of published listings (§6.1).
- **`client` role:** select only rows whose `client_user_id = X-Hasura-User-Id` (requests, offers,
  reservations, visits, payments, files, favourites) and their own lease through their contact. No
  direct insert/update/delete: mutations only through the §7 functions.
- Personal documents go to a new private bucket `client-files`: the uploader and the organization's
  staff can read; nobody else.

## 6. Data model (new migrations)

Numbering: `0005_listings_rent_requests.sql`, `0006_sales_offers.sql`, `0007_client_space.sql`.
The leases spec's later slice "inspections and deposit" moves to `0008`.

### 6.1 Listings (0005)
`listings`: `unit_id`, `kind` (`rent | sale`), `status` (`draft | published | paused | closed`),
`title`, `description`, `price` (monthly rent or sale price, numeric(12,3)), `charges` (rent),
`deposit_months` (rent, default 2), `reservation_deposit` (sale, default 10 000),
`reservation_days` (sale, default 15), `available_from`, `furnished`, `amenities text[]`,
`virtual_tour_url`, `published_at`. One non-closed listing per `(unit_id, kind)`. Publishing needs a
price and at least one photo. Photos are the unit's `property_files` photos;
`listing_photos (listing_id, property_file_id, position, hidden)` orders or hides them.
View `public_listings`: listing + unit (type, rooms, surface, floor) + property (city, governorate,
coordinates rounded to about 100 m) + photos + availability (`available`, or `reserved` when an active
reservation or accepted offer exists). Rented or sold units leave search.

### 6.2 Rent requests (0005, absorbs Plan C)
`rent_requests` as in the leases spec §3.2, plus `listing_id` (null for staff-entered requests),
`client_user_id`, `occupants`, `employment_status`, `employer`, `job_title`, `monthly_income`,
`desired_duration_months`, `guarantor_name`, `guarantor_relation`, `guarantor_phone`,
`guarantor_income`, `message`, `submitted_at`. Status `draft | submitted | in_review | accepted |
rejected | converted | closed` (Plan C's `open` = `submitted | in_review`).
`rent_request_files (request_id, storage_file_id, category: id | income | guarantor | other)`.
View `rent_request_matches` and function `convert_rent_request` as in Plan C.

### 6.3 Visits (0005)
Reuse `appointments`: status gains `requested` (asked by a client, not yet confirmed by staff);
new columns `listing_id`, `client_user_id`. Offered slots = the agency's visit hours (organization
setting, default Monday–Saturday 09:00–17:00, 30 minutes) over the next 14 days, minus slots that
already hold a `requested` or `planned` appointment for the same unit.

### 6.4 Purchase offers, reservations, sales (0006)
`purchase_offers`: `listing_id`, `unit_id`, `contact_id`, `client_user_id`, `amount`, `financing`
(`cash | loan | mixed`), `bank`, `down_payment`, `desired_signing_date`, `valid_until`, `status`
(`submitted | countered | accepted | rejected | withdrawn | expired`), `counter_amount`,
`decided_at`, `decided_by`; `purchase_offer_events` keeps the history (actor, action, amount, time).
`reservations`: `listing_id`, `unit_id`, `contact_id`, `client_user_id`, `deposit_amount`,
`expires_at`, `status` (`pending_payment | active | expired | cancelled | converted`).
At most one active reservation or accepted offer per unit (constraint).
`sales`: created when an offer is accepted or a reservation becomes active: `unit_id`,
`buyer_contact_id`, `price`, `stage` (`compromis | echeancier | acte | done | cancelled`),
`compromis_signed_on`, `deed_on`; `sale_installments (sale_id, due_on, amount, label)`.
Stage `done` transfers ownership with the existing ownership functions (project 1) and sets the unit
`sold`.

### 6.5 Client extras (0007)
`client_favorites (user_id, listing_id)`; `client_alerts (user_id, mode, filters jsonb, email)` for
« Créer une alerte » (emails through the existing notification e-mail function pattern).

### 6.6 Payments (0007)
`payments`: `organization_id`, `contact_id`, `client_user_id` (null when staff-entered), the target
(`lease_id` + `period` | `sale_installment_id` | `reservation_id`), `amount`, `method`
(`transfer | cash | cheque | card`), `status` (`declared | confirmed | rejected`), `paid_on`,
`proof_file_id`, `confirmed_by`, `confirmed_at`, `reject_reason`. A client declares a transfer with a
proof; staff confirm. A confirmed reservation payment makes the reservation `active`.
« Prochain loyer » = rent + charges of the client's active lease for the next due date
(`payment_day`); unpaid while no confirmed payment exists for that period.

## 7. Functions (one atomic call each, SECURITY DEFINER, explicit checks)

Client (`client` role): `submit_rent_application(listing_id, fields, file_ids)`,
`request_visit(listing_id, starts_at)`, `cancel_visit(appointment_id)`,
`submit_purchase_offer(listing_id, fields, file_ids)`, `respond_to_counter(offer_id, accept | reply,
amount)`, `withdraw_offer(offer_id)`, `reserve_listing(listing_id)`, `declare_payment(target, amount,
paid_on, proof_file_id)`, `toggle_favorite(listing_id)`, `save_alert(...)`,
`request_lease_renewal(lease_id)`, `give_notice(lease_id, date)`. Each one checks the listing is
published, that the caller owns the target, takes the organization from the unit, calls
`ensure_client_contact()`, writes, creates a staff notification (existing `notifications`) and
returns the new id.

Staff (`org_admin | manager`): `publish_listing`, `pause_listing`, `review_rent_request(id, status,
note)`, `confirm_visit(appointment_id)`, `counter_offer(id, amount)`, `decide_offer(id, accept |
reject)`, `confirm_payment(id)`, `reject_payment(id, reason)`, `advance_sale(id, stage)`.
Errors carry stable codes mapped to messages in the catalogs.

## 8. ERP-side screens (so nothing dead-ends)

- `/erp/biens/[id]/unites/[unitId]`: « Publication » card (create or edit the listing, photo order,
  price, publish or pause).
- `/erp/baux/demandes`: real list and detail (replaces the placeholder): web applications with their
  documents, matching units, review, convert to a lease (Plan C behaviour).
- `/erp/ventes`: offers and reservations inbox, offer detail with history, counter / accept / reject,
  sale record with stage and installment schedule.
- `/erp/finance/paiements`: declared payments to confirm or reject, with the proof preview.
- Calendar: `requested` visits shown distinctly, one-click confirm.
- Notification bell: one notification per client action.

## 9. Public screens: behaviour beyond the mockups

- Search: server-rendered; filters in the query string (shareable links); 12 results per page; the
  map view uses the existing map component with rounded coordinates.
- Unit page: gallery (existing photo viewer), conditions from the listing, similar listings (same
  kind and city, price within ±25 %). « Visite virtuelle » only shows when `virtual_tour_url` is set.
- Application: 4 steps, saved as `draft` once signed in; the 40 % income rule is a warning, never a
  block; documents uploaded to `client-files`; consent checkbox before sending.
- Offer: offer or reserve at the listed price; offer validity 7, 14 or 30 days; counter-offers are
  answered from the client space.
- Client space: data from §6, an empty state for every card; « Payer maintenant » opens the transfer
  details (agency bank account from an organization setting) and the proof upload.
- All public strings in fr / en / ar; right-to-left works.

## 10. Constraints

- Next.js 16, React 19, Tailwind 4, Nhost (Hasura, Auth, Storage) as today; no new backend.
- Migrations applied by the user in the Nhost SQL editor; Hasura permissions through
  `scripts/apply-hasura-permissions.mjs` (extended). Claude pushes nothing to Nhost.
- Personal data (Tunisian law 2004-63): consent on forms, private documents, a client can close their
  account (data kept only where a lease or sale requires it).
- Tests: vitest for helpers and components; SQL tests for every function (local harness
  `scripts/db-local.sh`); Playwright E2E for browse → apply → staff converts; offer → counter →
  accept; declare payment → staff confirms.

## 11. Delivery slices (one plan each, built in order)

1. **Move, shell, listings:** ERP to `/erp` with redirects; public layout; `listings` and the ERP
   publication card; home, search and unit page on real published units; `public` role.
2. **Accounts, applications, visits:** `client` role and auth pages; `client_accounts`; rental
   application flow; visit requests; ERP rent-request inbox and conversion; calendar `requested`.
3. **Offers, reservations, sales:** offer and reserve flow; ERP sales inbox; sale record and
   installments; ownership transfer on closing.
4. **Client space and payments:** client space pages; declare and confirm payments; favourites and
   alerts; renewal and notice requests.

## 12. Left to the builder

Component breakdown, query shapes, exact column types and indexes, how redirects are implemented
(`next.config` redirects or middleware), loading states, copy beyond the Stitch screens, fixtures.

## 13. Rulings from the builder check (my calls, check them)

- **R1 Competing buyers.** A reservation starts `pending_payment` for 48 h and does not block search.
  The first reservation whose payment staff confirm, or the first accepted offer, wins: confirming or
  accepting is refused while another active reservation or accepted offer exists for the unit. When one
  wins, the other pending reservations are cancelled and the other open offers are rejected, each with
  a notification. A payment linked to a cancelled reservation becomes `refund_due`; staff record the
  refund (`refunded`, with date and proof). `payments.status` is therefore
  `declared | confirmed | rejected | refund_due | refunded`.
- **R2 Sale creation.** Confirming a reservation payment, or accepting an offer, creates the `sales`
  row at stage `compromis` in the same call. The daily job (`functions/lease-daily.ts`) also expires
  offers past `valid_until` and reservations past `expires_at` (outcome of an expired active
  reservation: see §14 Q2).
- **R3 Ownership transfer.** A new SQL function `transfer_unit_ownership(sale_id)` closes the current
  ownerships and opens the buyers' (today the transfer is a client-side update + insert in
  `transfer-dialog.tsx`). Several buyers are allowed: `sale_buyers (sale_id, contact_id,
  share_percent)` (sum 100), the offer's contact is the first buyer, staff add co-buyers.
- **R4 Which units can be listed.** Rent listing: unit `vacant`, or `rented` with a lease ending within
  90 days (`available_from` after the end). Sale listing: unit `for_sale`, or `rented` (sold occupied,
  shown with « Vendu loué »). Activating a lease on the unit closes its rent listing; a sale reaching
  `done` closes its sale listing; staff can also close by hand.
- **R5 Notice and renewal.** `lease_requests (lease_id, contact_id, client_user_id, kind: renewal |
  notice, desired_date, message, status: open | done | declined, handled_by)`. The client functions only
  record the request and notify; staff act with the existing `renew_lease` / `end_lease` from a
  « Demandes du locataire » card on `/erp/baux/[id]`, then mark it done or declined.
- **R6 Documents in the client space.** Clients see the files they uploaded, plus lease files staff
  explicitly share: `lease_files.client_visible boolean default false`, ticked per file on the lease
  page (signed lease, move-in report). Co-renter and guarantor ID files are never shared. No rent-receipt
  PDF generation in this project (V1 in the scope matrix).
- **R7 One agency per Nhost project.** Confirmed as the model (F5). `client_accounts.user_id` stays the
  key; public GraphQL may expose other organizations' published listings, which are public anyway;
  the site always filters by `NEXT_PUBLIC_AGENCY_ORG_ID`.
- **R8 Languages and SEO.** Only French pages are indexed; English and Arabic switch on the client like
  the ERP does today (no language prefix in URLs).
- **R9 Closing an account.** `close_client_account()`: disables the auth user, deletes drafts,
  favourites, alerts and the uploaded files not attached to a submitted request, offer or payment;
  anonymizes the contact (name « Client supprimé », no email, phone or ID) unless it is a party to a
  lease or a sale, in which case only the account link is removed. Records tied to a lease, a sale or a
  payment are kept as long as the law requires for those records.

## 14. Answers from the user (2026-10-22)

- **Q1 Auth e-mails:** Nhost Auth sends verification and password-reset e-mails through **Google
  SMTP** (Nhost's own SMTP is paid), the same Google account and app password as the reminder e-mails.
  The user enters the SMTP settings in the Nhost dashboard (Auth → SMTP); the plan lists the steps.
  The public domain is not chosen yet: redirect URLs come from `NEXT_PUBLIC_SITE_URL`.
- **Q2 Expired reservation:** when an active reservation reaches `expires_at` without a signed
  compromis, the reservation becomes `expired`, its sale row is `cancelled`, and the deposit payment
  becomes `refund_due`; staff record the refund in the ERP (R1). Same when the agency cancels.
- **Q3 Mandate sales:** money always goes through the agency's account, for mandate sales as for the
  agency's own units (« Payer » shown in both cases). Staff accept or counter offers in the ERP after
  agreeing with the owner by phone; `purchase_offers.owner_agreed_on date` records that agreement and is
  required to accept an offer on a unit the agency does not own.
- Staff work only in the ERP (`/erp`); there is no separate staff interface.
