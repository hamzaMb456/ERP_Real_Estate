# Notes: tecnocasa.tn reverse-engineering — competitor features (2026-10-28)

> Method: REA controlled-replay browser scenarios (authority `controlled-replay`, confidence `observed`).
> Raw evidence bundle (5.7 MB, full DOM text of every page): `C:\Users\mbark\AppData\Local\Temp\opencode\rea-detail-bundle.json`.
> Purpose: compare a mature competitor's public site with our vitrine and decide what to copy. Companion file of `memory.md` (root).

## 1. The 4 captured scenarios (exact evidence IDs)

| Evidence ID | Pages captured |
|---|---|
| `ev_182974533186b142afe128a939be6c6394e7ad3170ced8ce310e2cde2a38b537` | Homepage `https://www.tecnocasa.tn/` — DOM 51 KB + accessibility tree 7 KB |
| `ev_35a31c98d7778bb8f4e5ef4036d815bce9ea3bfdc06512ae9a626cf47db575a6` | Sale listing detail `/vendre/appartement/grand-tunis/aouina/72437.html` — DOM 92 KB |
| `ev_5c7eb41e949a10aaf54ece2fbeae47d77ebf416aa0759402fb1590b1e6bbe724` | Category list `/vendre/appartements/grand-tunis.html` (empty state, DOM 34 KB) then agencies directory `/agences.html` (DOM 75 KB) |
| `ev_98f24113d0aaa8b774d404cc5b8ebbda665c8e9ddf52dafe0806d2d09f53897c` | Buildings category list `/vendre/immeubles/nord-est-ne/grand-tunis.html` — DOM 108 KB, the richest list page |

The sample estate on the detail/list pages: **S+2 (3 pièces) en vente, Aouina, Rue chiekh naifer — Grand Tunis, 111 m², REF 72437, agency `tuao3`**.

## 2. Features observed on the listing detail page

### Contact (the anti-scraping contact stack)
- **WhatsApp button**: `<a href="https://wa.me/+21628600115">` inside `.whatsapp` — click-to-chat with the agency number, next to the phone.
- **Masked phone**: contact links `tel:+0021628600115` carry `style="display: none"` in `.btn-network` — the real number is revealed only after user interaction (anti-scraping; prevents bulk harvesting).
- **E-mail to the agency branch** (`mailto:contact.ao3@tecnocasa.tn`) — contact routes to the *agency*, never a named person.
- **Financing teaser**: `<div class="modal-opener calculate-mortgage"><span>Demandez un crédit immobilier 4.568 DT par mois ></span></div>` — monthly-payment hook that opens a mortgage modal (computed from price/term on the site side).
- Card header actions: **print PDF** (`btn-network print-pdf` → `https://pdf.medialabtc.it/estates/72437?country=tn&language=fr&v=…` — dedicated PDF sub-domain), **share** (modal `share-with-friend-modal` — "send to a friend"), **favorites** (`favorite.svg`, "sauvegarde"), **hide listing** (`hidden.svg`, "masque" — lets a visitor hide an estate from their view), plus `REF: 72437` displayed.

### Price presentation
- Current price `259 000 DT` + **discount display**: struck-through old price `269 000 DT` + badge `(-4%)` with a down-arrow icon (`estate-card-discount`, "Bas prix") — Tecnocasa surfaces negotiated price drops as a selling point.
- Key attributes as icon+text chips: `3 pièces` (rooms.svg), `111 m²` (surface.svg) — `estate-card-data-element` pattern.

### Content & media
- Title `S+2 en vente` (h1) + address subtitle (h2); rich prose description with bolded structured facts (étage bas, ascenseur, parking, chauffage central, climatiseurs split).
- **Photo gallery**: 56 `swiper-slide` occurrences; image ids sequential (`459819`, `459820`, `459821`…); lazy-loaded carousel (`data-src`, `lazy="loaded"`).
- **CDN media structure**: `cdn-media.medialabtc.it/tn/agencies/{agency-id}/estates/{estate-id}/images/{image-id}/{variant}.jpeg` with named variants (`detail.jpeg`, `gallery_media.jpeg`) — server-side resized variants per slot.

### SEO / metadata (detail page)
- `meta description` auto-built from attributes: "Appartement en Vente à Aouina Grand Tunis: 3 pièces, 111 m², 259 000 DT. Contactez l'agence de référence…".
- Open Graph: `og:url` (canonical detail URL), `og:type=website`, `og:title` (site-wide), `og:description` (per-listing), `og:image` (the detail photo). No Twitter cards observed. **No JSON-LD** (`application/ld+json` count: 0).
- Canonicals per category and per agency page; `robots=all,index,follow`, `revisit-after=3 days`.
- CSRF token in a meta tag (`csrf-token`) — Vue SPA pattern (`data-v-*` attributes).

