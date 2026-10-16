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
  v_contact uuid;
begin
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

  raise exception 'OK: all calendar tests passed';
end $$;
