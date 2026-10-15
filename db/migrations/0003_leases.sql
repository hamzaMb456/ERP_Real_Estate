-- 0003_leases: leases (baux) with their units, parties, rents, terms and documents,
-- the day thresholds, the draft guards and the unit-status rules (functions: see the second half).
-- Apply after 0002, then run db/tests/0003_leases.test.sql.
-- ASCII only: this file travels through the clipboard, so French text never appears here, only error codes.
-- "Today" is always Tunisia (public.today_tunis()): the database session runs in UTC.

-- Day thresholds, defined once. Views return ready-made flags; the web never recomputes them.
create or replace function public.lease_rule(p_name text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_name
    when 'grace_days' then 7
    when 'ending_soon_days' then 60
    when 'registration_days' then 60
    when 'registration_warning_days' then 10
  end;
$$;

create or replace function public.today_tunis()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Africa/Tunis')::date;
$$;

-- Lease. start_date / end_date are the bounds of the current term; a renewal moves end_date and logs a term.
create table public.leases (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  number               integer not null,
  status               text not null default 'draft' check (status in ('draft', 'active', 'ended', 'expired')),
  start_date           date not null,
  end_date             date not null,
  payment_day          smallint not null default 1 check (payment_day between 1 and 28),
  deposit_amount       numeric(12, 3) not null default 0 check (deposit_amount >= 0),
  signed_at            date,
  registered_at        date,
  registration_receipt text,
  ended_on             date,
  end_reason           text check (end_reason in ('term_reached', 'terminated_by_renter', 'terminated_by_owner', 'expired_auto', 'other')),
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint leases_dates_check check (end_date > start_date),
  constraint leases_registration_check check (registered_at is null or signed_at is null or registered_at >= signed_at),
  unique (id, organization_id),
  unique (organization_id, number)
);
create index leases_status_idx on public.leases (organization_id, status) where archived_at is null;
create index leases_active_end_idx on public.leases (end_date) where status = 'active';

-- Per-organization number, assigned under a lock so two simultaneous inserts cannot take the same one.
create or replace function public.assign_lease_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('lease_number:' || new.organization_id::text, 0));
  select coalesce(max(number), 0) + 1 into new.number from public.leases where organization_id = new.organization_id;
  return new;
end;
$$;

create trigger leases_assign_number before insert on public.leases
  for each row execute function public.assign_lease_number();

