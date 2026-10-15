-- Demo data for 0003 (apply after 0001/0002 seeds and the 0003 migration). Safe to re-run.
-- Leases are created as drafts with their units, parties and first rents, then activated, like the app does.
-- Dates are relative to today (Tunis), so the demo always shows one lease ending soon, one in its grace
-- week, one whose registration is due in 5 days, one ended and one draft.
do $$
declare
  org uuid := '11111111-1111-4111-8111-111111111111';
  t   date := public.today_tunis();
  l1 uuid := '81111111-1111-4111-8111-111111111111';
  l2 uuid := '82222222-2222-4222-8222-222222222222';
  l3 uuid := '83333333-3333-4333-8333-333333333333';
  l4 uuid := '84444444-4444-4444-8444-444444444444';
  l5 uuid := '85555555-5555-4555-8555-555555555555';
begin
  if exists (select 1 from public.leases where id = l1) then
    return; -- already seeded
  end if;

  insert into public.leases (id, organization_id, start_date, end_date, payment_day, deposit_amount, signed_at, registered_at, registration_receipt) values
    (l1, org, t - 150, t + 20,  5, 1520, t - 160, t - 150, 'REC-2025-0412'),  -- C-12: ending in 20 days
    (l2, org, t - 360, t - 3,   1, 2500, t - 370, t - 360, 'REC-2025-0107'),  -- B-203: end date passed 3 days ago (grace week)
    (l3, org, t - 60,  t + 305, 10, 980, t - 55,  null,    null),             -- B-101: registration due in 5 days
    (l4, org, t - 400, t - 40,  1, 1100, t - 410, t - 400, 'REC-2024-0988'),  -- B-102: ended 40 days ago
    (l5, org, t + 10,  t + 375, 5, 1100, null,    null,    null);             -- B-102: draft, starts in 10 days

  insert into public.lease_units (organization_id, lease_id, unit_id) values
    (org, l1, '45555555-5555-4555-8555-555555555555'),
    (org, l2, '43333333-3333-4333-8333-333333333333'),
    (org, l3, '41111111-1111-4111-8111-111111111111'),
    (org, l4, '42222222-2222-4222-8222-222222222222'),
    (org, l5, '42222222-2222-4222-8222-222222222222');

  insert into public.lease_parties (organization_id, lease_id, contact_id, role) values
    (org, l1, '53333333-3333-4333-8333-333333333333', 'renter'),    -- Mehdi Trabelsi
    (org, l2, '54444444-4444-4444-8444-444444444444', 'renter'),    -- SARL Carthage Digital
    (org, l2, '51111111-1111-4111-8111-111111111111', 'guarantor'), -- Hedi Ben Salem
    (org, l3, '55555555-5555-4555-8555-555555555555', 'renter'),    -- Salma Gharbi
    (org, l4, '54444444-4444-4444-8444-444444444444', 'renter'),
    (org, l5, '54444444-4444-4444-8444-444444444444', 'renter');

  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount)
  select org, l.id, lu.unit_id, l.start_date,
         case l.id when l1 then 760 when l2 then 1250 when l3 then 980 else 1100 end,
         case l.id when l2 then 60 when l3 then 40 else 0 end
  from public.leases l join public.lease_units lu on lu.lease_id = l.id
  where l.id in (l1, l2, l3, l4, l5);

  -- a rent increase already planned on B-101
  insert into public.lease_rents (organization_id, lease_id, unit_id, effective_from, rent_amount, charges_amount, reason)
  values (org, l3, '41111111-1111-4111-8111-111111111111', t + 30, 1010, 40, 'Indexation');

  update public.leases set status = 'active' where id in (l1, l2, l3, l4);
  insert into public.lease_terms (organization_id, lease_id, kind, start_date, end_date)
  select organization_id, id, 'initial', start_date, end_date from public.leases where id in (l1, l2, l3, l4);

  -- the ended lease: ending is a lease action, so the guard flag is set for this statement
  perform set_config('erp.lease_action', 'on', true);
  update public.leases set status = 'ended', ended_on = t - 40, end_reason = 'term_reached' where id = l4;
  perform set_config('erp.lease_action', 'off', true);
end $$;
