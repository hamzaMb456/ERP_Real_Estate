-- 0004: calendar appointments, participants and notifications.
-- Apply after 0003; then run db/tests/0004_calendar_notifications.test.sql. ASCII only.
-- This file travels through the clipboard, so French text never appears here, only error codes.

-- Shared appointments (viewings, move-in / move-out checks, meetings). Other modules plug in later.
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             text not null check (kind in ('viewing', 'move_in', 'move_out', 'meeting', 'other')),
  title            text not null check (length(trim(title)) > 0),
  location         text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  assigned_user_id uuid references auth.users (id) on delete set null,
  unit_id          uuid,
  lease_id         uuid,
  notify_by_email  boolean not null default true,
  reminder_sent_at timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint appointments_dates_check check (ends_at > starts_at),
  unique (id, organization_id),
  foreign key (unit_id, organization_id) references public.units (id, organization_id),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id)
);
create index appointments_org_starts_idx on public.appointments (organization_id, starts_at);
create index appointments_staff_starts_idx on public.appointments (assigned_user_id, starts_at);
create index appointments_unit_idx on public.appointments (unit_id) where unit_id is not null;
create index appointments_lease_idx on public.appointments (lease_id) where lease_id is not null;

-- People invited to an appointment. Always a contact (a prospect becomes a contact without a role).
create table public.appointment_participants (
  appointment_id  uuid not null,
  organization_id uuid not null,
  contact_id      uuid not null,
  role            text not null check (role in ('renter', 'guarantor', 'prospect', 'buyer', 'other')),
  email_status    text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_error     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (appointment_id, contact_id),
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id) on delete cascade,
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id)
);
create index appointment_participants_contact_idx on public.appointment_participants (contact_id);

-- One row per staff recipient. The dedupe key makes the daily job idempotent.
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('lease_ending_soon', 'lease_grace', 'lease_expired',
                                                'registration_due', 'registration_overdue', 'appointment_reminder')),
  title           text not null,
  body            text,
  link            text,
  lease_id        uuid,
  appointment_id  uuid,
  dedupe_key      text not null,
  read_at         timestamptz,
  emailed_at      timestamptz,
  email_error     text,
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id, dedupe_key),
  foreign key (lease_id, organization_id) references public.leases (id, organization_id) on delete cascade,
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id) on delete cascade
);
create index notifications_user_unread_idx on public.notifications (user_id, read_at);
create index notifications_org_created_idx on public.notifications (organization_id, created_at);
create index notifications_lease_idx on public.notifications (lease_id) where lease_id is not null;
create index notifications_appointment_idx on public.notifications (appointment_id) where appointment_id is not null;

create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger appointment_participants_set_updated_at before update on public.appointment_participants
  for each row execute function public.set_updated_at();

-- The staff member in charge must be an org_admin or manager of the same organization.
-- Organization comes from auth.users.metadata (the source of the X-Hasura-Org-Id claim);
-- allowed roles come from auth.user_roles.
create or replace function public.check_appointment_staff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.assigned_user_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from auth.users u
    join auth.user_roles r on r.user_id = u.id
    where u.id = new.assigned_user_id
      and u.disabled = false
      and u.metadata ->> 'organization_id' = new.organization_id::text
      and r.role in ('org_admin', 'manager')
  ) then
    raise exception 'appointment_staff_invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger appointments_check_staff before insert or update of assigned_user_id, organization_id on public.appointments
  for each row execute function public.check_appointment_staff();
