-- Tests for 0003_leases. Paste into the Nhost dashboard SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0003_leases.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error « OK: all lease tests passed ». Failure: an error starting with « FAIL ».

-- Fixture helper: a draft lease with one unit, one renter and the first rent.
create function pg_temp.mk_lease(p_id uuid, p_org uuid, p_unit uuid, p_renter uuid, p_start date, p_end date, p_rent numeric default 500)
returns void language plpgsql as $$
begin
  insert into public.leases (id, organization_id, start_date, end_date) values (p_id, p_org, p_start, p_end);
  insert into public.lease_units (organization_id, lease_id, unit_id) values (p_org, p_id, p_unit);
  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values (p_org, p_id, p_renter, 'renter');
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount) values (p_org, p_id, p_unit, p_start, p_rent);
end $$;

do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br     uuid := '21111111-1111-4111-8111-111111111111';
  org2   uuid := 'b0000000-0000-4000-8000-000000000002';
  prop   uuid := 'b0000000-0000-4000-8000-000000000003';
  u1 uuid := 'b0000000-0000-4000-8000-000000000011'; u2 uuid := 'b0000000-0000-4000-8000-000000000012';
  u3 uuid := 'b0000000-0000-4000-8000-000000000013'; u4 uuid := 'b0000000-0000-4000-8000-000000000014';
  u5 uuid := 'b0000000-0000-4000-8000-000000000015'; u6 uuid := 'b0000000-0000-4000-8000-000000000016';
  u7 uuid := 'b0000000-0000-4000-8000-000000000017'; u8 uuid := 'b0000000-0000-4000-8000-000000000018';
  c1 uuid := 'b0000000-0000-4000-8000-000000000021'; c2 uuid := 'b0000000-0000-4000-8000-000000000022';
  c3 uuid := 'b0000000-0000-4000-8000-000000000023';
  l1  uuid := 'b0000000-0000-4000-8000-000000000101'; l2  uuid := 'b0000000-0000-4000-8000-000000000102';
  l3  uuid := 'b0000000-0000-4000-8000-000000000103'; l4  uuid := 'b0000000-0000-4000-8000-000000000104';
  l5  uuid := 'b0000000-0000-4000-8000-000000000105'; l6  uuid := 'b0000000-0000-4000-8000-000000000106';
  l7  uuid := 'b0000000-0000-4000-8000-000000000107'; l8  uuid := 'b0000000-0000-4000-8000-000000000108';
  l9  uuid := 'b0000000-0000-4000-8000-000000000109'; l10 uuid := 'b0000000-0000-4000-8000-000000000110';
  l11 uuid := 'b0000000-0000-4000-8000-000000000111'; l12 uuid := 'b0000000-0000-4000-8000-000000000112';
  l13 uuid := 'b0000000-0000-4000-8000-000000000113'; l14 uuid := 'b0000000-0000-4000-8000-000000000114';
  l15 uuid := 'b0000000-0000-4000-8000-000000000115'; l16 uuid := 'b0000000-0000-4000-8000-000000000116';
  l17 uuid := 'b0000000-0000-4000-8000-000000000117'; l18 uuid := 'b0000000-0000-4000-8000-000000000118';
  l19 uuid := 'b0000000-0000-4000-8000-000000000119';
  s_ok     json;
  s_viewer json;
  s_other  json;
  v_today  date := public.today_tunis();
  n1 int; n2 int; n int; v_text text; v_date date; v_bool boolean; v_num numeric;
