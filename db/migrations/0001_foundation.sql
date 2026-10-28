-- 0001_foundation: organizations, branches, properties, units, contacts.
-- Multi-tenant: every business table has organization_id. Composite foreign keys
-- (id, organization_id) make it impossible to link rows of two different organizations.
-- Money is TND with 3 decimals: numeric(12,3).
-- Organizations are never hard-deleted (properties/units use ON DELETE RESTRICT on purpose);
-- records are archived with archived_at instead.
-- Data layer: keep organization_id out of every update permission (set it only through insert presets).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  city            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create table public.properties (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  branch_id       uuid not null,
  name            text not null check (length(trim(name)) > 0),
  type            text not null default 'building' check (type in ('building', 'house', 'plot')),
  address_line    text,
  city            text,
  governorate     text,
  postal_code     text,
  latitude        numeric(9, 6) check (latitude between -90 and 90),
  longitude       numeric(9, 6) check (longitude between -180 and 180),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id) references public.branches (id, organization_id) on delete restrict
);

create table public.units (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id     uuid not null,
  code            text not null check (length(trim(code)) > 0),
  type            text not null default 'apartment' check (type in ('apartment', 'office', 'shop', 'parking')),
  floor           integer,
  rooms           integer check (rooms >= 0),
  surface_m2      numeric(8, 2) check (surface_m2 > 0),
  rent_amount     numeric(12, 3) check (rent_amount >= 0),
  status          text not null default 'vacant' check (status in ('vacant', 'rented', 'for_sale', 'sold', 'under_maintenance')),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete restrict
);

create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            text not null default 'person' check (kind in ('person', 'company')),
  full_name       text not null check (length(trim(full_name)) > 0),
  email           text,
  phone           text,
  national_id     text,
  address         text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, organization_id)
);

-- One contact can be owner, renter and buyer at the same time (glossary N-09).
create table public.contact_roles (
  organization_id uuid not null,
  contact_id      uuid not null,
  role            text not null check (role in ('owner', 'renter', 'buyer')),
  created_at      timestamptz not null default now(),
  primary key (contact_id, role),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete cascade
);

-- Indexes on every foreign key and tenant filter column.
-- branches(organization_id) is covered by unique (organization_id, name).
create index properties_organization_id_idx on public.properties (organization_id);
create index properties_branch_id_idx on public.properties (branch_id);
create index units_organization_id_idx on public.units (organization_id);
create unique index units_property_id_code_key on public.units (property_id, code) where archived_at is null;
create index units_status_idx on public.units (organization_id, status) where archived_at is null;
create index contacts_organization_id_idx on public.contacts (organization_id);
create index contact_roles_organization_id_idx on public.contact_roles (organization_id);

-- updated_at maintenance.
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger branches_set_updated_at      before update on public.branches      for each row execute function public.set_updated_at();
create trigger properties_set_updated_at    before update on public.properties    for each row execute function public.set_updated_at();
create trigger units_set_updated_at         before update on public.units         for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at      before update on public.contacts      for each row execute function public.set_updated_at();
