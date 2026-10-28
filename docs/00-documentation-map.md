# Documentation Map — Real Estate Operations ERP

**Document:** Documentation Map & Plan\
**Version:** 0.5\
**Status:** Draft\
**Date:** 2026-10-08\
**Changes in 0.2:** Problem 1 to Problem 3 resolved — sales included in the MVP
with two seller models (Phase 0 §0.29, Cahier des Charges 00 D-008 / D-009).\
**Changes in 0.3:** glossary (Glossary) and scope matrix (Scope & Roadmap Matrix) drafted;
Problem 4 to Problem 6 answered by proposals to confirm.\
**Changes in 0.4:** only internal staff log in to the MVP (D-010): Problem 5
resolved, Problem 6 deferred to V1.\
**Note (late October 2026):** since the backend cutover, the backend is the
Floci AWS stack (AppSync / DynamoDB / S3 / Cognito, self-hosted). Nhost and
Hasura mentions in older documents (phase-2 database documents, superpowers
specs / plans / handoffs) refer to the former backend and are kept as
history.\
**Inputs:** [Phase 0 — Product Definition](phase-0/01-product-definition.md),
[Cahier des Charges 00 — Cahier des Charges Général](phase-1/specs/00-cahier-des-charges-general.md)

------------------------------------------------------------------------

## 1. Purpose

This document lists every document the project needs, from discovery to
production: what each one must contain, which tier it belongs to, and in
which order to write them. It is the index of the documentation set.

- If a document is not listed here, it does not exist yet.
- If a topic is not owned by a document listed here, nobody is
  responsible for it.

The goal is that **at the end of Phase 1, a reader can understand the
whole product from documents alone**: who uses it, what it does, which
rules it enforces, how every amount is computed, and what "done" means.
Phase 2+ documents then explain how it is built, secured and operated.

IDs below are proposals. Renumber if you prefer, but keep them stable
once other documents reference them.

------------------------------------------------------------------------

## 2. Review of the existing documents — fix before continuing

Findings marked ✅ are fixed; their text describes the problem as it was found, kept for history.

Reading Phase 0 and Cahier des Charges 00 together surfaced issues that affect several
downstream documents. The **blocking** ones should be resolved before
writing Cahier des Charges 01, because roles and permissions depend on them.

