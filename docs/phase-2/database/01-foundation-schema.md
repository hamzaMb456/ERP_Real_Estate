# Foundation schema (migration 0001)

Source of truth: [`db/migrations/0001_foundation.sql`](../../../db/migrations/0001_foundation.sql).
Six tables of the roughly 60 classes in the UML model. More tables are added module by module.

```mermaid
erDiagram
    organizations ||--o{ branches : "has"
    organizations ||--o{ contacts : "has"
    branches ||--o{ properties : "manages"
    properties ||--o{ units : "contains"
    contacts ||--o{ contact_roles : "holds"

    organizations {
        uuid id PK
        text name
    }
    branches {
        uuid id PK
        uuid organization_id FK
        text name
        text city
    }
    properties {
        uuid id PK
        uuid organization_id FK
        uuid branch_id FK
        text name
        text type "building, house, plot"
        text address_line
        text city
        text governorate
        numeric latitude
        numeric longitude
        timestamptz archived_at
    }
    units {
        uuid id PK
        uuid organization_id FK
        uuid property_id FK
        text code "B-102"
        text type "apartment, office, shop, parking"
        int floor
        int rooms
        numeric surface_m2
        numeric rent_amount "TND, 3 decimals"
        text status "vacant, rented, for_sale, sold, under_maintenance"
        timestamptz archived_at
    }
    contacts {
        uuid id PK
        uuid organization_id FK
        text kind "person, company"
        text full_name
        text email
        text phone
        text national_id
    }
    contact_roles {
        uuid contact_id PK
        text role PK "owner, renter, buyer"
        uuid organization_id FK
    }
```

## Multi-tenant rule

Every business table carries `organization_id`. The foreign keys between tables are composite
(`id, organization_id`), so a unit can only belong to a property of the same organization.
Hasura filters every query by the `organization_id` found in the user's JWT.

## Conventions

- Archive with `archived_at`, never hard-delete (organizations are never deleted).
- Money: `numeric(12,3)`, Tunisian dinar.
- A contact holds one or several roles in `contact_roles` (glossary N-09: owner, renter, buyer).
