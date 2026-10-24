-- Add optional visit fee to units (rent only).
-- When set and > 0, the client must prepay this amount before a visit is confirmed.
alter table units add column if not exists visit_fee numeric check (visit_fee >= 0);