| Problem | Finding in Phase 0 and the Cahier des Charges Général | Why it matters | Resolved in | Priority |
|---|---|---|---|---|
| Problem 1 | ✅ *Fixed 2026-10-08 — the product now covers both rental and sales.* **Sales had been added without a Phase 0 decision.** Cahier des Charges 00 made real-estate sales and prospects/buyers first-level domains (D-005) and renamed the product from "Property Management ERP" to "Real Estate Operations ERP". Phase 0 was rental-only at the time: its target customer, personas, golden workflow, MVP/V1/V2, success criteria and competitor set contain no sales, and its non-goals exclude "a real-estate agency CRM" (Cahier des Charges 00 §20 quietly rewords this to "un CRM généraliste"). | Phase 0 itself sets the rule (§0.29): a scope change gets a decision record. Without one, Phase 0 and Phase 1 describe two different products. | Decision Log (new decision D-008) + Product Definition update | **Resolved** — Phase 0 §0.29, Cahier des Charges 00 v0.2 |
| Problem 2 | ✅ *Fixed 2026-10-08 — both seller models supported (D-008).* **The sales business model was undefined.** Cahier des Charges 00 mixed two different businesses: an *agency* selling on mandate for owners ("selon mandat", commissions) and a *developer* (promoteur) selling its own stock with payment schedules, often off-plan (*vente sur plan*), which also brushes against the "not a construction ERP" non-goal. There is also no internal sales actor: §4.1 still lists only Admin, Manager, Finance and Technician. | The two models have different actors, contracts, money flows and documents. Cahier des Charges 05/06 cannot be written without picking one (or both, staged). | D-008 + Product Definition (new persona) | **Resolved** — both models, one workflow (D-008); Sales Agent persona added |
| Problem 3 | ✅ *Fixed 2026-10-08 — basic sales in the MVP (D-009).* **Sales had no MVP staging.** Vendors received a precise MVP/V1/V2 split (§0.29); sales did not, and UC-011 to UC-016 sit at the same level as rental. | Scope explosion is Phase 0's first listed risk. | Scope & Roadmap Matrix | **Resolved** — basic sales in MVP (D-009) |
| Problem 4 | *Partly fixed 2026-10-09 — "Renter" is the person or company who rents; "tenant" means an organization, as in multi-tenancy (glossary N-01).* **"Tenant" meant two things.** *Multi-tenant* (a customer organization of the SaaS) vs. *Tenant* (locataire). Same collision for "Owner" (property owner vs. organization owner) and "Organization" (client company vs. vendor company in §0.23). | The collision will leak into the data model (`tenant_id` on a lease?), permissions and UI. | Glossary — e.g. reserve "Tenant" for the locataire and call the SaaS customer "Organization" | **Resolved for "Tenant"** — [glossary](reference/01-glossary.md) N-01; "Owner" and "Organization": proposed, N-02 to N-04, to confirm |
| Problem 5 | **Which external actors log in at MVP?** The §16 matrix gives owners, renters, vendors and buyers access, but Phase 0 puts the vendor portal and the advanced owner portal in V1 and the renter portal as a "foundation". | Each external login changes the identity model, the attack surface and the test scope. | Cahier des Charges 01 + Scope & Roadmap Matrix | **Resolved** — only internal staff log in to the MVP (D-010, [scope matrix](reference/05-scope-matrix.md) §2) |
| Problem 6 | **Can an external actor span several organizations?** A vendor, owner or renter may deal with two customer organizations on the platform. Is a vendor a record inside each organization (simple, isolated), or a platform-level account linked to several (one login, harder isolation)? | This is the hardest multi-tenancy question in the product and shapes the identity model. | Cahier des Charges 01, Conceptual Domain Model | **Deferred to V1** — no external login in the MVP (D-010); decide in Cahier des Charges 01 before V1 |
| Problem 7 | **Missing actor: the platform operator.** Nobody provisions organizations, suspends them, handles support access to customer data, manages plans/subscriptions, or exports and deletes an organization's data on offboarding. | Every multi-tenant SaaS needs this, and support access is a classic cross-tenant risk. | New Cahier des Charges 12 | High |
| Problem 8 | **The core money flow of property management is not specified:** management fees (honoraires de gestion), owner remittances (reversements), owner balances, security deposits held on behalf of renters, income split between co-owners. | Phase 0 asks "how much is due to the owner?" but no document owns the answer, and owner statements depend on it. | Cahier des Charges 07, Cahier des Charges 03, Conceptual Financial Model | High |
| Problem 9 | **The accounting boundary is undefined.** "Not a full SAP accounting suite" says what it isn't. Is it a sub-ledger (balances computed from transactions), an internal double-entry ledger, or a system that exports to the customer's accountant? | Shapes the whole finance data model; very expensive to change later. | Decision at the start of Cahier des Charges 07 | High |
| Problem 10 | **Local legal and tax rules are not inventoried.** Phase 0 says not to hard-code legal conclusions, but the rules to check are not listed: VAT on commercial rents, withholding tax (retenue à la source) on rent paid by companies, timbre fiscal and invoice numbering rules, possible e-invoicing obligations (TTN), lease registration, deposit rules, personal-data law (Loi organique 2004-63, INPDP) including transfers of personal data abroad, e-signature validity, legal retention periods. | Finance depends on the tax rules; the cross-border transfer rules constrain the choice of cloud region. | Regulatory & Legal Register, validated with an accountant / lawyer | High |
| Problem 11 | **Local payment reality is missing.** Cheques (including post-dated and bounced), cash, transfers and bills of exchange (traites) behave differently: a cheque is received, deposited, then cleared or bounced. Also, TND has **3 decimal places** (millimes). | A payment model built only for bank transfers, or money stored with 2 decimals, will be wrong. | Cahier des Charges 07, Cahier des Charges 14 | Medium |
| Problem 12 | **State machines already disagree.** Work order: Phase 0 has `WAITING` and `CANCELLED` but no `CLOSED`; Cahier des Charges 00 has `CLOSED` but no `WAITING`/`CANCELLED`. Invoice: Phase 0's statuses (`RECEIVED`, `APPROVED`, `REJECTED`) describe a vendor bill (payable); Cahier des Charges 00's (`ISSUED`, `PARTIALLY_PAID`, `VOID`) describe a customer invoice (receivable). Two different objects share the name "Invoice". | Inconsistent lifecycles become inconsistent code and reports. | Glossary (e.g. *Invoice* vs. *Vendor Bill*) + State Machine Catalog | Medium — naming proposed (Glossary N-05, N-07); statuses still to align in State Machine Catalog |
| Problem 13 | **Phase 0 is not done by its own definition of done:** competitor research, vendor capability comparison, evidence-backed differentiation and customer validation have no documents, and there is no Phase 0 freeze. | Phase 1 is being built on unvalidated hypotheses. | Competitor Analysis to Customer Discovery & Validation, Phase 0 Freeze Note — or record them as deferred with the risk accepted | Medium |
| Problem 14 | **Non-functional requirements are qualitative only:** no availability target, RPO/RTO, response time, data volume or retention duration. | Architecture choices and tests need numbers. | Cahier des Charges 11 | Medium |
| Problem 15 | **No data onboarding.** Target customers live in spreadsheets. Without importing properties, owners, renters, leases and opening balances, a new customer cannot start. | Adoption blocker; also the fastest way to load demo data. | New Cahier des Charges 13 | Medium |
| Problem 16 | **Scope edges never decided:** condominium management (*syndic de copropriété*; Phase 0 even lists "Syndic Digital" as a competitor), seasonal/short-term rentals (common locally, distinct from the Airbnb non-goal), recoverable charges and utility re-billing (charges locatives, STEG/SONEDE), and renter ↔ company messaging vs. notifications only (Phase 0 lists "communication" as a renter need; WhatsApp is today's channel). | Each one silently changes the size of a domain. | Decision Log + Scope & Roadmap Matrix | Medium — listed in Scope & Roadmap Matrix §7; syndic proposed Out |
| Problem 17 | **A unit can be sold while leased.** Ownership must be effective-dated (who owned it on which date), so rent, expenses and owner statements split correctly at the transfer date. One person can also be owner, renter and buyer at once. | Easy to design in from day one, painful to retrofit. | Cahier des Charges 02, 03, 05; Conceptual Domain Model | Medium |

------------------------------------------------------------------------

## 3. Documentation principles

- **One owner per topic.** Each topic is defined in exactly one
  document; others reference it. Example: a lifecycle is defined in the
  owning cahier and collected in State Machine Catalog, never re-defined elsewhere.
- **Stable IDs.** `D-xxx` decisions, `Q-xxx` open questions, `R-xxx`
  risks, `UC-xxx` use cases, `BR-<DOMAIN>-xxx` business rules,
  `NFR-<CATEGORY>-xxx` non-functional requirements, `AC-xxx` acceptance
  criteria, `Architecture Decision Record numbers` architecture decisions. Referencing by ID is what
  makes traceability (Requirements Traceability Matrix) possible.
- **Standard header** on every document: ID, title, version, status
  (`Draft → In review → Baseline → Superseded`), date, depends on,
  changelog.
- **Decisions are superseded, never silently edited** — the pattern
  Phase 0 already used in §0.29 for vendors.
- **Language rule (decide once).** Proposal: cahiers may be written in
  French; entity names, states, permissions and IDs stay in English
  because they appear in code and APIs; the glossary gives the FR / EN /
  AR equivalents. Cahier des Charges 00 already works this way — make it explicit.
- **Living vs. frozen.** Reference documents live through all
  phases. Phase documents are frozen at the phase gate and then change
  only through a decision.
- **Docs as code.** Markdown in this repository, diagrams as code
  (Mermaid / PlantUML), reviewed like code.
- **No abbreviations.** Write words in full: "Problem 4", not "F-04";
  "Cahier des Charges 01", not "CdC 01"; "Phase 0 §0.13", not
  "P0 §0.13". Abbreviations cause misunderstandings.
- **Keep them short.** Most documents are tables or one-pagers. Architecture Decision Records
  are one page each; several Phase 2 artifacts (OpenAPI, physical ERD)
  are generated from or maintained with the code. The heavy writing is
  in Cahier des Charges 01 to Cahier des Charges 14.

------------------------------------------------------------------------

## 4. The document set

**Tiers**

- **A — Understanding baseline.** Needed to understand the product and
  take structural decisions. Complete before writing production code.
- **B — Build.** Written before or while building the part it covers.
- **C — Run & launch.** Needed before production use or publishing the
  portfolio.

### 4.1 Reference documents — living, all phases

| Document | What it must contain | Tier |
|---|---|---|
| [Glossary / Lexique](reference/01-glossary.md) — *v0.1 draft* | Every business term: definition, FR / EN / AR names, synonyms to avoid, owning domain. Resolves Problem 4 and Problem 12. Also the source for UI translations of business terms. | A |
| Decision Log | All product and scope decisions (`D-xxx`): context, decision, consequences, superseded-by. Migrates Phase 0 §0.29 and Cahier des Charges 00 D-001 to D-009. Technical decisions go to Architecture Decision Records (Architecture Decision Records). | A |
| Open Questions Register | `Q-xxx`: question, why it matters, which document it blocks, owner, due date, answer → decision link. Takes over Cahier des Charges 00 §23. | A |
| Risk Register | Phase 0 §0.25 risks with likelihood, impact, mitigation, owner, status. Reviewed at each phase gate. | A |
| [Scope & Roadmap Matrix](reference/05-scope-matrix.md) — *v0.1 draft* | One table: every capability × `MVP / V1 / V2 / Out`. Scope is currently scattered over Phase 0 §0.13–0.15, §0.29 and Cahier des Charges 00 §20. | A |
| Requirements Traceability Matrix | `BR / NFR → UC → entity → API endpoint → test → release`. Started in Phase 1, filled during build. Proves the golden workflows are fully covered. | B |

### 4.2 Phase 0 — completion

| Document | What it must contain | Tier |
|---|---|---|
| Product Definition *(exists)* | Updated 2026-10-08 for sales: target customers, Sales Agent and Prospect / Buyer personas, seller models, sale workflow and golden workflow, MVP / V1 / V2, business rules, risks, success criteria, decision record, product name. Still to add: platform operator persona (Problem 7). | A |
| Competitor Analysis | International (Yardi, AppFolio, Buildium, …), regional and open-source products: features, pricing, positioning, localization. Now also sales-side competitors (real-estate CRMs, developer sales tools). | A |
| Vendor Capability Comparison | Evidence-based answer to the §0.9 question, per competitor, across the levels: contact record → work-order assignment → portal → quotes → POs → bills → payments → compliance documents. Confirms or kills the vendor differentiation. | A |
| Customer Discovery & Validation | Interview guide, interview notes (even 5–10 interviews), synthesis: confirmed / refuted hypotheses, real workflows, current tools, pain ranking, willingness to pay. | A |
| Business Model & Pricing Hypothesis | Who pays, for what (per unit, per user, per module), plans and limits, trial. Feeds Cahier des Charges 12. Can stay light if the project is primarily a portfolio. | B |
| Regulatory & Legal Register (Tunisia) | One row per legal/tax assumption (Problem 10): rule, source, product impact, validated by / when, status. Nothing tax- or law-sensitive is built on an unvalidated row. | A |
| Phase 0 Freeze Note | One page: what is validated, what is deferred with accepted risk, frozen decisions, Phase 1 inputs. | A |

### 4.3 Phase 1 — Functional specifications (cahiers des charges)

The 00–11 split from Cahier des Charges 00 §24 is kept, with three additions (12–14).

| Document | What it must contain | Tier |
|---|---|---|
| Cahier des Charges 00 — Général *(exists)* | v0.2 aligned with Phase 0 for sales (Commercial actor, seller models, §8.4 staging, D-008 / D-009). Still to do: link to reference documents; add Cahier des Charges 12–14 to §24. | A |
| [Cahier des Charges 01 — Organisation & Accès](phase-1/specs/01-organisation-et-acces.md) — *v0.1 draft* | Organization lifecycle; membership; one account per organization (nothing is shared); invitations; roles, permissions and scopes (portfolio / property / assignment); external identities (owner, renter, vendor user, buyer) and which exist at MVP (Problem 5); cross-organization external actors (Problem 6); MFA policy; delegation; support access rules. Produces Authorization Matrix. | A |
| Cahier des Charges 02 — Biens & Propriétés | Property / Building / Floor / Unit with optional levels; property types and attributes; unit statuses (rental availability vs. sale availability); status history; common areas; one unit identity shared by rental, sale and maintenance (D-007). | A |
| Cahier des Charges 03 — Propriétaires | Owner types (person, company, *indivision*); ownership shares; effective-dated ownership and transfers (Problem 17); management mandate (scope, fee terms, duration); owner bank details; owner portal scope. | A |
| Cahier des Charges 04 — Location & Gestion Locative | Lease types (residential / commercial / seasonal?); parties and guarantors; terms; rent schedule; revisions and increases; deposits; recoverable charges and utilities; renewals; termination; move-in / move-out inspections (*état des lieux*); arrears and reminders. | A |
| Cahier des Charges 05 — Vente Immobilière | Seller models fixed by D-008, MVP scope by D-009 (Cahier des Charges 00 §8.4). Listing; mandate (owner seller) or own stock (organization seller); multiple offers and counter-offers; reservation (deposit, expiry); pre-contract / contract stages; payment schedule; closing; commission; effect on ownership and on active leases. Depth follows the staging in Scope & Roadmap Matrix. | A |
| Cahier des Charges 06 — Prospects / Acheteurs | Prospect vs. buyer; sources; qualification; search criteria; rule-based matching (no ML); viewings; interaction history; contact consent; deduplication. | A |
| Cahier des Charges 07 — Finance & Transactions | Accounting boundary decision (Problem 9); money and currency model (TND, 3 decimals); charges, invoices, credit notes; payments per instrument (Problem 11); allocation rules; deposits; owner ledger, management fees and remittances (Problem 8); vendor bills and expenses; sale payments and commissions; reversals and corrections; numbering; taxes per Regulatory & Legal Register; export to the accountant. Owns the owner-statement *calculation*. Produces Conceptual Financial Model. | A |
| Cahier des Charges 08 — Maintenance & Techniciens | Intake channels; categories; priority; triage; work order; scheduling; technician assignment and capacity; materials and labor; photos; completion and verification; cost approval thresholds; who pays (owner / renter / company); preventive maintenance (stage?); SLAs. | A |
| Cahier des Charges 09 — Fournisseurs / Vendors | Profile; company / individual; categories; contacts; documents with expiry (insurance, licences); status; assignment; service history; rule-based rating; quotes and approval (V1); vendor bills; portal (V1); staging per §0.29. | A |
| Cahier des Charges 10 — Documents / Notifications / Reporting / Audit | Document types, attachment rules, access, versions, retention; generated documents (lease, receipt, invoice, owner statement templates, bilingual). Notification catalog (event → recipients → channel → template → timing) and preferences. Report catalog (definition, filters, permissions for each report). Business audit events. Owner statements: presentation and delivery only (calculation is in Cahier des Charges 07). | A |
| Cahier des Charges 11 — Exigences Transversales & Critères d'Acceptation | Quantified NFRs (Problem 14): availability, RPO / RTO, response times, volumes per organization, retention, supported browsers and devices, accessibility. End-to-end acceptance criteria for the golden workflows. | A |
| Cahier des Charges 12 — Administration Plateforme & Abonnements *(new)* | Platform operator role; organization provisioning; plans and limit enforcement; subscription and SaaS invoicing (manual at first); suspension; support access with customer consent and audit; offboarding with data export and deletion (Problem 7). | A |
| Cahier des Charges 13 — Reprise de Données & Onboarding *(new)* | Import templates (Excel / CSV) for properties, units, owners, renters, leases, vendors and opening balances; validation and error reports; dry run; idempotent re-import; go-live checklist for a new organization (Problem 15). | A |
| Cahier des Charges 14 — Localisation & Internationalisation *(new)* | FR / AR / EN for UI, generated documents and notifications; RTL; language per user vs. per organization; date, number and currency formats; TND millimes; bilingual legal documents; translation workflow; rules for adding currencies later. Separate from Cahier des Charges 11 because it touches every domain. | A |

### 4.4 Phase 1 — Domain modeling (cross-domain consolidation)

These are built incrementally — each cahier contributes its part — and
consolidated at the end of Phase 1. They are the deliverables listed in
Cahier des Charges 00 §25.

| Document | What it must contain | Tier |
|---|---|---|
| Use Case Catalog | Index of every `UC-xxx` with actor, domain, scope tier and status. Detailed use cases live in each cahier. | A |
| Context Map | Modules from Phase 0 §0.20, updated with Sales, Prospects and Platform Administration; what each owns; upstream / downstream relations; shared references (Unit, Party). Becomes the module structure of the monolith. | A |
| Conceptual Domain Model | Aggregates, entities, value objects, key attributes, cardinalities. Settles the *Party* question: one person can be owner, renter and buyer at once — one identity or several? | A |
| State Machine Catalog | For every lifecycle: states, transitions, guards, who may trigger, side effects. Organization, Membership, Unit, Ownership, Mandate, Lease, Charge, Invoice, Credit Note, Payment (per instrument), Deposit, Remittance, Maintenance Request, Work Order, Vendor, Vendor Bill, Expense, Listing, Offer, Reservation, Sale, Document. | A |
| Authorization Matrix | Role × action × scope, exhaustively, for every use case, including external actors and the platform operator. Becomes the source of the authorization tests. | A |
| Conceptual Financial Model | Money-flow diagrams (rent, deposits, owner remittance, maintenance recharge, vendor bills, sale payments); definition of every balance (renter, owner, vendor, deposit); invariants (e.g. sum of allocations ≤ payment amount). | A |
| Business Events Catalog | Domain events (`LeaseActivated`, `PaymentAllocated`, `WorkOrderAssigned`, …): producer, business payload, consumers (audit, notifications, reporting). Connects Cahier des Charges 10 to every other domain. | A |
| Conceptual ERD | Entities and relations across contexts, ready to become the logical model in Phase 2. | A |
| Acceptance Scenarios & Reference Dataset | The golden workflows (rental, internal and vendor maintenance, owner statement, sale) as end-to-end Given / When / Then scenarios, on one realistic Tunisian dataset (organization, properties, owners, leases, amounts). The same dataset serves tests, demo and screenshots. | A |

### 4.5 UX — end of Phase 1 / Phase 2

| Document | What it must contain | Tier |
|---|---|---|
| Information Architecture | The applications and portals (back office, owner, renter, technician, vendor, buyer?), navigation, screen inventory per persona. | B |
| User Journeys & Wireframes | Low-fidelity wireframes of the golden-workflow screens, reviewed with users from Customer Discovery & Validation. | B |
| Design System & UI Guidelines | Components, RTL mirroring rules, accessibility target (e.g. WCAG 2.1 AA), form and table patterns, empty and error states. | B |

### 4.6 Phase 2 — Architecture & technical design

| Document | What it must contain | Tier |
|---|---|---|
| [Architecture Vision & Principles](phase-2/architecture/01-architecture-vision.md) — *v0.1 draft* | Drivers (from Cahier des Charges 11), constraints, quality-attribute priorities, modular-monolith rationale, module boundary rules. | A |
| Architecture Description (C4) | Context, container and component views; deployment view; key runtime scenarios (recurring billing run, payment allocation, document download). | B |
| Architecture Decision Record Log | One Architecture Decision Record per technical decision. Initial backlog: language and framework; tenancy model (shared schema + organization column + PostgreSQL RLS vs. schema per organization); identity provider (build vs. Keycloak / managed OIDC); API style; job scheduler; object storage; frontend stack; mobile stack; cloud provider and region (constrained by Regulatory & Legal Register); repository layout. | A (initial Architecture Decision Records) |
| Multi-Tenancy & Isolation Design | How isolation is enforced at every layer (request context, queries, storage paths, caches, jobs, logs, exports) and how it is tested. | B |
| Logical & Physical Data Model | From Conceptual Entity-Relationship Diagram: tables, keys, constraints, indexes, money types, effective dating, audit columns, soft-delete policy, migration strategy. | B |
| API Guidelines & Specification | Conventions (resources, versioning, pagination, filtering, error format, idempotency keys, concurrency control, localization) and the OpenAPI specification maintained with the code. | B |
| Background Processing & Integrations | Scheduled jobs (rent generation, reminders, expiries), retries, idempotency, outbox for domain events, email / SMS providers, future payment and bank integrations. | B |
| Reporting & Read Models | How reports are computed; immutable snapshots of issued owner statements; performance of aggregates. | B |

### 4.7 Phase 2 — Security & privacy

| Document | What it must contain | Tier |
|---|---|---|
| Security Architecture | Authentication (OIDC, MFA, sessions); authorization enforcement implementing Authorization Matrix; secrets; encryption in transit and at rest; document access (signed URLs, expiry); rate limiting. | A |
| Threat Model | STRIDE per container plus product-specific abuse cases: cross-organization access (IDOR), vendor and technician over-reach, leaked document links, payment / allocation tampering, support-access abuse, malicious import files. | A |
| Data Protection & Privacy | Personal-data inventory and classification; legal basis; retention and deletion per data type; data-subject rights; INPDP obligations; cross-border transfer position. | A |
| Secure SDLC / DevSecOps Policy | SAST, dependency, container, IaC and secret scanning; SBOM; branch protection; review rules; vulnerability triage deadlines. | B |
| Audit Logging Specification | Technical side of audit: event schema, integrity / tamper evidence, retention, who can read audit logs, separation from application logs. | B |

### 4.8 Phase 2 — Infrastructure

| Document | What it must contain | Tier |
|---|---|---|
| Cloud Infrastructure Architecture | Provider and region (data residency), network, compute, database, storage, Terraform module structure. | B |
| Environments & Configuration | Local / dev / staging / prod; configuration and secrets per environment; seed and demo data; feature flags. | B |
| CI/CD Pipeline Design | Stages, quality gates, security gates, artifact signing, deployment strategy, rollback. | B |
| Observability Design | Log structure (organization ID, no PII), metrics, traces, dashboards, alert rules mapped to SLOs, business KPIs. | B |
| Backup, Restore & DR Plan | RPO / RTO from Cahier des Charges 11; backup scope (database and documents); restore procedure; DR test schedule. | B |
| Cost Model | Estimated monthly cost per environment and per customer organization; cost guardrails. | C |

### 4.9 Phase 3 — Delivery *(proposed phase)*

| Document | What it must contain | Tier |
|---|---|---|
| Test Strategy | Test levels; financial calculation tests; authorization tests generated from Authorization Matrix; tenant-isolation tests; end-to-end tests from Acceptance Scenarios & Reference Dataset; performance and security tests; test data. | A |
| Release Plan & Backlog | Epics and stories derived from use cases, mapped to Scope & Roadmap Matrix tiers; milestones; MVP definition of done. | B |
| Engineering Handbook | Repository layout, conventions, branching and commits, Definition of Ready / Done, review checklist, automated module-boundary checks. | B |
| README / CONTRIBUTING | Local setup, running tests, project structure. | B |
| Changelog & Release Notes | Per release. | C |

### 4.10 Phase 4 — Production readiness & operations *(proposed phase)*

| Document | What it must contain | Tier |
|---|---|---|
| Production Readiness Checklist | Security, tested backups, alerts, runbooks, load test, legal documents. | C |
| Runbooks | Deploy / rollback; restore; rotate secrets; re-run a failed billing job; onboard / offboard an organization; answer a personal-data access request. | C |
| Incident Response & Postmortem Template | Severity levels, roles, communication, customer notification including data-breach obligations from Data Protection & Privacy. | C |
| Evidence Reports | DR test results, load test results, security scan summaries, SLO reports. | C |

### 4.11 Phase 5 — User-facing, legal & portfolio *(proposed phase)*

| Document | What it must contain | Tier |
|---|---|---|
| User Guides per Persona | Admin, manager, finance, technician, owner, renter, vendor, sales. | C |
| Customer Onboarding Guide | How a new organization goes live (uses Cahier des Charges 13). | C |
| Public API Documentation | Rendered from the OpenAPI specification, with guides. | C |
| Legal Documents | Terms of service, privacy policy, data processing agreement, SLA — if offered commercially. | C |
| Demo Script & Video | Golden-workflow walkthrough on the Acceptance Scenarios & Reference Dataset dataset. | C |
| Portfolio Case Study | Problem, architecture, security, trade-offs, links to the evidence listed in Phase 0 §0.26. | C |

### 4.12 Totals

| Tier | Count | Notes |
|---|---|---|
| A | 41 | Of which 15 are cahiers (the heavy writing); reference and domain modeling documents are mostly tables consolidated from the cahiers. |
| B | 21 | Written alongside the code they describe. |
| C | 12 | Written before launch / publication. |

------------------------------------------------------------------------

## 5. Recommended writing order

Cahier des Charges 00 §26 names Cahier des Charges 01 as the next document. A short **Step 0** should
come first: Cahier des Charges 01 defines roles and permissions, and those depend on
Problem 1 to Problem 6.

``` mermaid
flowchart TD
  S0["Step 0 — Foundations<br/>sales decision · glossary · scope matrix (drafted) · registers"]
  P0["Step 1 — Finish Phase 0<br/>competitors · vendor comparison · interviews · legal register · freeze"]
  S2["Step 2 — Cahier des Charges 01 Organisation & Accès<br/>+ Cahier des Charges 12 Plateforme"]
  S3["Step 3 — Cahier des Charges 02 Biens · Cahier des Charges 03 Propriétaires"]
  S4["Step 4 — Cahier des Charges 07 Finance, part 1<br/>accounting boundary · money · payment instruments"]
  S5["Step 5 — Cahier des Charges 04 Location<br/>+ Cahier des Charges 07 part 2"]
  S6["Step 6 — Cahier des Charges 08 Maintenance · Cahier des Charges 09 Vendors<br/>+ Cahier des Charges 07 part 3"]
  S7["Step 7 — Cahier des Charges 05 Vente · Cahier des Charges 06 Prospects<br/>+ Cahier des Charges 07 part 4"]
  S8["Step 8 — Cahier des Charges 10 · Cahier des Charges 13 · Cahier des Charges 14 · Cahier des Charges 11"]
  S9["Step 9 — the domain modeling documents consolidation<br/>Phase 1 freeze"]
  S10["Step 10 — Phase 2<br/>architecture · decisions · security · infrastructure · user experience"]
  S0 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10
  S0 --> P0
  P0 -. "legal register before finance" .-> S4
  P0 -. "interviews before freezing specs" .-> S9
```

| Step | Documents | Why at this point |
|---|---|---|
| 0 | ~~Sales decision; Product Definition and Cahier des Charges 00 updated; Glossary v0.1; Scope & Roadmap Matrix v0.1~~ (done 2026-10-08 — naming and scope proposals to confirm); Decision Log, Open Questions Register and Risk Register migrated from existing text | Problem 1 to Problem 3 resolved; Problem 4 naming proposed in Glossary; Problem 5 resolved and Problem 6 deferred to V1 by D-010. Small documents, a few days of work. |
| 1 | Competitor Analysis, Vendor Capability Comparison, Customer Discovery & Validation, Regulatory & Legal Register, then Phase 0 Freeze Note | Runs in parallel with steps 2–8. Regulatory & Legal Register must exist before Cahier des Charges 07; interviews should happen before the rental, sales and maintenance cahiers are frozen. |
| 2 | Cahier des Charges 01 + Cahier des Charges 12 → Authorization Matrix v1 | Identity is the foundation of every other domain; the platform operator is one more role in the same model. |
| 3 | Cahier des Charges 02, Cahier des Charges 03 → Conceptual Domain Model v1 | The real-estate reference data every workflow points to, including effective-dated ownership. |
| 4 | Cahier des Charges 07 part 1 → Conceptual Financial Model v1 | Lease, maintenance and sale all create financial records. Fixing the accounting boundary, money model and payment instruments first avoids redesigning each domain later. |
| 5 | Cahier des Charges 04, then Cahier des Charges 07 part 2 (rent, deposits, owner remittance) | The primary business loop. |
| 6 | Cahier des Charges 08 + Cahier des Charges 09 together, then Cahier des Charges 07 part 3 (expenses, vendor bills) | Work orders and vendors are one workflow with two performer types. |
| 7 | Cahier des Charges 05 + Cahier des Charges 06, then Cahier des Charges 07 part 4 (sale payments, commissions) | Basic sales is in the MVP (D-009), so these cahiers are needed in full for the MVP scope; V1 / V2 items only need to be outlined. |
| 8 | Cahier des Charges 10, Cahier des Charges 13, Cahier des Charges 14, Cahier des Charges 11 | Transversal: they consume what the domain cahiers produce (events, documents, reports, NFR needs). |
| 9 | the domain modeling documents consolidated, Requirements Traceability Matrix started, Phase 1 freeze | Check consistency across cahiers; answer the exit questions in §7. |
| 10 | Architecture Vision & Principles, initial Architecture Decision Records, Security Architecture, Threat Model, Data Protection & Privacy, Test Strategy, then Tier B | Phase 2. UX can start in parallel from step 9. |

------------------------------------------------------------------------

## 6. Standard structure of a detailed cahier

Every cahier (Cahier des Charges 01 to Cahier des Charges 14) uses the same skeleton so the domain modeling
documents can be consolidated mechanically. Sections that don't apply
are kept and marked "N/A".

``` text
1.  Objet et périmètre            in / out, MVP / V1 / V2 (→ Scope & Roadmap Matrix)
2.  Acteurs et permissions        role × action × scope (→ Authorization Matrix)
3.  Glossaire du domaine          new terms (→ Glossary)
4.  Concepts et entités           business attributes, cardinalities (→ Conceptual Domain Model)
5.  Workflows                     diagrams + narrative
6.  Cas d'utilisation détaillés   UC-xxx (→ Use Case Catalog)
7.  Règles métier                 BR-<DOM>-xxx, numbered and testable
8.  Cycles de vie                 states, transitions, guards, actor (→ State Machine Catalog)
9.  Événements métier             emitted / consumed (→ Business Events Catalog)
10. Impacts financiers            records created, amounts, balances (→ Cahier des Charges 07, Conceptual Financial Model)
11. Documents                     attached / generated (→ Cahier des Charges 10)
12. Notifications                 event → recipient → channel (→ Cahier des Charges 10)
13. Audit                         which actions are audited (→ Cahier des Charges 10)
14. Reporting / KPI               reports and indicators (→ Cahier des Charges 10)
15. Interactions inter-domaines   references to other cahiers
16. Exigences non fonctionnelles  domain-specific (→ Cahier des Charges 11)
17. Critères d'acceptation        AC-xxx, Given / When / Then
18. Questions ouvertes            Q-xxx (→ Open Questions Register)
19. Décisions                     D-xxx (→ Decision Log)
```

**Use case template**

``` text
UC-004 — Créer un locataire et un bail
Acteur principal     : Property Manager
Acteurs secondaires  : Renter (notifié), Owner (visibilité)
Portée               : MVP
Préconditions        : Unit existe, statut disponible à la location
Déclencheur          : …
Scénario nominal     : 1. … 2. … 3. …
Alternatives         : 3a. …
Exceptions           : E1. …
Postconditions       : Lease en DRAFT, …
Règles               : BR-LEA-001, BR-LEA-007
Permissions          : Authorization Matrix § Lease
Événements émis      : LeaseCreated
Critères             : AC-004-01, AC-004-02
```

**Business rule format** — one rule, one ID, testable:

``` text
BR-LEA-007 — A lease cannot be activated if another ACTIVE lease
covers the same unit for an overlapping period.
```

------------------------------------------------------------------------

## 7. Phase 1 exit test — "global understanding"

Phase 1 is complete when someone who has never seen the project can
answer each question **from the documents alone**:

| Question | Answered by |
|---|---|
| Who are all the actors, and what can each one see and do? | Cahier des Charges 01, Authorization Matrix |
| Step by step, what happens in each golden workflow, and which records are created? | Acceptance Scenarios & Reference Dataset, Business Events Catalog |
| How is every amount on an owner statement computed? | Cahier des Charges 07, Conceptual Financial Model |
| What are all the states of each record, and who can change them? | State Machine Catalog |
| What is in MVP, what comes later, what is never built? | Scope & Roadmap Matrix |
| Which legal and tax assumptions are validated, and which are not? | Regulatory & Legal Register |
| What does the system promise in numbers (availability, recovery, performance)? | Cahier des Charges 11 |
| Does every term have exactly one meaning? | Glossary |
| Why was each structural choice made? | Decision Log |

If one question cannot be answered, Phase 1 is not done.

------------------------------------------------------------------------

## 8. Repository layout

``` text
docs/
├── 00-documentation-map.md        this document
├── reference/                     reference documents
├── phase-0/                       Phase 0 documents
├── phase-1/
│   ├── specs/                     Cahiers des Charges 00 to 14
│   └── model/                     domain modeling documents
├── ux/                            user experience documents
├── phase-2/
│   ├── architecture/              architecture documents
│   ├── adr/                       one file per Architecture Decision Record
│   ├── security/                  security documents
│   └── infrastructure/            infrastructure documents
├── delivery/                      delivery documents
├── operations/                    operations documents
└── user/                          user guides, legal and portfolio documents
```

Folders are created when their first document is written.
