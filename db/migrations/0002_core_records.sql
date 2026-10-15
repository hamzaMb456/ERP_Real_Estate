-- 0002_core_records: ownership on units (effective-dated, shares), photos and documents,
-- common areas and thousandths, the organization's own contact, record gaps.
-- Apply after 0001, then run db/tests/0002_core_records.test.sql.
-- Ownership attaches to units only; a bien's owners are derived from its units.

create extension if not exists btree_gist;

-- Contacts: archiving, and one contact standing for the organization itself (glossary N-03).
alter table public.contacts
  add column archived_at     timestamptz,
  add column is_organization boolean not null default false;
create unique index contacts_one_self_per_org on public.contacts (organization_id) where is_organization;
alter table public.contacts add constraint contacts_self_not_archived check (not (is_organization and archived_at is not null));

-- Units: automatic unit of a house or plot, and the common-area share in thousandths.
-- units_property_id_code_key (unique code per bien among active units) already exists since 0001.
alter table public.units drop constraint units_type_check;
alter table public.units add constraint units_type_check
  check (type in ('apartment', 'office', 'shop', 'parking', 'house', 'land'));
alter table public.units add column common_share integer check (common_share between 0 and 1000);
-- 0001 only has a partial index on property_id (active units); FK checks and archived units need a full one.
create index units_property_id_idx on public.units (property_id);

-- Ownership: who holds which share of a unit between two dates (both inclusive).
create table public.ownerships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  unit_id         uuid not null,
  contact_id      uuid not null,
  share_percent   numeric(5, 2) not null check (share_percent > 0 and share_percent <= 100),
  starts_on       date not null,
  ends_on         date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ownerships_dates_check check (ends_on is null or ends_on >= starts_on),
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict,
  constraint ownerships_no_overlap exclude using gist (
    unit_id with =,
    contact_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
);
create index ownerships_organization_id_idx on public.ownerships (organization_id);
create index ownerships_unit_id_idx on public.ownerships (unit_id);
create index ownerships_contact_id_idx on public.ownerships (contact_id);

-- The total share of one unit may not exceed 100 % on any day. Checked at commit
-- (deferred) so a transfer that ends one owner and starts another in one request passes.
-- The highest total is always reached on some row's start date, so only those days are checked.
create or replace function public.check_ownership_shares()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unit uuid := coalesce(new.unit_id, old.unit_id);
  v_day  date;
