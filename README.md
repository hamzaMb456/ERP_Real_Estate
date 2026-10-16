# Real Estate Operations ERP

Cloud-native, multi-tenant B2B SaaS for companies that run real-estate
operations: rental management, sales, maintenance, external vendors,
finance, documents and reporting. Initial market: Tunisia.

The project is currently in the specification phase.

## Run with Docker

The web app (`web/`), the unit tests and the E2E tests run in containers, one
command each. The database/backend is Nhost in the cloud and is not
dockerized: containers reach it over the network.

Prerequisites: Docker Desktop, `web/.env.local` (see `web/.env.example`) and,
for E2E, `web/.env.test.local` (`E2E_EMAIL`, `E2E_PASSWORD`). Both files are
git-ignored and injected at runtime; they are never copied into an image.

```bash
docker compose up                # app with hot reload on http://localhost:3000
docker compose run --rm test     # unit tests (vitest)
docker compose run --rm e2e      # Playwright E2E (starts the web service itself)
docker compose down              # stop everything
```

- Another port: `WEB_PORT=3100 docker compose up` (E2E is unaffected, it uses the container's own network).
- One spec only: `docker compose run --rm e2e npx playwright test e2e/leases.spec.ts`.
- First run builds the images (a few minutes); `node_modules` live in Docker
  volumes and are reinstalled automatically when `web/package-lock.json` changes.
  Reset them with `docker compose down -v`.
- E2E reports land in `web/test-results` and `web/playwright-report`.

## Documentation

Start with the [documentation map](docs/00-documentation-map.md): it lists
every planned document, the open issues found in the existing ones, and the
order in which to write the rest.

- [Phase 0 — Product Definition](docs/phase-0/01-product-definition.md)
- [Cahier des Charges 00 — Cahier des Charges Général](docs/phase-1/specs/00-cahier-des-charges-general.md)
- [Cahier des Charges 01 — Organisation & Accès](docs/phase-1/specs/01-organisation-et-acces.md)
- [Architecture Vision & Principles](docs/phase-2/architecture/01-architecture-vision.md)