## 3. Features observed on list pages

- **Filter facets**: `Ville` (city), `Prix min` / `Prix max` (query params like `min_price`), zone filters ("Zone Affiliés"); `desktop-estate-filters` / `search-bar-desk` container.
- **Sort**: `estates-sort` control rendering a `multiselect` combobox ("Select option" placeholder, role=listbox).
- **Map**: separate map platform, preconnects + chunks from `maps.medialabtc.it` (`tecnomap.js`, `vendors~tecnomap.js`) — map is an independent bundle/domain.
- **Cards**: each `estate-card` = link to detail, lazy carousel image, `estate-card-titles` (h3 title + h4 city subtitle), `estate-card-data` chips (surface, rooms when set), user buttons (hide + favorite).
- **Empty state**: the category page with no results shows "…recherchez n'est pas disponible" — dedicated no-results wording rather than a blank list.

## 4. Agencies directory (`/agences.html`)

- Every branch is a first-class page: `https://www.tecnocasa.tn/agences/immobilier+commercial/{region}/{city}/{agency-code}.html` (e.g. `bzco1` Bizerte, `naha1`/`naha2` Hammamet, `naca1`/`naca2` Nabeul, `naca4` Kelibia, `tuhb2` Ain Zaghouan, `tuao3` Aouina).
- The estate's `agency-id` (`tuao3`) ties each listing to its branch everywhere (share widget, CDN path, contact e-mail).

## 5. Home page

- Nav: brand + `vendre + commercial` (industrial), `vendre-maison` ("vendre casa"), `agences` (`nav-link agency`), favorites entry point; footer contacts block (`contacts.svg`).
- Sections promote the rent/sale split and the agency network.

## 6. Marketing / ops stack observed (useful context)

- **Sentry** (`sentry.medialabtc.it`) for front-end errors.
- **Google Analytics + GTM + Google Ads** (`AW-444871262`), **Facebook Pixel** (`495339714487460`) + Facebook SDK.
- **Cookie banner** served from its own sub-domain (`cookie-banner.medialabtc.it`).
- Media/map/pdf sub-domains (`cdn-media`, `maps`, `pdf`) — domain-sharded static services.

## 7. REA capture limitations (recorded for honesty)

Per-scenario (standard Playwright caveats): event order = provider receipt order, no causal inference; network bodies retained only when selected and not guaranteed to match wire bytes; request bytes limited to what Playwright exposes; 5 s settle per network read; no initiator stacks; storage hashed after secret redaction; some selected network content unavailable / unfinished at capture end. Only the primary document requests were in the events; **no XHR API endpoints were observed**.

## 8. Not found (negative observations, also useful)

- **No "similar listings" block** on the detail page — the ±25 % similar-listings idea is our own enhancement proposal, not a competitor copy.
- No visible review/rating system, no CAPTCHA on public pages observed, no WhatsApp share of the listing itself (WhatsApp is agent-contact only).

## 9. Roadmap derived from this analysis (awaiting the user's go — pace: "take it easy")

1. **WhatsApp button** on the public listing page (mirror `wa.me` pattern; number from `NEXT_PUBLIC_AGENCY_PHONE` or the org's own field).
2. **Rate-limit / CAPTCHA hardening** of the two public submit mutations (per-IP limit at the edge/backend + e.g. Cloudflare Turnstile in the server action; gap first recorded in `docs/superpowers/handoffs/2026-10-23-visitor-requests.md`).
3. **Similar-listings query** ±25 % on price/surface (our proposal).
4. Longer-term candidates noted but not discussed in depth: phone masking before reveal, per-listing print PDF, "hide listing" personal list, price-drop badge, share-with-friend, branch-level agency directory.

## 10. App state audit (same session)

**Implemented:** ERP modules — biens, unites, contacts, calendrier, visites, baux (+ demandes), listings publication, administration (apparence, visites). Public site — `/`, `/louer`, `/acheter`, `/logement/[id]`, `/favoris`, `/compte`. DB — migrations 0001–0013 applied. Wire contract web ↔ ops Lambda stays Hasura-shaped (`$where`, `_ilike`, `by_pk`, `affected_rows`) deliberately.

**NOT implemented** — PlaceholderCards from `web/src/app/erp/(app)/[...slug]/page.tsx`: finance, maintenance, fournisseurs, ventes, rapports, audit, users/roles administration.

**Verdict:** the 3-feature "light MVP" (listings page, simple search, contact button) is already implemented.
