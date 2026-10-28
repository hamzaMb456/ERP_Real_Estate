-- Tests for 0005_listings. Paste into the legacy console SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0005_listings.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error « OK: all listing tests passed ». Failure: an error starting with « FAIL ».

-- Fixture helper: a draft lease with one unit, one renter and the first rent (same as the 0003 tests).
create function pg_temp.mk_lease(p_id uuid, p_org uuid, p_unit uuid, p_renter uuid, p_start date, p_end date, p_rent numeric default 500)
returns void language plpgsql as $$
begin
  insert into public.leases (id, organization_id, start_date, end_date) values (p_id, p_org, p_start, p_end);
  insert into public.lease_units (organization_id, lease_id, unit_id) values (p_org, p_id, p_unit);
  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values (p_org, p_id, p_renter, 'renter');
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount) values (p_org, p_id, p_unit, p_start, p_rent);
end $$;

-- Fixture helper: one photo of a unit (a storage file in the property-files bucket and its property_files row).
create function pg_temp.mk_photo(p_file uuid, p_org uuid, p_unit uuid, p_sort integer, p_cover boolean default false)
returns void language plpgsql as $$
begin
  insert into storage.files (id, bucket_id) values (p_file, 'property-files');
  insert into public.property_files (organization_id, unit_id, storage_file_id, kind, title, is_cover, sort_order)
  values (p_org, p_unit, p_file, 'photo', 'Photo', p_cover, p_sort);
end $$;

do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br     uuid := '21111111-1111-4111-8111-111111111111';
  org2   uuid := 'c0000000-0000-4000-8000-000000000002';
  prop   uuid := 'c0000000-0000-4000-8000-000000000003';
  prop2  uuid := 'c0000000-0000-4000-8000-000000000004';
  -- units
  u_vac    uuid := 'c0000000-0000-4000-8000-000000000011';  -- vacant, three photos (cover, order)
  u_nophoto uuid := 'c0000000-0000-4000-8000-000000000012'; -- vacant, no photo
  u_sale   uuid := 'c0000000-0000-4000-8000-000000000013';  -- for_sale, one photo
  u_r60    uuid := 'c0000000-0000-4000-8000-000000000014';  -- rented, lease ends in 60 days
  u_r120   uuid := 'c0000000-0000-4000-8000-000000000015';  -- rented, lease ends in 120 days
  u_new    uuid := 'c0000000-0000-4000-8000-000000000016';  -- vacant, activated through activate_lease
  u_direct uuid := 'c0000000-0000-4000-8000-000000000017';  -- vacant, activated by a plain status update
  u_arch   uuid := 'c0000000-0000-4000-8000-000000000018';  -- for_sale, archived later
  u_ghost  uuid := 'c0000000-0000-4000-8000-000000000019';  -- 'rented' without any active lease
  u_prop2  uuid := 'c0000000-0000-4000-8000-00000000001a';  -- vacant, in a property archived later
  c1 uuid := 'c0000000-0000-4000-8000-000000000021';
  l_r60 uuid := 'c0000000-0000-4000-8000-000000000101'; l_r120 uuid := 'c0000000-0000-4000-8000-000000000102';
  l_new uuid := 'c0000000-0000-4000-8000-000000000103'; l_direct uuid := 'c0000000-0000-4000-8000-000000000104';
  l_next uuid := 'c0000000-0000-4000-8000-000000000105';
  f1 uuid := 'c0000000-0000-4000-8000-000000000201'; f2 uuid := 'c0000000-0000-4000-8000-000000000202';
  f3 uuid := 'c0000000-0000-4000-8000-000000000203'; f4 uuid := 'c0000000-0000-4000-8000-000000000204';
  f5 uuid := 'c0000000-0000-4000-8000-000000000205'; f6 uuid := 'c0000000-0000-4000-8000-000000000206';
  f7 uuid := 'c0000000-0000-4000-8000-000000000207'; f8 uuid := 'c0000000-0000-4000-8000-000000000208';
  f9 uuid := 'c0000000-0000-4000-8000-000000000209'; f10 uuid := 'c0000000-0000-4000-8000-00000000020a';
  f11 uuid := 'c0000000-0000-4000-8000-00000000020b';
  li1 uuid := 'c0000000-0000-4000-8000-000000000301'; li2 uuid := 'c0000000-0000-4000-8000-000000000302';
  li3 uuid := 'c0000000-0000-4000-8000-000000000303'; li4 uuid := 'c0000000-0000-4000-8000-000000000304';
  li5 uuid := 'c0000000-0000-4000-8000-000000000305'; li6 uuid := 'c0000000-0000-4000-8000-000000000306';
  li7 uuid := 'c0000000-0000-4000-8000-000000000307'; li8 uuid := 'c0000000-0000-4000-8000-000000000308';
  li9 uuid := 'c0000000-0000-4000-8000-000000000309';
  li11 uuid := 'c0000000-0000-4000-8000-00000000030b'; li12 uuid := 'c0000000-0000-4000-8000-00000000030c';
  li13 uuid := 'c0000000-0000-4000-8000-00000000030d'; li14 uuid := 'c0000000-0000-4000-8000-00000000030e';
  li15 uuid := 'c0000000-0000-4000-8000-00000000030f'; li16 uuid := 'c0000000-0000-4000-8000-000000000310';
  s_ok     json;
  v_today  date := public.today_tunis();
  v_text   text; v_uuid uuid; v_uuid2 uuid; v_ts timestamptz; v_ts2 timestamptz; v_int integer; v_num numeric; v_arr uuid[]; v_ints integer[];
