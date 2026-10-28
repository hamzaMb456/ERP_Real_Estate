-- Tests for 0003_leases. Paste into the legacy console SQL Editor and Run, or run locally with
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
  u9 uuid := 'b0000000-0000-4000-8000-000000000019';
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
  l19 uuid := 'b0000000-0000-4000-8000-000000000119'; l20 uuid := 'b0000000-0000-4000-8000-000000000120';
  l21 uuid := 'b0000000-0000-4000-8000-000000000121'; l22 uuid := 'b0000000-0000-4000-8000-000000000122';
  l23 uuid := 'b0000000-0000-4000-8000-000000000123'; l24 uuid := 'b0000000-0000-4000-8000-000000000124';
  l25 uuid := 'b0000000-0000-4000-8000-000000000125';
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

  -- 7. Activation rules (a, b, c: what is missing; d: success; e: a second activation).
  insert into leases (id, organization_id, start_date, end_date) values (l3, org, v_today, v_today + 364);
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7a: activated without a renter';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_renter' then raise exception 'FAIL 7a: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_parties (organization_id, lease_id, contact_id, role) values (org, l3, c1, 'renter');
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7b: activated without a unit';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_unit' then raise exception 'FAIL 7b: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_units (organization_id, lease_id, unit_id) values (org, l3, u1);
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7c: activated without a rent';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_needs_rent' then raise exception 'FAIL 7c: wrong error: %', sqlerrm; end if;
  end;
  insert into lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount)
  values (org, l3, u1, v_today, 800, 50);
  perform 1 from public.activate_lease(l3, null, s_ok);
  select status into v_text from leases where id = l3;
  if v_text <> 'active' then raise exception 'FAIL 7d: status is %', v_text; end if;
  select signed_at into v_date from leases where id = l3;
  if v_date <> v_today then raise exception 'FAIL 7d: signed_at is %', v_date; end if;
  select status into v_text from units where id = u1;
  if v_text <> 'rented' then raise exception 'FAIL 7d: unit status is %', v_text; end if;
  select count(*) into n from lease_terms where lease_id = l3 and kind = 'initial' and start_date = v_today and end_date = v_today + 364;
  if n <> 1 then raise exception 'FAIL 7d: initial term rows: %', n; end if;
  -- the flag must not leak into the rest of the transaction: a direct edit is refused again
  begin
    update leases set end_date = v_today + 500 where id = l3;
    raise exception 'FAIL 7d: erp.lease_action flag leaked after the function';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 7d: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.activate_lease(l3, null, s_ok);
    raise exception 'FAIL 7e: activated twice';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 7e: wrong error: %', sqlerrm; end if;
  end;

  -- 8. The caller must be a writer of the lease's organization.
  insert into leases (id, organization_id, start_date, end_date) values (l4, org, v_today, v_today + 100);
  begin
    perform 1 from public.activate_lease(l4, null, s_viewer);
    raise exception 'FAIL 8a: a viewer activated a lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_forbidden' then raise exception 'FAIL 8a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.activate_lease(l4, null, s_other);
    raise exception 'FAIL 8b: another organization activated the lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_found' then raise exception 'FAIL 8b: wrong error: %', sqlerrm; end if;
  end;

  -- 9. Overlap: both ends are inclusive. l3 occupies u1 from today to today+364.
  perform pg_temp.mk_lease(l5, org, u1, c2, v_today + 364, v_today + 700);
  begin
    perform 1 from public.activate_lease(l5, null, s_ok);
    raise exception 'FAIL 9: a lease starting on the last day of another was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> format('lease_overlap:%s', (select number from leases where id = l3)) then
      raise exception 'FAIL 9: wrong error: %', sqlerrm;
    end if;
  end;
  -- 9b. Back to back is fine: the next lease starts the day after.
  perform pg_temp.mk_lease(l6, org, u1, c2, v_today + 365, v_today + 730);
  perform 1 from public.activate_lease(l6, null, s_ok);
  select status into v_text from leases where id = l6;
  if v_text <> 'active' then raise exception 'FAIL 9b: back-to-back lease not active (%)', v_text; end if;
  -- 9c. The check serialises simultaneous activations on one unit with an advisory lock.
  if position('pg_advisory_xact_lock' in pg_get_functiondef('public.assert_no_lease_overlap(uuid,date,date)'::regprocedure)) = 0 then
    raise exception 'FAIL 9c: the overlap check takes no lock';
  end if;

  -- 10. Renewal.
  begin
    perform 1 from public.renew_lease(l3, v_today + 364, null, null, s_ok);
    raise exception 'FAIL 10a: renewal to the same end date accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_renewal_not_after' then raise exception 'FAIL 10a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.renew_lease(l3, v_today + 400, null, null, s_ok);
    raise exception 'FAIL 10b: renewal into the next lease accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> format('lease_overlap:%s', (select number from leases where id = l6)) then
      raise exception 'FAIL 10b: wrong error: %', sqlerrm;
    end if;
  end;
  begin
    perform 1 from public.renew_lease(l2, v_today + 400, null, null, s_ok);
    raise exception 'FAIL 10c: a draft was renewed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 10c: wrong error: %', sqlerrm; end if;
  end;
  perform pg_temp.mk_lease(l7, org, u2, c1, v_today - 100, v_today + 10, 700);
  perform 1 from public.activate_lease(l7, v_today - 100, s_ok);
  perform 1 from public.renew_lease(
    l7, v_today + 375,
    jsonb_build_array(jsonb_build_object('unit_id', u2, 'rent_amount', 750, 'charges_amount', 25)),
    'Renouvellement test', s_ok);
  select end_date into v_date from leases where id = l7;
  if v_date <> v_today + 375 then raise exception 'FAIL 10d: end_date is %', v_date; end if;
  select count(*) into n from lease_terms where lease_id = l7 and kind = 'renewal'
    and start_date = v_today + 11 and end_date = v_today + 375 and note = 'Renouvellement test';
  if n <> 1 then raise exception 'FAIL 10d: renewal term rows: %', n; end if;
  select rent_amount into v_num from lease_rents where lease_id = l7 and unit_id = u2 and effective_from = v_today + 11;
  if v_num is distinct from 750 then raise exception 'FAIL 10d: renewal rent is %', v_num; end if;

  -- 11. Ending a lease.
  perform pg_temp.mk_lease(l8, org, u3, c2, v_today - 30, v_today + 300);
  perform 1 from public.activate_lease(l8, v_today - 30, s_ok);
  begin
    perform 1 from public.end_lease(l8, v_today + 1, 'other', s_ok);
    raise exception 'FAIL 11a: an end date in the future was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_end_in_future' then raise exception 'FAIL 11a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.end_lease(l8, v_today - 31, 'other', s_ok);
    raise exception 'FAIL 11b: an end date before the start was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_end_before_start' then raise exception 'FAIL 11b: wrong error: %', sqlerrm; end if;
  end;
  perform 1 from public.end_lease(l8, v_today, 'terminated_by_renter', s_ok);
  select status || '/' || ended_on::text || '/' || end_reason into v_text from leases where id = l8;
  if v_text <> 'ended/' || v_today::text || '/terminated_by_renter' then raise exception 'FAIL 11c: lease is %', v_text; end if;
  select status into v_text from units where id = u3;
  if v_text <> 'vacant' then raise exception 'FAIL 11c: unit status is %', v_text; end if;
  begin
    perform 1 from public.end_lease(l8, v_today, 'other', s_ok);
    raise exception 'FAIL 11d: an ended lease was ended again';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 11d: wrong error: %', sqlerrm; end if;
  end;

  -- 11e. Ending one of two active leases of a unit keeps the unit rented while the other is active.
  perform pg_temp.mk_lease(l9, org, u4, c1, v_today - 60, v_today + 30);
  perform pg_temp.mk_lease(l10, org, u4, c2, v_today + 31, v_today + 400);
  perform 1 from public.activate_lease(l9, v_today - 60, s_ok);
  perform 1 from public.activate_lease(l10, v_today, s_ok);
  perform 1 from public.end_lease(l9, v_today, 'term_reached', s_ok);
  select status into v_text from units where id = u4;
  if v_text <> 'rented' then raise exception 'FAIL 11e: unit status is % while another lease is active', v_text; end if;

  -- 12. A unit for sale stays for sale, whatever its leases do.
  update units set status = 'for_sale' where id = u5;
  perform pg_temp.mk_lease(l11, org, u5, c1, v_today, v_today + 100);
  perform 1 from public.activate_lease(l11, null, s_ok);
  perform 1 from public.end_lease(l11, v_today, 'other', s_ok);
  select status into v_text from units where id = u5;
  if v_text <> 'for_sale' then raise exception 'FAIL 12: unit status is %', v_text; end if;

  -- 13. Rent changes.
  begin
    perform 1 from public.change_rent(l7, u2, v_today - 101, 100, 0, 'trop tot', s_ok);
    raise exception 'FAIL 13a: a rent before the start was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_rent_before_start' then raise exception 'FAIL 13a: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.change_rent(l7, u3, v_today + 20, 100, 0, 'autre unite', s_ok);
    raise exception 'FAIL 13b: a rent for a unit outside the lease was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_unit_not_found' then raise exception 'FAIL 13b: wrong error: %', sqlerrm; end if;
  end;
  begin
    perform 1 from public.change_rent(l2, u2, v_today + 20, 100, 0, 'brouillon', s_ok);
    raise exception 'FAIL 13c: a rent change on a draft was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 13c: wrong error: %', sqlerrm; end if;
  end;
  perform 1 from public.change_rent(l7, u2, v_today + 20, 780, 30, 'Indexation', s_ok);
  select count(*) into n from lease_rents where lease_id = l7 and unit_id = u2;
  if n <> 3 then raise exception 'FAIL 13d: rent rows: %', n; end if;
  begin
    perform 1 from public.change_rent(l7, u2, v_today + 20, 790, 30, 'meme jour', s_ok);
    raise exception 'FAIL 13e: two rents on the same day accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%lease_rents_lease_id_unit_id_effective_from_key%' then raise exception 'FAIL 13e: wrong error: %', sqlerrm; end if;
  end;

  -- 14. Expiry: day 7 after the end date stays active, day 8 expires; a lease in its grace week can still be renewed.
  perform pg_temp.mk_lease(l12, org, u3, c2, v_today - 300, v_today - 8);
  perform pg_temp.mk_lease(l13, org, u7, c1, v_today - 300, v_today - 7);
  update leases set status = 'active', signed_at = v_today - 300 where id in (l12, l13);
  select count(*) into n from public.expire_overdue_leases() where id in (l12, l13);
  if n <> 1 then raise exception 'FAIL 14a: expired % of the two leases', n; end if;
  select status || '/' || ended_on::text || '/' || end_reason into v_text from leases where id = l12;
  if v_text <> 'expired/' || (v_today - 8)::text || '/expired_auto' then raise exception 'FAIL 14b: lease is %', v_text; end if;
  select status into v_text from leases where id = l13;
  if v_text <> 'active' then raise exception 'FAIL 14c: day-7 lease is %', v_text; end if;
  select status into v_text from units where id = u3;
  if v_text <> 'vacant' then raise exception 'FAIL 14d: unit of the expired lease is %', v_text; end if;
  select status into v_text from units where id = u7;
  if v_text <> 'rented' then raise exception 'FAIL 14e: unit of the lease in grace is %', v_text; end if;
  perform 1 from public.renew_lease(l13, v_today + 60, null, 'grace', s_ok);
  select end_date into v_date from leases where id = l13;
  if v_date <> v_today + 60 then raise exception 'FAIL 14f: renewal in the grace week gave %', v_date; end if;

  -- <<< NEXT TESTS (task 4) go above this line

  -- 15. Views. Leases without units are enough for the flags.
  select unit_count || '/' || unit_codes || '/' || renter_names || '/' || total_rent::text || '/' || total_charges::text
  into v_text from lease_overview where id = l3;
  if v_text <> '1/L-1/Locataire Un/800.000/50.000' then raise exception 'FAIL 15a: overview of l3 is %', v_text; end if;

  insert into leases (id, organization_id, status, start_date, end_date, signed_at) values
    (l14, org, 'active', v_today - 100, v_today + 20, v_today - 10),   -- ending soon, registration pending
    (l15, org, 'active', v_today - 300, v_today - 3,  v_today - 300),  -- grace week
    (l16, org, 'active', v_today - 60,  v_today + 300, v_today - 55),  -- registration due in 5 days
    (l17, org, 'active', v_today - 80,  v_today + 300, v_today - 70);  -- registration overdue
  insert into leases (id, organization_id, status, start_date, end_date, signed_at, registered_at) values
    (l18, org, 'active', v_today - 80, v_today + 300, v_today - 70, v_today - 65);
  insert into leases (id, organization_id, start_date, end_date) values (l19, org, v_today, v_today + 100);

  select is_ending_soon::text || '/' || in_grace::text || '/' || registration_state into v_text from lease_overview where id = l14;
  if v_text <> 'true/false/pending' then raise exception 'FAIL 15b: l14 is %', v_text; end if;
  select is_ending_soon::text || '/' || in_grace::text || '/' || grace_days_left::text into v_text from lease_overview where id = l15;
  if v_text <> 'false/true/4' then raise exception 'FAIL 15b: l15 is %', v_text; end if;
  select registration_state || '/' || registration_deadline::text into v_text from lease_overview where id = l16;
  if v_text <> 'due_soon/' || (v_today + 5)::text then raise exception 'FAIL 15c: l16 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l17;
  if v_text <> 'overdue' then raise exception 'FAIL 15c: l17 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l18;
  if v_text <> 'registered' then raise exception 'FAIL 15c: l18 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l19;
  if v_text <> 'not_applicable' then raise exception 'FAIL 15c: the draft l19 is %', v_text; end if;
  select registration_state into v_text from lease_overview where id = l8;
  if v_text <> 'not_applicable' then raise exception 'FAIL 15c: the ended, unregistered l8 is %', v_text; end if;

  -- 15d. Current and next rent: l7 has 700 now, 750 from +11 days, 780 from +20 days.
  select rent_amount::text || '/' || next_change_on::text || '/' || next_rent_amount::text into v_text
  from current_lease_rents where lease_id = l7 and unit_id = u2;
  if v_text <> '700.000/' || (v_today + 11)::text || '/750.000' then raise exception 'FAIL 15d: l7 rent is %', v_text; end if;
  -- a lease that has not started yet shows its first rent as current, with no "next change" of its own
  select rent_amount::text || '/' || coalesce(next_change_on::text, 'none') into v_text
  from current_lease_rents where lease_id = l5 and unit_id = u1;
  if v_text <> '500.000/none' then raise exception 'FAIL 15d: l5 rent is %', v_text; end if;

  -- 15e. The unit sees its active lease.
  select number into n from unit_current_lease where unit_id = u6 and lease_id = l1;
  if n is null then raise exception 'FAIL 15e: unit_current_lease misses l1 on u6'; end if;
  select count(*) into n from unit_current_lease where unit_id = u2;
  if n <> 1 then raise exception 'FAIL 15e: u2 has % current leases', n; end if;

  -- 15f. Nothing reads the server clock directly: "today" is Tunisia (the session runs in UTC).
  if position('Africa/Tunis' in pg_get_functiondef('public.today_tunis()'::regprocedure)) = 0 then
    raise exception 'FAIL 15f: today_tunis does not use Africa/Tunis';
  end if;
  foreach v_text in array array['public.lease_overview', 'public.current_lease_rents', 'public.unit_current_lease'] loop
    if pg_get_viewdef(v_text::regclass) ilike '%current_date%' or pg_get_viewdef(v_text::regclass) like '%now()%' then
      raise exception 'FAIL 15f: % reads the server clock', v_text;
    end if;
  end loop;

  -- 16-23. Findings of the database review.
  -- 16. Ending a lease in its grace week cannot overlap the lease that already follows it.
  perform pg_temp.mk_lease(l20, org, u8, c1, v_today - 30, v_today - 3);
  perform 1 from public.activate_lease(l20, v_today - 30, s_ok);
  perform pg_temp.mk_lease(l21, org, u8, c2, v_today - 2, v_today + 100);
  perform 1 from public.activate_lease(l21, v_today - 2, s_ok);
  begin
    perform 1 from public.end_lease(l20, v_today, 'other', s_ok);
    raise exception 'FAIL 16: ending after the next lease started was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> format('lease_overlap:%s', (select number from leases where id = l21)) then
      raise exception 'FAIL 16: wrong error: %', sqlerrm;
    end if;
  end;

  -- 17. An archived draft cannot be activated.
  perform pg_temp.mk_lease(l22, org, u3, c1, v_today, v_today + 100);
  update leases set archived_at = now() where id = l22;
  begin
    perform 1 from public.activate_lease(l22, null, s_ok);
    raise exception 'FAIL 17: an archived draft was activated';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 17: wrong error: %', sqlerrm; end if;
  end;

  -- 18. The signature date cannot be in the future.
  perform pg_temp.mk_lease(l23, org, u3, c1, v_today, v_today + 100);
  begin
    perform 1 from public.activate_lease(l23, v_today + 1, s_ok);
    raise exception 'FAIL 18: a signature in the future was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_signed_in_future' then raise exception 'FAIL 18: wrong error: %', sqlerrm; end if;
  end;

  -- 19. A draft whose start moved after its first rent cannot be activated.
  perform pg_temp.mk_lease(l24, org, u3, c1, v_today + 10, v_today + 300);
  update leases set start_date = v_today + 20, end_date = v_today + 400 where id = l24;
  begin
    perform 1 from public.activate_lease(l24, null, s_ok);
    raise exception 'FAIL 19: a rent dated before the start was accepted at activation';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_rent_before_start' then raise exception 'FAIL 19: wrong error: %', sqlerrm;
    end if;
  end;

  -- 20. No rent can be added to an ended lease.
  begin
    insert into lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount) values (org, l8, u3, v_today, 100);
    raise exception 'FAIL 20: a rent was added to an ended lease';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_active' then raise exception 'FAIL 20: wrong error: %', sqlerrm; end if;
  end;

  -- 21. An ended lease cannot be switched back to active with a plain update.
  begin
    update leases set status = 'active' where id = l8;
    raise exception 'FAIL 21: an ended lease was reactivated directly';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_not_draft' then raise exception 'FAIL 21: wrong error: %', sqlerrm; end if;
  end;

  -- 22. The lease functions trust the session argument, so only the data-layer roles may run them.
  select count(*) into n
  from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid in (
      'public.activate_lease(uuid,date,json)'::regprocedure,
      'public.renew_lease(uuid,date,jsonb,text,json)'::regprocedure,
      'public.end_lease(uuid,date,text,json)'::regprocedure,
      'public.change_rent(uuid,uuid,date,numeric,numeric,text,json)'::regprocedure,
      'public.expire_overdue_leases()'::regprocedure)
    and a.grantee = 0 and a.privilege_type = 'EXECUTE';
  if n <> 0 then raise exception 'FAIL 22: % lease functions are executable by PUBLIC', n; end if;

  -- 23. Locks and plans that the review asked for are in place (concurrency cannot be run inside one transaction).
  if position('for update' in lower(pg_get_functiondef('public.sync_unit_status(uuid)'::regprocedure))) = 0 then
    raise exception 'FAIL 23a: sync_unit_status does not lock the unit row';
  end if;
  if position('lease_unit:' in pg_get_functiondef('public.assert_no_lease_overlap(uuid,date,date)'::regprocedure)) = 0 then
    raise exception 'FAIL 23b: the overlap lock shares its key space with the ownership lock';
  end if;
  if position('for share' in lower(pg_get_functiondef('public.check_lease_draft_children()'::regprocedure))) = 0 then
    raise exception 'FAIL 23c: the draft guard reads the lease status without a lock';
  end if;
  if position('partition by r.organization_id' in lower(pg_get_viewdef('public.current_lease_rents'::regclass))) = 0 then
    raise exception 'FAIL 23d: current_lease_rents ranks rows across organizations';
  end if;

  -- 24. A lease activated for a future start can still be cancelled (wrong unit, renter withdrew): it ends on its start date.
  insert into units (id, organization_id, property_id, code) values (u9, org, prop, 'L-9');
  perform pg_temp.mk_lease(l25, org, u9, c1, v_today + 20, v_today + 400);
  perform 1 from public.activate_lease(l25, v_today, s_ok);
  select status into v_text from units where id = u9;
  if v_text <> 'rented' then raise exception 'FAIL 24a: unit status is %', v_text; end if;
  begin
    perform 1 from public.end_lease(l25, v_today + 19, 'other', s_ok);
    raise exception 'FAIL 24b: an end date before the start was accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm <> 'lease_end_before_start' then raise exception 'FAIL 24b: wrong error: %', sqlerrm; end if;
  end;
  perform 1 from public.end_lease(l25, v_today + 20, 'terminated_by_renter', s_ok);
  select status || '/' || ended_on::text into v_text from leases where id = l25;
  if v_text <> 'ended/' || (v_today + 20)::text then raise exception 'FAIL 24c: lease is %', v_text; end if;
  select status into v_text from units where id = u9;
  if v_text <> 'vacant' then raise exception 'FAIL 24c: unit status is %', v_text; end if;

  -- <<< NEXT TESTS (task 5) go above this line


  raise exception 'OK: all lease tests passed';
end $$;
