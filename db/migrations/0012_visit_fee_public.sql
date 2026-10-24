-- Expose units.visit_fee (0010) and the organization's visit_payment_method (0011) on public_listings. Apply after 0011.
-- ASCII only: this file travels through the clipboard, so French text never appears here.

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
       p.neighbourhood_description,
       u.visit_fee,
       o.visit_payment_method
from public.units u
join public.properties p on p.id = u.property_id and p.organization_id = u.organization_id
join public.organizations o on o.id = u.organization_id
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