begin
  s_ok := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org);

  insert into organizations (id, name) values (org2, 'Autre organisation');
  insert into properties (id, organization_id, branch_id, name, type, city, governorate, latitude, longitude)
  values (prop, org, br, 'Bien test annonces', 'building', 'Carthage', 'Tunis', 36.852800, 10.323300),
         (prop2, org, br, 'Bien test annonces 2', 'building', 'Sousse', 'Sousse', null, null);
  insert into units (id, organization_id, property_id, code, type, rooms, surface_m2, floor, status) values
    (u_vac,     org, prop, 'A-1', 'apartment', 3, 92.5, 2, 'vacant'),
    (u_nophoto, org, prop, 'A-2', 'apartment', 2, 60,   1, 'vacant'),
    (u_sale,    org, prop, 'A-3', 'apartment', 4, 110,  3, 'for_sale'),
    (u_r60,     org, prop, 'A-4', 'apartment', 3, 90,   4, 'vacant'),
    (u_r120,    org, prop, 'A-5', 'apartment', 3, 90,   5, 'vacant'),
    (u_new,     org, prop, 'A-6', 'apartment', 3, 90,   6, 'vacant'),
    (u_direct,  org, prop, 'A-7', 'apartment', 3, 90,   7, 'vacant'),
    (u_arch,    org, prop, 'A-8', 'apartment', 3, 90,   8, 'for_sale'),
    (u_ghost,   org, prop, 'A-9', 'apartment', 3, 90,   9, 'rented'),
    (u_prop2,   org, prop2, 'B-1', 'apartment', 3, 90,  1, 'vacant');
  insert into contacts (id, organization_id, full_name) values (c1, org, 'Locataire Annonces');

  perform pg_temp.mk_photo(f1, org, u_vac, 2);
  perform pg_temp.mk_photo(f2, org, u_vac, 1);
  perform pg_temp.mk_photo(f3, org, u_vac, 9, true);   -- the cover, although it has the highest sort_order
  perform pg_temp.mk_photo(f4, org, u_sale, 0);
  perform pg_temp.mk_photo(f5, org, u_r60, 0);
  perform pg_temp.mk_photo(f6, org, u_r120, 0);
  perform pg_temp.mk_photo(f7, org, u_new, 0);
  perform pg_temp.mk_photo(f8, org, u_direct, 0);
  perform pg_temp.mk_photo(f9, org, u_arch, 0);
  perform pg_temp.mk_photo(f10, org, u_ghost, 0);
  perform pg_temp.mk_photo(f11, org, u_prop2, 0);

  -- Two running leases: u_r60 ends in 60 days, u_r120 in 120 days (the unit becomes rented through 0003's trigger).
  perform pg_temp.mk_lease(l_r60, org, u_r60, c1, v_today - 300, v_today + 60);
  perform pg_temp.mk_lease(l_r120, org, u_r120, c1, v_today - 245, v_today + 120);
  update leases set status = 'active' where id in (l_r60, l_r120);
  select status into v_text from units where id = u_r60;
  if v_text <> 'rented' then raise exception 'FAIL 0: fixture unit u_r60 is %', v_text; end if;

  -- 1. Publishing needs a price (on insert and on update).
  insert into listings (id, organization_id, unit_id, kind, title) values (li1, org, u_vac, 'rent', 'T3 Carthage');
  begin
    update listings set status = 'published' where id = li1;
    raise exception 'FAIL 1a: published without a price';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_NEEDS_PRICE' then raise exception 'FAIL 1a: wrong error: %', sqlerrm; end if;
  end;
  begin
    insert into listings (organization_id, unit_id, kind, status, title) values (org, u_sale, 'sale', 'published', 'Vente');
    raise exception 'FAIL 1b: inserted already published without a price';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_NEEDS_PRICE' then raise exception 'FAIL 1b: wrong error: %', sqlerrm; end if;
  end;
  select status || '/' || coalesce(published_at::text, 'null') into v_text from listings where id = li1;
  if v_text <> 'draft/null' then raise exception 'FAIL 1c: failed publish left % behind', v_text; end if;

  -- 2. Publishing needs at least one photo of the unit.
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li2, org, u_nophoto, 'rent', 'Sans photo', 700);
  begin
    update listings set status = 'published' where id = li2;
    raise exception 'FAIL 2: published without a photo';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_NEEDS_PHOTO' then raise exception 'FAIL 2: wrong error: %', sqlerrm; end if;
  end;
  -- a document does not count as a photo
  insert into storage.files (id, bucket_id) values ('c0000000-0000-4000-8000-0000000002ff', 'property-files');
  insert into property_files (organization_id, unit_id, storage_file_id, kind, category, title)
  values (org, u_nophoto, 'c0000000-0000-4000-8000-0000000002ff', 'document', 'plan', 'Plan');
  begin
    update listings set status = 'published' where id = li2;
    raise exception 'FAIL 2b: a document was taken for a photo';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_NEEDS_PHOTO' then raise exception 'FAIL 2b: wrong error: %', sqlerrm; end if;
  end;

  -- 3. A rent listing needs a vacant unit (or a rented one about to be free): not a unit for sale.
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li3, org, u_sale, 'rent', 'Location A-3', 900);
  begin
    update listings set status = 'published' where id = li3;
    raise exception 'FAIL 3a: rent listing published on a unit for sale';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_RENTABLE' then raise exception 'FAIL 3a: wrong error: %', sqlerrm; end if;
  end;
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li4, org, u_ghost, 'rent', 'Fantome', 900);
  begin
    update listings set status = 'published' where id = li4;
    raise exception 'FAIL 3b: rent listing published on a rented unit without an active lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_RENTABLE' then raise exception 'FAIL 3b: wrong error: %', sqlerrm; end if;
  end;

  -- 4. A rented unit whose lease ends in 60 days: published only with available_from after the end date.
  insert into listings (id, organization_id, unit_id, kind, title, price, available_from)
  values (li5, org, u_r60, 'rent', 'Bientot libre', 800, v_today + 60);
  begin
    update listings set status = 'published' where id = li5;
    raise exception 'FAIL 4a: available_from = the end date accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_RENTABLE' then raise exception 'FAIL 4a: wrong error: %', sqlerrm; end if;
  end;
  update listings set available_from = null where id = li5;
  begin
    update listings set status = 'published' where id = li5;
    raise exception 'FAIL 4b: no available_from accepted on a rented unit';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_RENTABLE' then raise exception 'FAIL 4b: wrong error: %', sqlerrm; end if;
  end;
  update listings set available_from = v_today + 61 where id = li5;
  update listings set status = 'published' where id = li5;
  select published_at into v_ts from listings where id = li5;
  if v_ts is null then raise exception 'FAIL 4c: published_at not set'; end if;

  -- 5. Lease ending in 120 days: too far.
  insert into listings (id, organization_id, unit_id, kind, title, price, available_from)
  values (li6, org, u_r120, 'rent', 'Trop loin', 800, v_today + 121);
  begin
    update listings set status = 'published' where id = li6;
    raise exception 'FAIL 5: lease ending in 120 days accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_RENTABLE' then raise exception 'FAIL 5: wrong error: %', sqlerrm; end if;
  end;

  -- 6. A sale listing needs a unit for sale or rented; not a vacant one.
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li7, org, u_vac, 'sale', 'Vente A-1', 350000);
  begin
    update listings set status = 'published' where id = li7;
    raise exception 'FAIL 6a: sale listing published on a vacant unit';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_NOT_SELLABLE' then raise exception 'FAIL 6a: wrong error: %', sqlerrm; end if;
  end;
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li8, org, u_r60, 'sale', 'Vendu loue', 300000);
  update listings set status = 'published' where id = li8;           -- rented: allowed
  insert into listings (id, organization_id, unit_id, kind, status, title, price) values (li9, org, u_sale, 'sale', 'published', 'Vente A-3', 410000);

  -- 7. One open listing per unit and kind; a closed one does not count.
  begin
    insert into listings (organization_id, unit_id, kind, title, price) values (org, u_r60, 'rent', 'Doublon', 800);
    raise exception 'FAIL 7a: second open rent listing accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_one_open_per_unit_kind%' then raise exception 'FAIL 7a: wrong error: %', sqlerrm; end if;
  end;
  insert into listings (organization_id, unit_id, kind, status, closed_reason, title, price)
  values (org, u_r60, 'rent', 'closed', 'manual', 'Ancienne annonce', 800);   -- closed: fine
  begin
    -- li1 (a draft) is the open rent listing of u_vac: drafts and paused listings count as open
    insert into listings (organization_id, unit_id, kind, title, price) values (org, u_vac, 'rent', 'Doublon vac', 800);
    raise exception 'FAIL 7b: second open rent listing of u_vac accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_one_open_per_unit_kind%' then raise exception 'FAIL 7b: wrong error: %', sqlerrm; end if;
  end;

  -- 8. Column checks: price, amenities, deposit, tour link, and the organization of the unit.
  begin
    insert into listings (organization_id, unit_id, kind, title, price) values (org, u_nophoto, 'sale', 'Prix nul', 0);
    raise exception 'FAIL 8a: price 0 accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_price_check%' then raise exception 'FAIL 8a: wrong error: %', sqlerrm; end if;
  end;
  begin
    insert into listings (organization_id, unit_id, kind, title, amenities) values (org, u_nophoto, 'sale', 'Equipement', array['pool']);
    raise exception 'FAIL 8b: unknown amenity accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_amenities_check%' then raise exception 'FAIL 8b: wrong error: %', sqlerrm; end if;
  end;
  insert into listings (organization_id, unit_id, kind, title, amenities)
  values (org, u_nophoto, 'sale', 'Equipements ok', array['parking', 'lift', 'sea_view']);
  begin
    insert into listings (organization_id, unit_id, kind, title, virtual_tour_url) values (org, u_prop2, 'rent', 'Visite', 'javascript:alert(1)');
    raise exception 'FAIL 8c: javascript: tour link accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_virtual_tour_url_check%' then raise exception 'FAIL 8c: wrong error: %', sqlerrm; end if;
  end;
  begin
    insert into listings (organization_id, unit_id, kind, title) values (org2, u_prop2, 'rent', 'Autre org');
    raise exception 'FAIL 8d: a unit of another organization accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%foreign key%' then raise exception 'FAIL 8d: wrong error: %', sqlerrm; end if;
  end;
  begin
    insert into listings (organization_id, unit_id, kind, title) values (org, u_prop2, 'rent', '   ');
    raise exception 'FAIL 8e: blank title accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%listings_title_check%' then raise exception 'FAIL 8e: wrong error: %', sqlerrm; end if;
  end;

  -- 9. Public view: published listings only. li1 draft, li5 published, li8 published, li9 published.
  update listings set status = 'published', price = 650, available_from = null where id = li1;
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li11, org, u_r120, 'sale', 'Brouillon vente', 1);
  insert into listings (id, organization_id, unit_id, kind, status, title, price) values (li12, org, u_ghost, 'sale', 'published', 'Pause bientot', 200000);
  update listings set status = 'paused' where id = li12;
  select count(*) into v_int from public_listings where id in (li1, li5, li8, li9);
  if v_int <> 4 then raise exception 'FAIL 9a: % of the 4 published listings are visible', v_int; end if;
  if exists (select 1 from public_listings where id in (li2, li3, li4, li6, li7, li11, li12)) then
    raise exception 'FAIL 9b: a draft or paused listing is public';
  end if;
  -- published_at survives a pause and a second publish
  select published_at into v_ts from listings where id = li12;
  update listings set status = 'published' where id = li12;
  select published_at into v_ts2 from listings where id = li12;
  if v_ts is null or v_ts2 is distinct from v_ts then raise exception 'FAIL 9c: published_at % then %', v_ts, v_ts2; end if;
  update listings set status = 'paused' where id = li12;
  -- price cannot be removed from a published listing
  begin
    update listings set price = null where id = li1;
    raise exception 'FAIL 9d: price removed from a published listing';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_NEEDS_PRICE' then raise exception 'FAIL 9d: wrong error: %', sqlerrm; end if;
  end;
  -- ... but the title can change without the rules being replayed
  update listings set title = 'T3 Carthage, vue mer' where id = li1;

  -- 10. Unit and property columns, rounded coordinates (36.8528 -> 36.853, 10.3233 -> 10.323).
  select latitude::text || '/' || longitude::text || '/' || unit_type || '/' || rooms || '/' || surface_m2::text || '/' || floor || '/' || unit_status || '/' || city || '/' || governorate
  into v_text from public_listings where id = li1;
  if v_text <> '36.853/10.323/apartment/3/92.50/2/vacant/Carthage/Tunis' then raise exception 'FAIL 10a: row is %', v_text; end if;
  select 1 into v_int from public_listings where id = li1 and latitude::text ~ '^-?[0-9]+\.[0-9]{3}$' and longitude::text ~ '^-?[0-9]+\.[0-9]{3}$';
  if v_int is null then raise exception 'FAIL 10b: coordinates are not rounded to 3 decimals'; end if;
  select deposit_months::text || '/' || reservation_deposit::text || '/' || reservation_days::text || '/' || furnished::text || '/' || coalesce(array_length(amenities, 1), 0)::text
  into v_text from public_listings where id = li1;
  if v_text <> '2/10000.000/15/false/0' then raise exception 'FAIL 10c: defaults are %', v_text; end if;

  -- 11. Photos: the cover first, then sort_order; cover_file_id and photo_count agree.
  select cover_file_id, photo_count into v_uuid, v_int from public_listings where id = li1;
  if v_uuid <> f3 or v_int <> 3 then raise exception 'FAIL 11a: cover % count %', v_uuid, v_int; end if;
  select array_agg(storage_file_id order by position), array_agg(position order by position)
  into v_arr, v_ints from public_listing_photos where listing_id = li1;
  if v_arr <> array[f3, f2, f1] or v_ints <> array[1, 2, 3] then raise exception 'FAIL 11b: photos % at %', v_arr, v_ints; end if;
  -- no cover flagged: the lowest sort_order is the cover, and the view needs no photo of other units
  select cover_file_id into v_uuid from public_listings where id = li9;
  if v_uuid <> f4 then raise exception 'FAIL 11c: cover of li9 is %', v_uuid; end if;
  select count(*) into v_int from public_listing_photos where listing_id = li9;
  if v_int <> 1 then raise exception 'FAIL 11d: li9 has % photos', v_int; end if;
  -- draft and paused listings have no public photos either
  if exists (select 1 from public_listing_photos where listing_id in (li2, li3, li12)) then
    raise exception 'FAIL 11e: photos of a non-published listing are public';
  end if;
  -- same sort_order and no cover: created_at then id decide, so the cover never flips between reads
  update property_files set is_cover = false, sort_order = 5 where unit_id = u_vac;
  select cover_file_id into v_uuid from public_listings where id = li1;
  select storage_file_id into v_uuid2 from property_files where unit_id = u_vac order by created_at, id limit 1;
  if v_uuid <> v_uuid2 then raise exception 'FAIL 11f: tie not broken by created_at, id'; end if;
  -- all photos deleted after publishing: the listing stays in the view with no cover (the page shows a placeholder)
  delete from property_files where unit_id = u_vac;
  select photo_count, cover_file_id into v_int, v_uuid from public_listings where id = li1;
  if v_int <> 0 or v_uuid is not null then raise exception 'FAIL 11g: count % cover %', v_int, v_uuid; end if;
  if exists (select 1 from public_listing_photos where listing_id = li1) then raise exception 'FAIL 11h: photos left'; end if;

  -- 12. Activating a lease through activate_lease closes the open rent listing of its unit (reason leased)
  --     and keeps the sale listing; the listing leaves public_listings.
  insert into listings (id, organization_id, unit_id, kind, status, title, price) values (li13, org, u_new, 'rent', 'published', 'Libre A-6', 900);
  if not exists (select 1 from public_listings where id = li13) then raise exception 'FAIL 12a: li13 not public'; end if;
  perform pg_temp.mk_lease(l_new, org, u_new, c1, v_today, v_today + 365);
  perform 1 from public.activate_lease(l_new, v_today, s_ok);
  select status || '/' || coalesce(closed_reason, 'null') into v_text from listings where id = li13;
  if v_text <> 'closed/leased' then raise exception 'FAIL 12b: listing is %', v_text; end if;
  if exists (select 1 from public_listings where id = li13) then raise exception 'FAIL 12c: closed listing still public'; end if;
  -- u_r60: a new lease starting after the current one ends closes the rent listing li5 but not the sale listing li8
  perform pg_temp.mk_lease(l_next, org, u_r60, c1, v_today + 61, v_today + 426);
  select status into v_text from listings where id = li5;
  if v_text <> 'published' then raise exception 'FAIL 12d: a draft lease closed the listing (%)', v_text; end if;
  perform 1 from public.activate_lease(l_next, v_today, s_ok);
  select status || '/' || coalesce(closed_reason, 'null') into v_text from listings where id = li5;
  if v_text <> 'closed/leased' then raise exception 'FAIL 12e: rent listing is %', v_text; end if;
  select status into v_text from listings where id = li8;
  if v_text <> 'published' then raise exception 'FAIL 12f: sale listing is %', v_text; end if;
  -- a plain status update on a draft lease (the way 0003's tests and seeds activate) closes it too
  insert into listings (id, organization_id, unit_id, kind, status, title, price) values (li14, org, u_direct, 'rent', 'published', 'Libre A-7', 900);
  perform pg_temp.mk_lease(l_direct, org, u_direct, c1, v_today, v_today + 365);
  update leases set status = 'active' where id = l_direct;
  select status || '/' || coalesce(closed_reason, 'null') into v_text from listings where id = li14;
  if v_text <> 'closed/leased' then raise exception 'FAIL 12g: listing is %', v_text; end if;

  -- 13. Archiving a unit closes all its open listings (reason unit_archived) and removes them from the view;
  --     an archived unit cannot be published.
  insert into listings (id, organization_id, unit_id, kind, title, price) values (li15, org, u_arch, 'rent', 'Brouillon A-8', 700);
  insert into listings (id, organization_id, unit_id, kind, status, title, price) values (li16, org, u_arch, 'sale', 'published', 'Vente A-8', 500000);
  if not exists (select 1 from public_listings where id = li16) then raise exception 'FAIL 13a: li16 not public'; end if;
  update units set archived_at = now() where id = u_arch;
  select string_agg(status || '/' || coalesce(closed_reason, 'null'), ',' order by kind) into v_text from listings where unit_id = u_arch;
  if v_text <> 'closed/unit_archived,closed/unit_archived' then raise exception 'FAIL 13b: listings are %', v_text; end if;
  if exists (select 1 from public_listings where unit_id = u_arch) then raise exception 'FAIL 13c: archived unit still public'; end if;
  begin
    insert into listings (organization_id, unit_id, kind, status, title, price) values (org, u_arch, 'sale', 'published', 'Revente', 1);
    raise exception 'FAIL 13d: published on an archived unit';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_ARCHIVED' then raise exception 'FAIL 13d: wrong error: %', sqlerrm; end if;
  end;
  -- Un-archiving does not reopen anything.
  update units set archived_at = null where id = u_arch;
  select count(*) into v_int from listings where unit_id = u_arch and status <> 'closed';
  if v_int <> 0 then raise exception 'FAIL 13e: % listings reopened', v_int; end if;

  -- 14. An archived unit that is already hidden through an archived property: the view follows the property
  --     (the web archives the property row only) and publishing is refused.
  insert into listings (id, organization_id, unit_id, kind, status, title, price)
  values ('c0000000-0000-4000-8000-000000000320', org, u_prop2, 'rent', 'published', 'Sousse', 600);
  if not exists (select 1 from public_listings where id = 'c0000000-0000-4000-8000-000000000320') then
    raise exception 'FAIL 14a: listing of an active property not public';
  end if;
  update properties set archived_at = now() where id = prop2;
  if exists (select 1 from public_listings where id = 'c0000000-0000-4000-8000-000000000320') then
    raise exception 'FAIL 14b: listing of an archived property still public';
  end if;
  begin
    update listings set status = 'paused' where id = 'c0000000-0000-4000-8000-000000000320';
    update listings set status = 'published' where id = 'c0000000-0000-4000-8000-000000000320';
    raise exception 'FAIL 14c: published on an archived property';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'LISTING_UNIT_ARCHIVED' then raise exception 'FAIL 14c: wrong error: %', sqlerrm; end if;
  end;

  -- 15. updated_at follows updates; the trigger functions are not callable by everybody.
  update listings set updated_at = now() - interval '1 day' where id = li1;   -- trigger overwrites it
  if (select updated_at from listings where id = li1) < now() - interval '1 minute' then
    raise exception 'FAIL 15a: updated_at not maintained';
  end if;
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
             where p.oid = 'public.check_listing_publishable()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception 'FAIL 15b: check_listing_publishable() executable by public';
  end if;

  raise exception 'OK: all listing tests passed';
end $$;
