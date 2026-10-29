---
type: "query"
date: "2026-10-28T11:56:13.218640+00:00"
question: "tecnocasa features: what is already implemented and where would the missing ones plug in"
contributor: "graphify"
source_nodes: ["pickSimilar", "ListingBookingCard", "ShareButton", "submitRentalRequestAction", "siteConfig"]
---

# Q: tecnocasa features: what is already implemented and where would the missing ones plug in

## Answer

Similar listings ±25% already implemented (web/src/lib/site/similar.ts + loadSimilar in /logement/[listingId]/page.tsx + ListingSimilar). WhatsApp exists only as share-the-listing (ShareButton); the Tecnocasa click-to-chat agent-contact button (wa.me/<agency number> in contact block of listing-booking-card.tsx) is missing — plug point: siteConfig.whatsapp (NEXT_PUBLIC_AGENCY_WHATSAPP) + helper in lib/site/listing-links.ts + i18n site.booking. Rate-limit/CAPTCHA gap confirmed: data-layer defenses (per-phone 3/h/kind, per-org 30/10min, honeypot, charset/email rules) exist but the public AppSync endpoint can be hit directly — need per-IP limiter + Turnstile verified inside the two server actions (web/src/lib/site/request-actions.ts). Longer-term: print PDF route, price-drop badge (needs price history schema), phone masking (low value, number already public env), agency directory (needs multi-branch public model).

## Source Nodes

- pickSimilar
- ListingBookingCard
- ShareButton
- submitRentalRequestAction
- siteConfig