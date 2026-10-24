-- Demo data for 0006 (apply after the 0006 migration and the earlier seeds). Safe to re-run.
-- Website texts and prices for two seeded units: B-102 (vacant, rent) and A-204 (for sale).
-- They stay off the site until a photo of the unit is uploaded in the ERP (a photo row points to a real file of the
-- property-files storage bucket, which a seed cannot upload). Nothing else is needed: the unit then goes live by itself.
update public.units set
  title = 'Appartement S+3 lumineux, Les Jardins de Carthage',
  description = 'Au premier etage d''une residence securisee, appartement de 110 m2 avec cuisine equipee et balcon.',
  charges = 60.000,
  available_from = public.today_tunis() + 10,
  amenities = array['lift', 'balcony', 'equipped_kitchen', 'security']
where id = '42222222-2222-4222-8222-222222222222';

update public.units set
  title = 'Appartement S+2 a vendre, Carthage',
  description = 'Appartement de 96,5 m2 au deuxieme etage, residence avec ascenseur et jardin interieur.',
  sale_price = 395000.000,
  amenities = array['lift', 'garden', 'parking']
where id = '44444444-4444-4444-8444-444444444444';
