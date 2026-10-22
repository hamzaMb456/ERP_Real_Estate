-- 0005_listings: listings (annonces) of units for rent or for sale, the publishing rules, and the two public views
-- the front office reads. Apply after 0004, then run db/tests/0005_listings.test.sql.
-- ASCII only: this file travels through the clipboard, so French text never appears here, only error codes.
-- "Today" is always Tunisia (public.today_tunis()): the database session runs in UTC.
-- Photos are not copied: a listing shows the photos of its unit (property_files, kind 'photo'). A table that orders
-- or hides photos per listing (listing_photos) is deferred.

-- Listing. A unit can have one open (not closed) listing per kind. Closing is final in practice: a new listing
-- is created instead of reopening an old one.
create table public.listings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  unit_id             uuid not null,
  kind                text not null check (kind in ('rent', 'sale')),
  status              text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed')),
  title               text not null check (length(trim(title)) > 0),
  description         text,
  price               numeric(12, 3) check (price > 0),                  -- monthly rent, or sale price
  charges             numeric(12, 3) check (charges >= 0),               -- rent only
  deposit_months      smallint not null default 2 check (deposit_months between 0 and 12),
  reservation_deposit numeric(12, 3) not null default 10000 check (reservation_deposit >= 0),
  reservation_days    smallint not null default 15 check (reservation_days between 1 and 90),
  available_from      date,
  furnished           boolean not null default false,
  amenities           text[] not null default '{}',
  virtual_tour_url    text,
  published_at        timestamptz,                                       -- first publication; kept through pauses
  closed_reason       text check (closed_reason in ('leased', 'sold', 'unit_archived', 'manual')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint listings_amenities_check check (
    amenities <@ array['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen']::text[]
  ),
  -- Shown as a link on the public page: only web addresses, never javascript: or data: schemes.
  constraint listings_virtual_tour_url_check check (virtual_tour_url is null or virtual_tour_url ~* '^https?://'),
  unique (id, organization_id),
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index listings_organization_id_idx on public.listings (organization_id);
create index listings_unit_id_idx on public.listings (unit_id);
-- Drafts and paused listings count as open, so a unit never has two working listings of one kind.
create unique index listings_one_open_per_unit_kind on public.listings (unit_id, kind) where status <> 'closed';
-- What the public search reads.
create index listings_published_idx on public.listings (organization_id, kind, published_at desc) where status = 'published';

create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Publishing rules. They run when a listing is inserted already published, or when its status, kind, unit, price or
-- availability is written while it is published; pausing, closing and editing texts are never blocked.
-- Errors carry stable codes that the web maps to messages:
--   LISTING_UNIT_ARCHIVED         the unit (or its bien) is archived
--   LISTING_UNIT_NOT_RENTABLE     rent: the unit is vacant, or rented with its current lease ending within 90 days
--                                 and available_from after that end date
--   LISTING_UNIT_NOT_SELLABLE     sale: the unit is for sale or rented
--   LISTING_NEEDS_PRICE           no price
--   LISTING_NEEDS_PHOTO           the unit has no photo
-- "Current lease" of a rented unit = its active lease with the latest end_date (0003 allows a future-dated lease to
-- be active next to the running one, and the latest end is when the unit really frees up). A lease past its end date
-- but still active (grace week) counts, with an end date in the past.
create or replace function public.check_listing_publishable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status   text;
  v_archived boolean;
  v_end      date;
begin
  -- FOR SHARE: a lease activating on the same unit (which locks the row FOR UPDATE) must finish first, so we
  -- never publish on a status that is about to change.
  select u.status, (u.archived_at is not null or p.archived_at is not null)
  into v_status, v_archived
  from public.units u
  join public.properties p on p.id = u.property_id and p.organization_id = u.organization_id
  where u.id = new.unit_id and u.organization_id = new.organization_id
  for share of u;
  if not found then
    return new;  -- unknown unit or other organization: the foreign key refuses the row
  end if;

  if v_archived then
    raise exception 'LISTING_UNIT_ARCHIVED' using errcode = '23514';
  end if;

  if new.kind = 'rent' then
    if v_status = 'rented' then
      select max(l.end_date) into v_end
      from public.lease_units lu
      join public.leases l on l.id = lu.lease_id and l.status = 'active'
      where lu.unit_id = new.unit_id;
      if v_end is null or v_end > public.today_tunis() + 90 or new.available_from is null or new.available_from <= v_end then
        raise exception 'LISTING_UNIT_NOT_RENTABLE' using errcode = '23514';
      end if;
    elsif v_status <> 'vacant' then
      raise exception 'LISTING_UNIT_NOT_RENTABLE' using errcode = '23514';
    end if;
  elsif v_status not in ('for_sale', 'rented') then
    raise exception 'LISTING_UNIT_NOT_SELLABLE' using errcode = '23514';
  end if;

  if new.price is null then
    raise exception 'LISTING_NEEDS_PRICE' using errcode = '23514';
  end if;

  if not exists (select 1 from public.property_files pf where pf.unit_id = new.unit_id and pf.kind = 'photo') then
    raise exception 'LISTING_NEEDS_PHOTO' using errcode = '23514';
  end if;

  if new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger listings_check_publishable
  before insert or update of status, kind, unit_id, organization_id, price, available_from on public.listings
  for each row when (new.status = 'published')
  execute function public.check_listing_publishable();

-- A lease that becomes active takes its units off the market: their open rent listings are closed.
-- (A lease only gets its units while it is a draft, so the units exist by the time it turns active.)
-- The unit rows are locked first, in a fixed order, like sync_unit_status does, so a listing being published at the
-- same moment is either seen here or refuses to publish on the new status.
create or replace function public.close_rent_listings_on_lease_active()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit uuid;
begin
  for v_unit in select unit_id from public.lease_units where lease_id = new.id order by unit_id loop
    perform 1 from public.units where id = v_unit for update;
    update public.listings
    set status = 'closed', closed_reason = 'leased'
    where unit_id = v_unit and kind = 'rent' and status <> 'closed';
  end loop;
  return null;
end;
$$;

create trigger leases_close_rent_listings after update of status on public.leases
  for each row when (new.status = 'active' and old.status is distinct from 'active')
  execute function public.close_rent_listings_on_lease_active();

-- An archived unit has no listing left, whatever its kind or status. Un-archiving reopens nothing.
create or replace function public.close_listings_on_unit_archived()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.listings
  set status = 'closed', closed_reason = 'unit_archived'
  where unit_id = new.id and status <> 'closed';
  return null;
end;
$$;

create trigger units_close_listings after update of archived_at on public.units
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function public.close_listings_on_unit_archived();

-- Only the Hasura database role (and the owner) may run the trigger functions directly.
do $$
declare
  v_fn   text;
  v_role text;
begin
  foreach v_fn in array array[
    'public.check_listing_publishable()',
    'public.close_rent_listings_on_lease_active()',
    'public.close_listings_on_unit_archived()'
  ] loop
    execute format('revoke execute on function %s from public', v_fn);
    foreach v_role in array array['nhost_hasura', 'postgres'] loop
      if exists (select 1 from pg_roles where rolname = v_role) then
        execute format('grant execute on function %s to %I', v_fn, v_role);
      end if;
    end loop;
  end loop;
end $$;

-- Public listings: published listings of units (and biens) that are not archived. Plain view, owned by the role that
-- runs this migration, with the default security_invoker = off: it reads the base tables with its owner's rights, so
-- the front office can show unit and bien columns without any permission on units, properties or property_files.
-- No table in this schema uses row level security; Hasura decides who may read what, and the unauthenticated public
-- role gets select on this view (and on public_listing_photos) only, always filtered by organization_id.
-- Coordinates are rounded to 3 decimals (about 100 m): the exact address is not public. A published listing whose
-- photos were all deleted stays here with cover_file_id null and photo_count 0; the page shows a placeholder.
-- Cover = the photo flagged is_cover, else the lowest sort_order; created_at then id break ties so it never flips.
create view public.public_listings as
select l.id, l.organization_id, l.unit_id, l.kind, l.title, l.description, l.price, l.charges, l.deposit_months,
       l.reservation_deposit, l.reservation_days, l.available_from, l.furnished, l.amenities, l.virtual_tour_url,
       l.published_at,
       u.type as unit_type, u.rooms, u.surface_m2, u.floor, u.status as unit_status,
       p.city, p.governorate,
       round(p.latitude, 3) as latitude,
       round(p.longitude, 3) as longitude,
       ph.cover_file_id,
       ph.photo_count
from public.listings l
join public.units u on u.id = l.unit_id and u.organization_id = l.organization_id and u.archived_at is null
join public.properties p on p.id = u.property_id and p.organization_id = u.organization_id and p.archived_at is null
left join lateral (
  select (array_agg(pf.storage_file_id order by pf.is_cover desc, pf.sort_order, pf.created_at, pf.id))[1] as cover_file_id,
         count(*)::integer as photo_count
  from public.property_files pf
  where pf.unit_id = l.unit_id and pf.kind = 'photo'
) ph on true
where l.status = 'published';

-- Photos of the public listings, cover first then sort_order (same order as the cover above), position from 1.
-- Built on public_listings so both views always agree on which listings are visible.
create view public.public_listing_photos as
select pl.id as listing_id, pf.storage_file_id,
       (row_number() over (partition by pl.id order by pf.is_cover desc, pf.sort_order, pf.created_at, pf.id))::integer as position,
       pl.organization_id
from public.public_listings pl
join public.property_files pf on pf.unit_id = pl.unit_id and pf.kind = 'photo';
