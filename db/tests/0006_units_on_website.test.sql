-- Tests for 0006_units_on_website. Paste into the Nhost dashboard SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0006_units_on_website.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error "OK: all website tests passed". Failure: an error starting with "FAIL".
-- (The public-view sections of db/tests/0005_listings.test.sql describe the retired listings; run that file before 0006.)

-- Fixture helper: one photo of a unit or of a bien (a storage file in the property-files bucket and its row).
create function pg_temp.mk_photo(p_file uuid, p_org uuid, p_unit uuid, p_property uuid, p_sort integer, p_cover boolean default false)
returns void language plpgsql as $$
begin
  insert into storage.files (id, bucket_id) values (p_file, 'property-files');
  insert into public.property_files (organization_id, unit_id, property_id, storage_file_id, kind, title, is_cover, sort_order)
  values (p_org, p_unit, p_property, p_file, 'photo', 'Photo', p_cover, p_sort);
end $$;

do $$
declare
  org   uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br    uuid := '21111111-1111-4111-8111-111111111111';
  prop  uuid := 'd0000000-0000-4000-8000-000000000003';
  prop2 uuid := 'd0000000-0000-4000-8000-000000000004';
  u_rent   uuid := 'd0000000-0000-4000-8000-000000000011';  -- vacant, rent, three photos
  u_sale   uuid := 'd0000000-0000-4000-8000-000000000012';  -- for_sale, sale price, one photo
  u_nophoto uuid := 'd0000000-0000-4000-8000-000000000013'; -- vacant, rent, no photo
  u_bienph uuid := 'd0000000-0000-4000-8000-000000000014';  -- vacant, rent, only the bien has photos
  u_norent uuid := 'd0000000-0000-4000-8000-000000000015';  -- vacant, rent 0
  u_nosale uuid := 'd0000000-0000-4000-8000-000000000016';  -- for_sale without sale price
  u_hidden uuid := 'd0000000-0000-4000-8000-000000000017';  -- show_on_website false
  u_rented uuid := 'd0000000-0000-4000-8000-000000000018';  -- rented
  u_maint  uuid := 'd0000000-0000-4000-8000-000000000019';  -- under_maintenance
  u_arch   uuid := 'd0000000-0000-4000-8000-00000000001a';  -- archived unit
  u_prop2  uuid := 'd0000000-0000-4000-8000-00000000001b';  -- in a bien archived later
  u_doc    uuid := 'd0000000-0000-4000-8000-00000000001c';  -- vacant, only a document
  f uuid[] := array(select ('d0000000-0000-4000-8000-0000000002' || lpad(to_hex(i), 2, '0'))::uuid from generate_series(1, 20) i);
  v_text text; v_int integer; v_uuid uuid; v_arr uuid[]; v_ints integer[];
