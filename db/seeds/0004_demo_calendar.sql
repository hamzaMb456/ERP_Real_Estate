-- Demo calendar. Safe to run twice. Needs 0001-0004 applied (and the 0001-0003 seeds).
-- Times are relative to today (Tunis): one viewing today, a move-in tomorrow (the daily job writes its
-- reminder), a cancelled meeting tomorrow, a move-out done last week, a renewal meeting in 5 days and an
-- unassigned viewing in 3 days. The staff member in charge is the first org_admin or manager of the demo
-- organization; when there is none, appointments stay unassigned. This seed never creates users.
do $$
declare
  org      uuid := '11111111-1111-4111-8111-111111111111';
  t        date := public.today_tunis();
  v_staff  uuid;
  prospect uuid := 'b0000000-0000-4000-8000-000000000201';
  a1 uuid := 'b0000000-0000-4000-8000-000000000211';
  a2 uuid := 'b0000000-0000-4000-8000-000000000212';
  a3 uuid := 'b0000000-0000-4000-8000-000000000213';
  a4 uuid := 'b0000000-0000-4000-8000-000000000214';
  a5 uuid := 'b0000000-0000-4000-8000-000000000215';
  a6 uuid := 'b0000000-0000-4000-8000-000000000216';
  u_b101 uuid := '41111111-1111-4111-8111-111111111111';
  u_b102 uuid := '42222222-2222-4222-8222-222222222222';
  l1 uuid := '81111111-1111-4111-8111-111111111111';
  l2 uuid := '82222222-2222-4222-8222-222222222222';
  l3 uuid := '83333333-3333-4333-8333-333333333333';
  l4 uuid := '84444444-4444-4444-8444-444444444444';
begin
  if exists (select 1 from public.appointments where id = a1) then
    return; -- already seeded
  end if;

  select r.user_id into v_staff
  from auth.user_roles r
  join auth.users u on u.id = r.user_id
  where r.role in ('org_admin', 'manager')
    and u.disabled = false
    and u.metadata ->> 'organization_id' = org::text
  order by u.created_at
  limit 1;

  -- A prospect without an e-mail address: invitations to them are skipped, not failed.
  insert into public.contacts (id, organization_id, kind, full_name, phone)
  values (prospect, org, 'person', 'Yassine Mansouri', '+216 98 000 201')
  on conflict (id) do nothing;

  insert into public.appointments (id, organization_id, kind, title, location, starts_at, ends_at, status, assigned_user_id, unit_id, lease_id, notes) values
    (a1, org, 'viewing',  'Visite B-102', 'Résidence El Menzah, B-102',
     (t + time '10:00') at time zone 'Africa/Tunis', (t + time '10:30') at time zone 'Africa/Tunis',
     'planned', v_staff, u_b102, null, null),
    (a2, org, 'move_in',  'État des lieux d''entrée B-101', null,
     ((t + 1) + time '09:00') at time zone 'Africa/Tunis', ((t + 1) + time '10:00') at time zone 'Africa/Tunis',
     'planned', v_staff, u_b101, l3, null),
    (a3, org, 'meeting',  'Point loyer C-12', 'Agence',
     ((t + 1) + time '15:00') at time zone 'Africa/Tunis', ((t + 1) + time '16:00') at time zone 'Africa/Tunis',
     'cancelled', v_staff, null, l1, 'Annulé par le locataire.'),
    (a4, org, 'move_out', 'État des lieux de sortie B-102', null,
     ((t - 7) + time '10:00') at time zone 'Africa/Tunis', ((t - 7) + time '11:30') at time zone 'Africa/Tunis',
     'done', v_staff, u_b102, l4, null),
    (a5, org, 'meeting',  'Renouvellement B-203', 'Agence',
     ((t + 5) + time '11:00') at time zone 'Africa/Tunis', ((t + 5) + time '12:00') at time zone 'Africa/Tunis',
     'planned', v_staff, null, l2, null),
    (a6, org, 'viewing',  'Seconde visite B-102', 'Résidence El Menzah, B-102',
     ((t + 3) + time '14:00') at time zone 'Africa/Tunis', ((t + 3) + time '14:30') at time zone 'Africa/Tunis',
     'planned', null, u_b102, null, null)
  on conflict (id) do nothing;

  -- Demo participants. E-mail statuses are set as if the e-mails had already gone out, so the demo never
  -- sends real e-mail to the example.tn addresses when the triggers are installed afterwards.
  insert into public.appointment_participants (appointment_id, organization_id, contact_id, role, email_status) values
    (a1, org, prospect, 'prospect', 'skipped'),
    (a2, org, '55555555-5555-4555-8555-555555555555', 'renter', 'sent'),      -- Salma Gharbi
    (a3, org, '53333333-3333-4333-8333-333333333333', 'renter', 'sent'),      -- Mehdi Trabelsi
    (a4, org, '54444444-4444-4444-8444-444444444444', 'renter', 'sent'),      -- SARL Carthage Digital
    (a5, org, '54444444-4444-4444-8444-444444444444', 'renter', 'sent'),
    (a5, org, '51111111-1111-4111-8111-111111111111', 'guarantor', 'failed'), -- Hedi Ben Salem: shows « Renvoyer »
    (a6, org, prospect, 'prospect', 'skipped')
  on conflict (appointment_id, contact_id) do nothing;

  update public.appointment_participants
  set email_error = 'Demo: SMTP refused the message'
  where appointment_id = a5 and contact_id = '51111111-1111-4111-8111-111111111111' and email_error is null;
end $$;
