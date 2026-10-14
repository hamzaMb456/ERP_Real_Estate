-- Demo data for development: one agency with realistic names from the mockups.
-- Idempotent: fixed ids + ON CONFLICT DO NOTHING. All contact details are fictitious.
-- Demo organization id (put it in a test user's metadata): 11111111-1111-4111-8111-111111111111

insert into public.organizations (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Immobilière Carthage')
on conflict (id) do nothing;

insert into public.branches (id, organization_id, name, city) values
  ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Tunis Nord', 'Tunis'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Sousse', 'Sousse')
on conflict (id) do nothing;

insert into public.properties (id, organization_id, branch_id, name, type, address_line, city, governorate, postal_code, latitude, longitude) values
  ('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111',
   'Résidence Les Jardins de Carthage', 'building', 'Avenue Habib Bourguiba', 'Carthage', 'Tunis', '2016', 36.852800, 10.323300),
  ('32222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111',
   'Immeuble Le Belvédère', 'building', 'Rue du Belvédère', 'Tunis', 'Tunis', '1002', 36.819500, 10.171500)
on conflict (id) do nothing;

insert into public.units (id, organization_id, property_id, code, type, floor, rooms, surface_m2, rent_amount, status) values
  ('41111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'B-101', 'apartment', 1, 3, 92.00, 980.000, 'rented'),
  ('42222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'B-102', 'apartment', 1, 4, 110.00, 1100.000, 'vacant'),
  ('43333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'B-203', 'apartment', 2, 4, 118.00, 1250.000, 'rented'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111111', 'A-204', 'apartment', 2, 3, 96.50, null, 'for_sale'),
  ('45555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '32222222-2222-4222-8222-222222222222', 'C-12', 'apartment', 3, 2, 68.00, 760.000, 'rented')
on conflict (id) do nothing;

insert into public.contacts (id, organization_id, kind, full_name, email, phone) values
  ('51111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'person', 'Hédi Ben Salem', 'hedi.bensalem@example.tn', '+216 20 000 001'),
  ('52222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'company', 'Sté Foncière Carthage', 'contact@fonciere-carthage.example.tn', '+216 71 000 002'),
  ('53333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'person', 'Mehdi Trabelsi', 'mehdi.trabelsi@example.tn', '+216 22 000 003'),
  ('54444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'company', 'SARL Carthage Digital', 'rh@carthage-digital.example.tn', '+216 71 000 004'),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'person', 'Salma Gharbi', 'salma.gharbi@example.tn', '+216 25 000 005')
on conflict (id) do nothing;

insert into public.contact_roles (organization_id, contact_id, role) values
  ('11111111-1111-4111-8111-111111111111', '51111111-1111-4111-8111-111111111111', 'owner'),
  ('11111111-1111-4111-8111-111111111111', '52222222-2222-4222-8222-222222222222', 'owner'),
  ('11111111-1111-4111-8111-111111111111', '53333333-3333-4333-8333-333333333333', 'renter'),
  ('11111111-1111-4111-8111-111111111111', '53333333-3333-4333-8333-333333333333', 'owner'),
  ('11111111-1111-4111-8111-111111111111', '54444444-4444-4444-8444-444444444444', 'renter'),
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 'buyer')
on conflict (contact_id, role) do nothing;