begin
  s_ok     := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org);
  s_viewer := json_build_object('x-hasura-role', 'viewer',  'x-hasura-org-id', org);
  s_other  := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org2);

  insert into organizations (id, name) values (org2, 'Autre organisation');
  insert into properties (id, organization_id, branch_id, name, type) values (prop, org, br, 'Bien test baux', 'building');
  insert into units (id, organization_id, property_id, code) values
    (u1, org, prop, 'L-1'), (u2, org, prop, 'L-2'), (u3, org, prop, 'L-3'),
    (u4, org, prop, 'L-4'), (u5, org, prop, 'L-5'), (u6, org, prop, 'L-6'),
    (u7, org, prop, 'L-7'), (u8, org, prop, 'L-8');
  insert into contacts (id, organization_id, full_name) values
    (c1, org, 'Locataire Un'), (c2, org, 'Locataire Deux'), (c3, org, 'Garant Trois');

  -- 1. Lease numbers count up inside one organization.
  insert into leases (id, organization_id, start_date, end_date) values (l1, org, v_today, v_today + 365);
  insert into leases (id, organization_id, start_date, end_date) values (l2, org, v_today, v_today + 365);
  select number into n1 from leases where id = l1;
  select number into n2 from leases where id = l2;
  if n2 <> n1 + 1 then raise exception 'FAIL 1: numbers % then %', n1, n2; end if;

  -- 2. The end date must come after the start date.
  begin
    insert into leases (id, organization_id, start_date, end_date) values (gen_random_uuid(), org, v_today, v_today);
    raise exception 'FAIL 2: end = start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%leases_dates_check%' then raise exception 'FAIL 2: wrong error: %', sqlerrm; end if;
  end;

  -- 3. Registration cannot precede the signature.
  begin
    insert into leases (id, organization_id, start_date, end_date, signed_at, registered_at)
    values (gen_random_uuid(), org, v_today, v_today + 365, v_today, v_today - 1);
    raise exception 'FAIL 3: registration before signature accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%leases_registration_check%' then raise exception 'FAIL 3: wrong error: %', sqlerrm; end if;
  end;

  -- 4. Adding a renter gives the contact the renter role; a guarantor does not.
  insert into lease_units (organization_id, lease_id, unit_id) values (org, l1, u6);
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c1, 'renter');
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c3, 'guarantor');
  if not exists (select 1 from contact_roles where contact_id = c1 and role = 'renter') then
    raise exception 'FAIL 4a: renter role missing';
  end if;
  if exists (select 1 from contact_roles where contact_id = c3 and role = 'renter') then
    raise exception 'FAIL 4b: guarantor got the renter role';
  end if;
  begin
    insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l1, c1, 'guarantor');
    raise exception 'FAIL 4c: same contact twice on one lease accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%lease_parties_pkey%' then raise exception 'FAIL 4c: wrong error: %', sqlerrm; end if;
  end;

  -- 5. Units and parties of a non-draft lease are locked; its dates too, unless a lease function says so.
  update leases set status = 'active' where id = l1;
  begin
    insert into lease_units (organization_id, lease_id, unit_id) values (org, l1, u2);
    raise exception 'FAIL 5a: unit added to an active lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_draft_only' then raise exception 'FAIL 5a: wrong error: %', sqlerrm; end if;
  end;
  begin
    delete from lease_parties where lease_id = l1 and contact_id = c3;
    raise exception 'FAIL 5b: party removed from an active lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_draft_only' then raise exception 'FAIL 5b: wrong error: %', sqlerrm; end if;
  end;
  begin
    update leases set end_date = v_today + 400 where id = l1;
    raise exception 'FAIL 5c: dates of an active lease changed directly';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 5c: wrong error: %', sqlerrm; end if;
  end;
  perform set_config('erp.lease_action', 'on', true);
  update leases set end_date = v_today + 400 where id = l1;
  perform set_config('erp.lease_action', 'off', true);
  -- a deposit or payment day can still be corrected on an active lease
  update leases set payment_day = 10, deposit_amount = 1500 where id = l1;

  -- 6. A rent cannot start before the lease does.
  begin
    insert into lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount)
    values (org, l1, u6, v_today - 1, 100);
    raise exception 'FAIL 6: rent before the start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_rent_before_start' then raise exception 'FAIL 6: wrong error: %', sqlerrm; end if;
  end;

  -- <<< NEXT TESTS (task 4) go above this line

  -- <<< NEXT TESTS (task 5) go above this line

  raise exception 'OK: all lease tests passed';
end $$;
