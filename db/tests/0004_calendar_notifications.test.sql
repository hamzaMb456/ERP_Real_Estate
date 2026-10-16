-- Tests for 0004_calendar_notifications. Run locally with:
-- bash scripts/db-local.sh test db/tests/0004_calendar_notifications.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error « OK: all calendar tests passed ». Failure: an error starting with « FAIL ».

do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  org2   uuid := 'c0000000-0000-4000-8000-000000000002';   -- fixture organization, rolled back
  c_org2 uuid := 'c0000000-0000-4000-8000-000000000021';   -- fixture contact of org2
  u_mgr  uuid := 'c0000000-0000-4000-8000-000000000031';   -- fixture staff user (manager of org)
  u_view uuid := 'c0000000-0000-4000-8000-000000000032';   -- fixture user with the viewer role only
  appt   uuid := 'c0000000-0000-4000-8000-000000000041';
  l_act  uuid := 'c0000000-0000-4000-8000-000000000051';   -- fixture lease, activated
  s_mgr  json;
  v_contact uuid;
  v_unit    uuid;
  v_today   date := public.today_tunis();
  n         int;
  v_ts      timestamptz;
  v_ids     uuid[];
begin
  s_mgr := json_build_object('x-hasura-role', 'manager', 'x-hasura-org-id', org);
  select id into v_contact from public.contacts where organization_id = org and archived_at is null limit 1;
  if v_contact is null then raise exception 'FAIL: no demo contact in organization'; end if;

  -- Fixtures: an organization and a contact that belong to org2, and two users in auth.users.
  insert into public.organizations (id, name) values (org2, 'Fixture org 2');
  insert into public.contacts (id, organization_id, kind, full_name) values (c_org2, org2, 'person', 'Fixture contact');
  insert into auth.users (id, email, metadata) values
    (u_mgr,  'manager@fixture.test', jsonb_build_object('organization_id', org)),
    (u_view, 'viewer@fixture.test',  jsonb_build_object('organization_id', org));
  insert into auth.user_roles (user_id, role) values (u_mgr, 'manager'), (u_view, 'viewer');

  -- 1. ends_at must be after starts_at.
  begin
    insert into public.appointments (id, organization_id, kind, title, starts_at, ends_at)
    values (appt, org, 'viewing', 'Visite test', now(), now());
    raise exception 'FAIL: appointment with ends_at = starts_at accepted';
  exception when check_violation then null;
  end;

  -- A valid appointment for the next checks.
  insert into public.appointments (id, organization_id, kind, title, starts_at, ends_at)
  values (appt, org, 'viewing', 'Visite test', now() + interval '1 day', now() + interval '1 day 1 hour');

  -- 2. A participant's contact must belong to the same organization (composite foreign key).
  begin
    insert into public.appointment_participants (appointment_id, organization_id, contact_id, role)
    values (appt, org, c_org2, 'prospect');
    raise exception 'FAIL: participant from another organization accepted';
  exception when foreign_key_violation then null;
  end;

  -- 3. An assigned user must be staff (org_admin or manager) of the same organization.
  begin
    update public.appointments set assigned_user_id = u_view where id = appt;
    raise exception 'FAIL: viewer assigned to an appointment';
  exception when others then
    if sqlerrm <> 'appointment_staff_invalid' then raise; end if;
  end;
  update public.appointments set assigned_user_id = u_mgr where id = appt;

  -- 4. Two notifications with the same dedupe key for the same user and organization are rejected.
  insert into public.notifications (organization_id, user_id, kind, title, dedupe_key)
  values (org, u_mgr, 'lease_grace', 'Fixture', 'lease_grace:fixture:1');
  begin
    insert into public.notifications (organization_id, user_id, kind, title, dedupe_key)
    values (org, u_mgr, 'lease_grace', 'Fixture again', 'lease_grace:fixture:1');
    raise exception 'FAIL: duplicate notification accepted';
  exception when unique_violation then null;
  end;

  -- ---------- Part 2: views ----------

  -- 5. staff_members lists managers and org admins of the organization, never viewers.
  select count(*) into n from public.staff_members where user_id = u_mgr and organization_id = org and role = 'manager';
  if n <> 1 then raise exception 'FAIL: manager missing from staff_members (%)', n; end if;
  select count(*) into n from public.staff_members where user_id = u_view;
  if n <> 0 then raise exception 'FAIL: viewer listed in staff_members'; end if;

  -- 6. A draft lease produces no calendar event; once active it produces a lease_start all-day event
  --    that starts at midnight Tunis time and ends the next midnight.
  -- A fresh unit in a demo property, so no demo lease can overlap.
  insert into public.units (organization_id, property_id, code)
  select org, p.id, 'FX-CAL-1' from public.properties p where p.organization_id = org limit 1
  returning id into v_unit;
  if v_unit is null then raise exception 'FAIL: no demo property for the unit fixture'; end if;
  insert into public.leases (id, organization_id, start_date, end_date) values (l_act, org, v_today, v_today + 365);
  insert into public.lease_units (organization_id, lease_id, unit_id) values (org, l_act, v_unit);
  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values (org, l_act, v_contact, 'renter');
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount) values (org, l_act, v_unit, v_today, 500);

  select count(*) into n from public.calendar_feed where lease_id = l_act;
  if n <> 0 then raise exception 'FAIL: draft lease produced % calendar events', n; end if;

  perform public.activate_lease(l_act, v_today, s_mgr);
  select starts_at into v_ts from public.calendar_feed where lease_id = l_act and kind = 'lease_start' and all_day;
  if v_ts is distinct from (v_today::timestamp at time zone 'Africa/Tunis') then
    raise exception 'FAIL: lease_start starts at %, expected Tunis midnight', v_ts;
  end if;
  select ends_at into v_ts from public.calendar_feed where lease_id = l_act and kind = 'lease_start';
  if v_ts is distinct from ((v_today + 1)::timestamp at time zone 'Africa/Tunis') then
    raise exception 'FAIL: lease_start ends at %, expected next Tunis midnight', v_ts;
  end if;
  select count(*) into n from public.calendar_feed where lease_id = l_act and kind = 'lease_end' and source = 'lease';
  if n <> 1 then raise exception 'FAIL: expected one lease_end event, got %', n; end if;
  select contact_ids into v_ids from public.calendar_feed where lease_id = l_act and kind = 'lease_start';
  if not (v_contact = any (v_ids)) then raise exception 'FAIL: lease event does not list the renter'; end if;
  -- Signed and not registered: a registration deadline event at signed date + registration_days.
  select starts_at into v_ts from public.calendar_feed where lease_id = l_act and kind = 'registration_deadline';
  if v_ts is distinct from ((v_today + public.lease_rule('registration_days'))::timestamp at time zone 'Africa/Tunis') then
    raise exception 'FAIL: registration_deadline at %', v_ts;
  end if;

  -- 7. A cancelled appointment stays in the feed (the web filters it) and lists its participants.
  insert into public.appointment_participants (appointment_id, organization_id, contact_id, role)
  values (appt, org, v_contact, 'renter');
  update public.appointments set status = 'cancelled' where id = appt;
  select contact_ids into v_ids from public.calendar_feed where event_id = 'a:' || appt and status = 'cancelled' and not all_day;
  if v_ids is null or not (v_contact = any (v_ids)) then
    raise exception 'FAIL: cancelled appointment missing from the feed or without its participant';
  end if;

  raise exception 'OK: all calendar tests passed';
end $$;