-- Once a lease is not a draft, its dates, signature, end and archiving change only through the lease
-- functions, which set the transaction flag erp.lease_action. Direct updates by clients are refused.
create or replace function public.guard_lease_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('erp.lease_action', true), '') = 'on' then
    return new;
  end if;
  if old.status <> 'draft' and (
       new.start_date  is distinct from old.start_date
    or new.end_date    is distinct from old.end_date
    or new.signed_at   is distinct from old.signed_at
    or new.ended_on    is distinct from old.ended_on
    or new.end_reason  is distinct from old.end_reason
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'lease_not_draft' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger leases_guard_update before update on public.leases
  for each row execute function public.guard_lease_update();

-- The units of a lease.
create table public.lease_units (
  organization_id uuid not null,
  lease_id        uuid not null,
  unit_id         uuid not null,
  created_at      timestamptz not null default now(),
  primary key (lease_id, unit_id),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade,
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index lease_units_unit_id_idx on public.lease_units (unit_id);
create index lease_units_organization_id_idx on public.lease_units (organization_id);

-- Units can be added or removed only while the lease is a draft; parties can be removed only then too
-- (a guarantor can still be added to a running lease).
create or replace function public.check_lease_draft_children()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  -- NEW does not exist in a delete trigger and OLD does not exist in an insert trigger: branch on tg_op.
  if tg_op = 'DELETE' then
    select status into v_status from public.leases where id = old.lease_id;
  else
    select status into v_status from public.leases where id = new.lease_id;
  end if;
  -- No row means the lease itself is being deleted (cascade): nothing to protect.
  if v_status is not null and v_status <> 'draft' then
    raise exception 'lease_draft_only' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger lease_units_draft_only before insert or delete on public.lease_units
  for each row execute function public.check_lease_draft_children();

-- Renters and guarantors, one role per contact per lease.
create table public.lease_parties (
  organization_id uuid not null,
  lease_id        uuid not null,
  contact_id      uuid not null,
  role            text not null check (role in ('renter', 'guarantor')),
  created_at      timestamptz not null default now(),
  primary key (lease_id, contact_id),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict
);
create index lease_parties_contact_id_idx on public.lease_parties (contact_id);
create index lease_parties_organization_id_idx on public.lease_parties (organization_id);

create trigger lease_parties_draft_only_delete before delete on public.lease_parties
  for each row execute function public.check_lease_draft_children();

-- Renting a unit makes the contact a renter (same pattern as ensure_owner_role).
create or replace function public.ensure_renter_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role = 'renter' then
    insert into public.contact_roles (organization_id, contact_id, role)
    values (new.organization_id, new.contact_id, 'renter')
    on conflict (contact_id, role) do nothing;
  end if;
  return null;
end;
$$;

create trigger lease_parties_ensure_renter_role after insert or update of contact_id, role on public.lease_parties
  for each row execute function public.ensure_renter_role();

-- Rent and fixed recoverable charges per unit, by effective date: the history Finance reads later.
-- The first row (effective at the start date) is created with the lease; a rent change adds a row.
create table public.lease_rents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  unit_id         uuid not null,
  effective_from  date not null,
  rent_amount     numeric(12, 3) not null check (rent_amount >= 0),
  charges_amount  numeric(12, 3) not null default 0 check (charges_amount >= 0),
  reason          text,
  created_at      timestamptz not null default now(),
  unique (lease_id, unit_id, effective_from),
  foreign key (lease_id, unit_id) references public.lease_units (lease_id, unit_id) on delete cascade,
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_rents_organization_id_idx on public.lease_rents (organization_id);

create or replace function public.check_lease_rent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.effective_from < (select start_date from public.leases where id = new.lease_id) then
    raise exception 'lease_rent_before_start' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lease_rents_check before insert on public.lease_rents
  for each row execute function public.check_lease_rent();

-- Log of the terms of a lease: the initial term at activation, then one row per renewal.
create table public.lease_terms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  kind            text not null check (kind in ('initial', 'renewal')),
  start_date      date not null,
  end_date        date not null,
  recorded_on     date not null default public.today_tunis(),
  note            text,
  created_at      timestamptz not null default now(),
  constraint lease_terms_dates_check check (end_date >= start_date),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_terms_lease_id_idx on public.lease_terms (lease_id);
create index lease_terms_organization_id_idx on public.lease_terms (organization_id);

-- Signed lease, ID documents, registration receipt.
create table public.lease_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id        uuid not null,
  storage_file_id uuid not null unique references storage.files (id) on delete cascade,
  category        text not null default 'other' check (category in ('signed_lease', 'id_document', 'registration_receipt', 'inspection_report', 'inspection_photo', 'other')),
  title           text not null check (length(trim(title)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade
);
create index lease_files_organization_id_idx on public.lease_files (organization_id);
create index lease_files_lease_id_idx on public.lease_files (lease_id);

-- A linked file must live in the lease-files bucket and, for API users, have been uploaded by the same user
-- (same reasoning as check_property_file_storage in 0002).
create or replace function public.check_lease_file_storage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id';
begin
  if not exists (
    select 1 from storage.files f
    where f.id = new.storage_file_id
      and f.bucket_id = 'lease-files'
      and (v_user is null or f.uploaded_by_user_id::text = v_user)
  ) then
    raise exception 'invalid_storage_file' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lease_files_check_storage before insert or update of storage_file_id on public.lease_files
  for each row execute function public.check_lease_file_storage();

create trigger leases_set_updated_at      before update on public.leases      for each row execute function public.set_updated_at();
create trigger lease_files_set_updated_at before update on public.lease_files for each row execute function public.set_updated_at();

-- Private bucket for lease documents (10 MB per file, presigned downloads).
insert into storage.buckets (id, max_upload_file_size, min_upload_file_size, presigned_urls_enabled, download_expiration, cache_control)
values ('lease-files', 10485760, 1, true, 300, 'max-age=3600')
on conflict (id) do nothing;

-- <<< PART 2 (task 4): sync, overlap, lease functions

-- <<< PART 3 (task 5): views