begin
  -- Serialise checks per unit: without it, two transactions adding 60 % each would both pass.
  perform pg_advisory_xact_lock(hashtextextended(v_unit::text, 0));

  select d.day into v_day
  from (select distinct starts_on as day from public.ownerships where unit_id = v_unit) d
  join public.ownerships o
    on o.unit_id = v_unit and o.starts_on <= d.day and (o.ends_on is null or o.ends_on >= d.day)
  group by d.day
  having sum(o.share_percent) > 100
  order by d.day
  limit 1;

  if v_day is not null then
    raise exception 'ownership_shares_exceeded:%', to_char(v_day, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger ownerships_shares_cap
  after insert or update of unit_id, share_percent, starts_on, ends_on on public.ownerships
  deferrable initially deferred
  for each row execute function public.check_ownership_shares();

-- Owning a unit makes the contact an owner.
create or replace function public.ensure_owner_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.contact_roles (organization_id, contact_id, role)
  values (new.organization_id, new.contact_id, 'owner')
  on conflict (contact_id, role) do nothing;
  return null;
end;
$$;

create trigger ownerships_ensure_owner_role
  after insert or update of contact_id on public.ownerships
  for each row execute function public.ensure_owner_role();

-- Photos and documents of a bien or of a unit (exactly one of the two).
create table public.property_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id     uuid,
  unit_id         uuid,
  storage_file_id uuid not null unique references storage.files (id) on delete cascade,
  kind            text not null check (kind in ('photo', 'document')),
  category        text check (category in ('title_deed', 'plan', 'certificate', 'contract', 'other')),
  title           text not null check (length(trim(title)) > 0),
  is_cover        boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint property_files_one_target check (num_nonnulls(property_id, unit_id) = 1),
  constraint property_files_category_matches_kind check (
    (kind = 'photo' and category is null) or (kind = 'document' and category is not null)
  ),
  constraint property_files_cover_is_photo check (not is_cover or kind = 'photo'),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete restrict,
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index property_files_organization_id_idx on public.property_files (organization_id);
create index property_files_property_id_idx on public.property_files (property_id) where property_id is not null;
create index property_files_unit_id_idx on public.property_files (unit_id) where unit_id is not null;
create unique index property_files_one_cover_per_property on public.property_files (property_id) where is_cover and property_id is not null;
create unique index property_files_one_cover_per_unit on public.property_files (unit_id) where is_cover and unit_id is not null;

-- A linked file must live in the property-files bucket and, for API users, have been uploaded
-- by the same user: otherwise a guessed file id of another organization could be linked and read.
create or replace function public.check_property_file_storage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id';
begin
  if not exists (
    select 1 from storage.files f
    where f.id = new.storage_file_id
      and f.bucket_id = 'property-files'
      and (v_user is null or f.uploaded_by_user_id::text = v_user)
  ) then
    raise exception 'invalid_storage_file' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger property_files_check_storage
  before insert or update of storage_file_id on public.property_files
  for each row execute function public.check_property_file_storage();

-- Shared parts of a building (syndic).
create table public.common_areas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id     uuid not null,
  name            text not null check (length(trim(name)) > 0),
  kind            text not null default 'other' check (kind in ('stairs', 'lift', 'garden', 'roof', 'parking', 'other')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties (id, organization_id) on delete restrict
);
create index common_areas_organization_id_idx on public.common_areas (organization_id);
create index common_areas_property_id_idx on public.common_areas (property_id);

-- A house or a plot gets its single unit automatically (units-only ownership model).
create or replace function public.create_single_unit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.type in ('house', 'plot') then
    insert into public.units (organization_id, property_id, code, type, status)
    values (
      new.organization_id,
      new.id,
      case new.type when 'house' then 'MAISON' else 'TERRAIN' end,
      case new.type when 'house' then 'house' else 'land' end,
      'vacant'
    );
  end if;
  return null;
end;
$$;

create trigger properties_create_single_unit
  after insert on public.properties
  for each row execute function public.create_single_unit();

-- Back-fill: houses and plots created before this migration get their unit too.
insert into public.units (organization_id, property_id, code, type, status)
select p.organization_id,
       p.id,
       case p.type when 'house' then 'MAISON' else 'TERRAIN' end,
       case p.type when 'house' then 'house' else 'land' end,
       'vacant'
from public.properties p
where p.type in ('house', 'plot')
  and not exists (select 1 from public.units u where u.property_id = p.id and u.archived_at is null);

-- Every organization has one contact standing for itself, so it can own its own stock.
create or replace function public.create_self_contact()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_contact uuid;
begin
  insert into public.contacts (organization_id, kind, full_name, is_organization)
  values (new.id, 'company', new.name, true)
  returning id into v_contact;
  insert into public.contact_roles (organization_id, contact_id, role) values (new.id, v_contact, 'owner');
  return null;
end;
$$;

create trigger organizations_create_self_contact
  after insert on public.organizations
  for each row execute function public.create_self_contact();

-- Back-fill the self contact of existing organizations.
with created as (
  insert into public.contacts (organization_id, kind, full_name, is_organization)
  select o.id, 'company', o.name, true
  from public.organizations o
  where not exists (select 1 from public.contacts c where c.organization_id = o.id and c.is_organization)
  returning id, organization_id
)
insert into public.contact_roles (organization_id, contact_id, role)
select organization_id, id, 'owner' from created;

create trigger ownerships_set_updated_at     before update on public.ownerships     for each row execute function public.set_updated_at();
create trigger property_files_set_updated_at before update on public.property_files for each row execute function public.set_updated_at();
create trigger common_areas_set_updated_at   before update on public.common_areas   for each row execute function public.set_updated_at();

-- Who owns each unit today ("today" in Tunisia; the database session runs in UTC).
create view public.current_ownerships as
select o.*
from public.ownerships o
where o.starts_on <= (now() at time zone 'Africa/Tunis')::date
  and (o.ends_on is null or o.ends_on >= (now() at time zone 'Africa/Tunis')::date);

-- Per bien: each current owner and how many active units they hold.
create view public.property_owners as
select u.organization_id, u.property_id, co.contact_id, count(*)::integer as units_count
from public.current_ownerships co
join public.units u on u.id = co.unit_id and u.archived_at is null
group by u.organization_id, u.property_id, co.contact_id;

-- One row per missing piece of information, for the "Fiches incomplètes" page.
create view public.record_gaps as
with active_units as not materialized (
  select u.*, p.name as property_name
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.archived_at is null and p.archived_at is null
)
select au.organization_id, 'unit'::text as entity_type, au.id as entity_id, au.property_id,
       au.code as entity_label, au.property_name as property_label, 'no_owner'::text as gap_code
from active_units au
where not exists (select 1 from public.current_ownerships co where co.unit_id = au.id)
union all
select au.organization_id, 'unit', au.id, au.property_id, au.code, au.property_name, 'no_surface'
from active_units au
where au.surface_m2 is null
union all
select au.organization_id, 'unit', au.id, au.property_id, au.code, au.property_name, 'no_rent'
from active_units au
where au.rent_amount is null and au.status in ('vacant', 'rented')
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'no_address'
from public.properties p
where p.archived_at is null and (nullif(trim(p.address_line), '') is null or nullif(trim(p.city), '') is null)
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'no_position'
from public.properties p
where p.archived_at is null and (p.latitude is null or p.longitude is null)
union all
select p.organization_id, 'property', p.id, p.id, p.name, null::text, 'shares_total'
from public.properties p
join public.units u on u.property_id = p.id and u.archived_at is null
where p.archived_at is null and p.type = 'building'
group by p.organization_id, p.id, p.name
having count(*) >= 2 and coalesce(sum(u.common_share), 0) <> 1000
union all
select c.organization_id, 'contact', c.id, null::uuid, c.full_name, null::text, 'no_contact_info'
from public.contacts c
where c.archived_at is null and not c.is_organization
  and nullif(trim(c.email), '') is null and nullif(trim(c.phone), '') is null;

-- Private bucket for photos and documents (10 MB per file, presigned downloads).
insert into storage.buckets (id, max_upload_file_size, min_upload_file_size, presigned_urls_enabled, download_expiration, cache_control)
values ('property-files', 10485760, 1, true, 300, 'max-age=3600')
on conflict (id) do nothing;
