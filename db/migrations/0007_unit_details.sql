-- 0007_unit_details: the details a visitor wants before calling (bedrooms, bathrooms, parking, condition, orientation,
-- outdoor area, energy class, legal status, pets, lease terms, included charges, deposit and reservation terms, virtual
-- tour) on units, and year built, floors and neighbourhood text on properties. public_listings exposes them.
-- Apply after 0006, then run db/tests/0007_unit_details.test.sql.
-- ASCII only: this file travels through the clipboard, so French text never appears here.

alter table public.units
  add column bedrooms           smallint check (bedrooms between 0 and 50),
  add column bathrooms          smallint check (bathrooms between 0 and 50),
  add column parking_spaces     smallint check (parking_spaces between 0 and 50),
  add column property_condition text check (property_condition in ('new', 'excellent', 'good', 'to_refresh', 'to_renovate')),
  -- Rent: deposit in months of rent. 2 is what every public listing showed before this column existed.
  add column deposit_months     smallint not null default 2 check (deposit_months between 0 and 12),
  -- null = not specified (nothing is shown), true = allowed, false = not allowed.
  add column pets_allowed       boolean,
  -- Sale: titled (titre foncier individuel), collective_title (titre foncier collectif), untitled (notarial deed only).
  add column legal_status       text check (legal_status in ('titled', 'collective_title', 'untitled')),
  -- Shown as a link on the public page: only web addresses, never javascript: or data: schemes.
  add column virtual_tour_url   text check (virtual_tour_url is null or virtual_tour_url ~* '^https?://'),
  add column orientation        text[] not null default '{}' check (orientation <@ array['north', 'south', 'east', 'west']::text[]),
  -- Balcony, terrace or garden surface.
  add column outdoor_area_m2    numeric(8, 2) check (outdoor_area_m2 > 0),
  add column energy_class       text check (energy_class in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  add column min_lease_months   smallint check (min_lease_months between 1 and 120),
  -- Which charges the monthly charges cover.
  add column charges_included   text[] not null default '{}'
    check (charges_included <@ array['water', 'electricity', 'gas', 'internet', 'syndic', 'heating']::text[]),
  -- Sale: the deposit that holds the unit and for how long. 10000 TND and 15 days are the values every listing showed.
  add column reservation_deposit numeric(12, 3) not null default 10000 check (reservation_deposit >= 0),
  add column reservation_days   smallint not null default 15 check (reservation_days between 1 and 90);

alter table public.properties
  add column year_built               smallint check (year_built between 1800 and 2100),
  add column floors_count             smallint check (floors_count between 1 and 200),
  add column neighbourhood_description text;

-- Same view as 0006 with the real values instead of constants (deposit_months, reservation_deposit, reservation_days,
-- virtual_tour_url keep their position and type) and the new columns appended at the end, so create or replace keeps
-- Hasura's tracking, relationships and permissions valid.
create or replace view public.public_listings as
select u.id,
       u.organization_id,
       u.id as unit_id,
       (case when u.status = 'for_sale' then 'sale' else 'rent' end)::text as kind,
       coalesce(nullif(btrim(u.title), ''), p.name || ' - ' || u.code)::text as title,
       u.description,
       (case when u.status = 'for_sale' then u.sale_price else u.rent_amount end)::numeric(12, 3) as price,
       (case when u.status = 'for_sale' then null else u.charges end)::numeric(12, 3) as charges,
       u.deposit_months,
       u.reservation_deposit,
       u.reservation_days,
       u.available_from,
       u.furnished,
       u.amenities,
       u.virtual_tour_url,
       u.created_at as published_at,
       u.type as unit_type, u.rooms, u.surface_m2, u.floor, u.status as unit_status,
       p.city, p.governorate,
       round(p.latitude, 3) as latitude,
       round(p.longitude, 3) as longitude,
       ph.cover_file_id,
       ph.photo_count,
       u.bedrooms,
       u.bathrooms,
       u.parking_spaces,
       u.property_condition,
       u.pets_allowed,
       u.legal_status,
       u.orientation,
       u.outdoor_area_m2,
       u.energy_class,
       u.min_lease_months,
       u.charges_included,
       p.year_built,
       p.floors_count,
       p.neighbourhood_description
from public.units u
join public.properties p on p.id = u.property_id and p.organization_id = u.organization_id
join lateral (
  select (array_agg(pf.storage_file_id order by pf.is_cover desc, pf.sort_order, pf.created_at, pf.id))[1] as cover_file_id,
         count(*)::integer as photo_count
  from public.property_files pf
  where pf.unit_id = u.id and pf.kind = 'photo'
) ph on ph.photo_count > 0
where u.show_on_website
  and u.archived_at is null
  and p.archived_at is null
  and ((u.status = 'vacant' and u.rent_amount > 0) or (u.status = 'for_sale' and u.sale_price > 0));
