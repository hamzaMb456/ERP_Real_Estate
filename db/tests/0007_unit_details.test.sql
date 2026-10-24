-- Tests for 0007_unit_details. Paste into the Nhost dashboard SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0007_unit_details.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error "OK: all unit detail tests passed". Failure: an error starting with "FAIL".

do $$
declare
  org  uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br   uuid := '21111111-1111-4111-8111-111111111111';
  prop uuid := 'e0000000-0000-4000-8000-000000000003';
  u1   uuid := 'e0000000-0000-4000-8000-000000000011';
  u2   uuid := 'e0000000-0000-4000-8000-000000000012';
  f1   uuid := 'e0000000-0000-4000-8000-000000000201';
  f2   uuid := 'e0000000-0000-4000-8000-000000000202';
  v_text text;
begin
  insert into properties (id, organization_id, branch_id, name, type, city, governorate, year_built, floors_count, neighbourhood_description)
  values (prop, org, br, 'Bien test details', 'building', 'Carthage', 'Tunis', 2018, 6, 'Quiet street near the sea.');
  insert into units (id, organization_id, property_id, code, type, status, rent_amount, sale_price) values
    (u1, org, prop, 'D-1', 'apartment', 'vacant', 900, null),
    (u2, org, prop, 'D-2', 'apartment', 'for_sale', null, 350000);
  insert into storage.files (id, bucket_id) values (f1, 'property-files'), (f2, 'property-files');
  insert into property_files (organization_id, unit_id, storage_file_id, kind, title) values
    (org, u1, f1, 'photo', 'Photo'), (org, u2, f2, 'photo', 'Photo');

  -- 1. Defaults: what every listing showed before the columns existed.
  select deposit_months::text || '/' || reservation_deposit::text || '/' || reservation_days::text || '/' || orientation::text || '/' || charges_included::text
  into v_text from units where id = u1;
  if v_text <> '2/10000.000/15/{}/{}' then raise exception 'FAIL 1: defaults are %', v_text; end if;
  select deposit_months::text || '/' || reservation_deposit::text || '/' || reservation_days::text || '/' || coalesce(virtual_tour_url, 'null')
  into v_text from public_listings where id = u1;
  if v_text <> '2/10000.000/15/null' then raise exception 'FAIL 1b: public defaults are %', v_text; end if;

  -- 2. Every new value reaches the public view, bien values included.
  update units set bedrooms = 3, bathrooms = 2, parking_spaces = 1, property_condition = 'good', deposit_months = 3,
                   pets_allowed = true, virtual_tour_url = 'https://example.com/tour', orientation = array['south', 'east'],
                   outdoor_area_m2 = 12.5, energy_class = 'C', min_lease_months = 12,
                   charges_included = array['water', 'syndic']
  where id = u1;
  select bedrooms::text || '/' || bathrooms::text || '/' || parking_spaces::text || '/' || property_condition || '/' || deposit_months::text
         || '/' || pets_allowed::text || '/' || virtual_tour_url || '/' || orientation::text || '/' || outdoor_area_m2::text
         || '/' || energy_class || '/' || min_lease_months::text || '/' || charges_included::text
         || '/' || year_built::text || '/' || floors_count::text || '/' || neighbourhood_description
  into v_text from public_listings where id = u1;
  if v_text <> '3/2/1/good/3/true/https://example.com/tour/{south,east}/12.50/C/12/{water,syndic}/2018/6/Quiet street near the sea.' then
    raise exception 'FAIL 2a: rent row is %', v_text;
  end if;
  update units set legal_status = 'collective_title', reservation_deposit = 20000, reservation_days = 30 where id = u2;
  select legal_status || '/' || reservation_deposit::text || '/' || reservation_days::text into v_text from public_listings where id = u2;
  if v_text <> 'collective_title/20000.000/30' then raise exception 'FAIL 2b: sale row is %', v_text; end if;
  update units set pets_allowed = null where id = u1;
  if (select pets_allowed from public_listings where id = u1) is not null then raise exception 'FAIL 2c: unspecified pets shown'; end if;

  -- 3. Constraints.
  begin update units set property_condition = 'ruined' where id = u1; raise exception 'FAIL 3a: unknown condition accepted';
  exception when check_violation then null; end;
  begin update units set legal_status = 'mortgaged' where id = u2; raise exception 'FAIL 3b: unknown legal status accepted';
  exception when check_violation then null; end;
  begin update units set virtual_tour_url = 'javascript:alert(1)' where id = u1; raise exception 'FAIL 3c: javascript url accepted';
  exception when check_violation then null; end;
  begin update units set orientation = array['up'] where id = u1; raise exception 'FAIL 3d: unknown orientation accepted';
  exception when check_violation then null; end;
  begin update units set energy_class = 'H' where id = u1; raise exception 'FAIL 3e: unknown energy class accepted';
  exception when check_violation then null; end;
  begin update units set charges_included = array['tv'] where id = u1; raise exception 'FAIL 3f: unknown included charge accepted';
  exception when check_violation then null; end;
  begin update units set deposit_months = 13 where id = u1; raise exception 'FAIL 3g: deposit of 13 months accepted';
  exception when check_violation then null; end;
  begin update units set reservation_days = 0 where id = u2; raise exception 'FAIL 3h: reservation of 0 days accepted';
  exception when check_violation then null; end;
  begin update units set outdoor_area_m2 = 0 where id = u1; raise exception 'FAIL 3i: outdoor area 0 accepted';
  exception when check_violation then null; end;
  begin update properties set year_built = 1700 where id = prop; raise exception 'FAIL 3j: year built 1700 accepted';
  exception when check_violation then null; end;
  begin update properties set floors_count = 0 where id = prop; raise exception 'FAIL 3k: 0 floors accepted';
  exception when check_violation then null; end;

  raise exception 'OK: all unit detail tests passed';
end $$;