begin
  insert into properties (id, organization_id, branch_id, name, type, city, governorate, latitude, longitude)
  values (prop, org, br, 'Bien test site', 'building', 'Carthage', 'Tunis', 36.852800, 10.323300),
         (prop2, org, br, 'Bien test site 2', 'building', 'Sousse', 'Sousse', null, null);
  insert into units (id, organization_id, property_id, code, type, rooms, surface_m2, floor, status, rent_amount, sale_price) values
    (u_rent,    org, prop, 'S-1', 'apartment', 3, 92.5, 2, 'vacant',            900, null),
    (u_sale,    org, prop, 'S-2', 'apartment', 4, 110,  3, 'for_sale',          null, 350000),
    (u_nophoto, org, prop, 'S-3', 'apartment', 2, 60,   1, 'vacant',            700, null),
    (u_bienph,  org, prop, 'S-4', 'apartment', 2, 60,   1, 'vacant',            700, null),
    (u_norent,  org, prop, 'S-5', 'apartment', 2, 60,   1, 'vacant',            0, null),
    (u_nosale,  org, prop, 'S-6', 'apartment', 2, 60,   1, 'for_sale',          null, null),
    (u_hidden,  org, prop, 'S-7', 'apartment', 2, 60,   1, 'vacant',            700, null),
    (u_rented,  org, prop, 'S-8', 'apartment', 2, 60,   1, 'rented',            700, null),
    (u_maint,   org, prop, 'S-9', 'apartment', 2, 60,   1, 'under_maintenance', 700, null),
    (u_arch,    org, prop, 'S-10', 'apartment', 2, 60,  1, 'vacant',            700, null),
    (u_prop2,   org, prop2, 'T-1', 'apartment', 2, 60,  1, 'vacant',            700, null),
    (u_doc,     org, prop, 'S-11', 'apartment', 2, 60,  1, 'vacant',            700, null);

  perform pg_temp.mk_photo(f[1], org, u_rent, null, 2);
  perform pg_temp.mk_photo(f[2], org, u_rent, null, 1);
  perform pg_temp.mk_photo(f[3], org, u_rent, null, 9, true);   -- the cover, although it has the highest sort_order
  perform pg_temp.mk_photo(f[4], org, u_sale, null, 0);
  perform pg_temp.mk_photo(f[5], org, null, prop, 0);           -- bien photos: never public
  perform pg_temp.mk_photo(f[6], org, u_norent, null, 0);
  perform pg_temp.mk_photo(f[7], org, u_nosale, null, 0);
  perform pg_temp.mk_photo(f[8], org, u_hidden, null, 0);
  perform pg_temp.mk_photo(f[9], org, u_rented, null, 0);
  perform pg_temp.mk_photo(f[10], org, u_maint, null, 0);
  perform pg_temp.mk_photo(f[11], org, u_arch, null, 0);
  perform pg_temp.mk_photo(f[12], org, u_prop2, null, 0);
  insert into storage.files (id, bucket_id) values (f[13], 'property-files');
  insert into property_files (organization_id, unit_id, storage_file_id, kind, category, title)
  values (org, u_doc, f[13], 'document', 'plan', 'Plan');
  update units set show_on_website = false where id = u_hidden;
  update units set archived_at = now() where id = u_arch;

  -- 1. Defaults of the new columns.
  select show_on_website::text || '/' || furnished::text || '/' || amenities::text into v_text from units where id = u_rent;
  if v_text <> 'true/false/{}' then raise exception 'FAIL 1: defaults are %', v_text; end if;

  -- 2. Who is public: vacant with rent, for sale with a sale price, and an own photo.
  if not exists (select 1 from public_listings where id = u_rent and unit_id = u_rent and kind = 'rent') then
    raise exception 'FAIL 2a: vacant unit with rent and photos not public';
  end if;
  if not exists (select 1 from public_listings where id = u_sale and kind = 'sale') then
    raise exception 'FAIL 2b: for-sale unit with price and photo not public';
  end if;
  select count(*) into v_int from public_listings
  where id in (u_nophoto, u_bienph, u_norent, u_nosale, u_hidden, u_rented, u_maint, u_arch, u_doc);
  if v_int <> 0 then raise exception 'FAIL 2c: % hidden units are public', v_int; end if;
  if not exists (select 1 from public_listings where id = u_prop2) then raise exception 'FAIL 2d: unit of a live bien not public'; end if;

  -- 3. The rows become public by themselves when the missing piece appears, and leave again when it goes.
  perform pg_temp.mk_photo(f[14], org, u_nophoto, null, 0);
  if not exists (select 1 from public_listings where id = u_nophoto) then raise exception 'FAIL 3a: photo added, unit not public'; end if;
  delete from property_files where storage_file_id = f[14];
  if exists (select 1 from public_listings where id = u_nophoto) then raise exception 'FAIL 3b: photo removed, unit still public'; end if;
  update units set rent_amount = 500 where id = u_norent;
  if not exists (select 1 from public_listings where id = u_norent) then raise exception 'FAIL 3c: rent set, unit not public'; end if;
  update units set sale_price = 100000 where id = u_nosale;
  if not exists (select 1 from public_listings where id = u_nosale and kind = 'sale') then raise exception 'FAIL 3d: sale price set, unit not public'; end if;
  update units set show_on_website = true where id = u_hidden;
  if not exists (select 1 from public_listings where id = u_hidden) then raise exception 'FAIL 3e: toggle on, unit not public'; end if;
  update units set show_on_website = false where id = u_hidden;
  if exists (select 1 from public_listings where id = u_hidden) then raise exception 'FAIL 3f: toggle off, unit still public'; end if;
  update units set status = 'rented' where id = u_rent;
  if exists (select 1 from public_listings where id = u_rent) then raise exception 'FAIL 3g: rented unit still public'; end if;
  update units set status = 'vacant' where id = u_rent;
  update units set archived_at = now() where id = u_rent;
  if exists (select 1 from public_listings where id = u_rent) then raise exception 'FAIL 3h: archived unit still public'; end if;
  update units set archived_at = null where id = u_rent;
  update properties set archived_at = now() where id = prop2;
  if exists (select 1 from public_listings where id = u_prop2) then raise exception 'FAIL 3i: unit of an archived bien still public'; end if;

  update units set status = 'sold' where id = u_sale;
  if exists (select 1 from public_listings where id = u_sale) then raise exception 'FAIL 3j: sold unit still public'; end if;
  update units set status = 'for_sale' where id = u_sale;

  -- 4. Values and cover. Title falls back to bien + code; price follows the status; coordinates are rounded.
  select title into v_text from public_listings where id = u_rent;
  if v_text <> 'Bien test site - S-1' then raise exception 'FAIL 4a: fallback title is %', v_text; end if;
  update units set title = '  Beau S+2  ', description = 'Texte', charges = 40, furnished = true, amenities = array['lift', 'garden']
  where id = u_rent;
  select title || '/' || price::text || '/' || charges::text || '/' || furnished::text || '/' || amenities::text
  into v_text from public_listings where id = u_rent;
  if v_text <> 'Beau S+2/900.000/40.000/true/{lift,garden}' then raise exception 'FAIL 4b: rent row is %', v_text; end if;
  select price::text || '/' || coalesce(charges::text, 'null') || '/' || deposit_months::text || '/' || reservation_deposit::text || '/' || reservation_days::text
  into v_text from public_listings where id = u_sale;
  if v_text <> '350000.000/null/2/10000.000/15' then raise exception 'FAIL 4c: sale row is %', v_text; end if;
  select 1 into v_int from public_listings where id = u_rent and scale(latitude) = 3 and scale(longitude) = 3;
  if v_int is null then raise exception 'FAIL 4d: coordinates not rounded to 3 decimals'; end if;
  select cover_file_id, photo_count into v_uuid, v_int from public_listings where id = u_rent;
  if v_uuid <> f[3] or v_int <> 3 then raise exception 'FAIL 4e: cover % count %', v_uuid, v_int; end if;
  select array_agg(storage_file_id order by position), array_agg(position order by position) into v_arr, v_ints
  from public_listing_photos where listing_id = u_rent;
  if v_arr <> array[f[3], f[2], f[1]] or v_ints <> array[1, 2, 3] then raise exception 'FAIL 4f: photos %, positions %', v_arr, v_ints; end if;
  if exists (select 1 from public_listing_photos where listing_id in (u_nophoto, u_hidden, u_arch)) then
    raise exception 'FAIL 4g: photos of hidden units are public';
  end if;
  if exists (select 1 from public_listing_photos where storage_file_id = f[5]) then raise exception 'FAIL 4h: a bien photo is public'; end if;

  -- 5. Constraints.
  begin update units set title = '   ' where id = u_rent; raise exception 'FAIL 5a: blank title accepted';
  exception when check_violation then null; end;
  begin update units set sale_price = 0 where id = u_sale; raise exception 'FAIL 5b: sale price 0 accepted';
  exception when check_violation then null; end;
  begin update units set charges = -1 where id = u_rent; raise exception 'FAIL 5c: negative charges accepted';
  exception when check_violation then null; end;
  begin update units set amenities = array['jacuzzi'] where id = u_rent; raise exception 'FAIL 5d: unknown amenity accepted';
  exception when check_violation then null; end;

  raise exception 'OK: all website tests passed';
end $$;
