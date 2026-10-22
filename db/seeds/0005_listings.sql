-- Demo data for 0005 (apply after the 0001-0004 seeds and the 0005 migration). Safe to re-run.
-- One rent and one sale listing on seeded units: B-102 (vacant) and A-204 (for sale).
-- They are DRAFTS on purpose: publishing needs a photo of the unit, and the demo data has no property_files rows
-- (a photo row points to a real file of the property-files storage bucket, which a seed cannot upload).
-- Upload a photo on the unit page in the ERP, then publish the listing from there; nothing else is needed.
insert into public.listings (id, organization_id, unit_id, kind, status, title, description, price, charges,
                             deposit_months, available_from, furnished, amenities)
values
  ('91111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '42222222-2222-4222-8222-222222222222',
   'rent', 'draft', 'Appartement S+3 lumineux, Les Jardins de Carthage',
   'Au premier etage d''une residence securisee, appartement de 110 m2 avec cuisine equipee et balcon.',
   1100.000, 60.000, 2, public.today_tunis() + 10, false, array['lift', 'balcony', 'equipped_kitchen', 'security']),
  ('92222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444',
   'sale', 'draft', 'Appartement S+2 a vendre, Carthage',
   'Appartement de 96,5 m2 au deuxieme etage, residence avec ascenseur et jardin interieur.',
   395000.000, null, 2, null, false, array['lift', 'garden', 'parking'])
on conflict do nothing;
