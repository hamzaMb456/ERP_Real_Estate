-- 0006_units_on_website: units appear on the client site by themselves. The staff "listing" step is gone: the website
-- fields live on the unit, and public_listings is rebuilt from units. Apply after 0005, then run
-- db/tests/0006_units_on_website.test.sql.
-- ASCII only: this file travels through the clipboard, so French text never appears here.
--
-- A unit is on the website when ALL of these hold:
--   - show_on_website is true (admin toggle, default true)
--   - the unit and its bien are not archived
--   - (status vacant and rent_amount > 0) or (status for_sale and sale_price > 0)
--   - the unit has at least one photo of its own (property_files, kind 'photo'; bien photos are ERP only)
-- The old listings table (0005) stays in place but nothing reads or writes it anymore.

alter table public.units
  add column title           text,
  add column description     text,
  add column sale_price      numeric(12, 3),
  add column charges         numeric(12, 3),
  add column available_from  date,
  add column furnished       boolean not null default false,
  add column amenities       text[] not null default '{}',
  add column show_on_website boolean not null default true;

alter table public.units
  add constraint units_title_check check (title is null or length(trim(title)) > 0),
  add constraint units_sale_price_check check (sale_price is null or sale_price > 0),
  add constraint units_charges_check check (charges is null or charges >= 0),
  add constraint units_amenities_check check (
    amenities <@ array['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen']::text[]
  );

-- Carry over what staff already wrote in the 0005 listings: for each unit, its published listing, else its latest
-- open (draft or paused) one. Texts, charges, availability, furnishing and amenities move onto the unit; the price
-- becomes sale_price for a sale listing, or the rent when the unit has none. Closed listings are history and ignored.
-- Units without any listing are untouched.
update public.units u
set title          = l.title,
    description    = l.description,
    sale_price     = case when l.kind = 'sale' then l.price else u.sale_price end,
    charges        = case when l.kind = 'rent' then l.charges else u.charges end,
    rent_amount    = case when l.kind = 'rent' and coalesce(u.rent_amount, 0) = 0 then l.price else u.rent_amount end,
    available_from = l.available_from,
    furnished      = l.furnished,
    amenities      = l.amenities
from (
  select distinct on (unit_id) *
  from public.listings
  where status <> 'closed'
  order by unit_id, (status = 'published') desc, updated_at desc, id
) l
where l.unit_id = u.id and l.organization_id = u.organization_id;

-- Public listings, one row per visible unit; the row id is the unit id (the site links to /logement/<unit id>).
-- The columns, their order and their types are exactly those of the 0005 view, so create or replace keeps the data layer's
-- tracking, relationships and permissions valid. Columns a unit has no value for are constants: the deposit and
-- reservation terms use the defaults the 0005 listings had, there is no virtual tour, and published_at is the unit's
-- creation date (it only orders "latest first").
-- Plain view, owned by the role that runs this migration, with the default security_invoker = off: it reads the base
-- tables with its owner's rights, so the front office needs no permission on units, properties or property_files.
-- Coordinates are rounded to 3 decimals (about 100 m): the exact address is not public.
-- Cover = the photo flagged is_cover, else the lowest sort_order; created_at then id break ties so it never flips.
create or replace view public.public_listings as
select u.id,
       u.organization_id,
       u.id as unit_id,
       (case when u.status = 'for_sale' then 'sale' else 'rent' end)::text as kind,
       coalesce(nullif(btrim(u.title), ''), p.name || ' - ' || u.code)::text as title,
       u.description,
       (case when u.status = 'for_sale' then u.sale_price else u.rent_amount end)::numeric(12, 3) as price,
       (case when u.status = 'for_sale' then null else u.charges end)::numeric(12, 3) as charges,
       2::smallint as deposit_months,
       10000::numeric(12, 3) as reservation_deposit,
       15::smallint as reservation_days,
       u.available_from,
       u.furnished,
       u.amenities,
       null::text as virtual_tour_url,
       u.created_at as published_at,
       u.type as unit_type, u.rooms, u.surface_m2, u.floor, u.status as unit_status,
       p.city, p.governorate,
       round(p.latitude, 3) as latitude,
       round(p.longitude, 3) as longitude,
       ph.cover_file_id,
       ph.photo_count
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

-- public_listing_photos (0005) is built on public_listings and joins the unit's photos on unit_id, with
-- listing_id = the row id: it keeps working unchanged and still agrees with the view above.
