-- Add the organization's visit payment method: how a visitor pays a unit's visit_fee (0010).
-- null = free (no payment method chosen, no fee collected).
-- ASCII only: this file travels through the clipboard, so French text never appears here.
alter table organizations add column if not exists visit_payment_method text check (visit_payment_method in ('virtual', 'manual'));
