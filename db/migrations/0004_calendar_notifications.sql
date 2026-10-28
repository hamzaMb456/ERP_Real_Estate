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
-- Organization comes from auth.users.metadata (the source of the organization claim);
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

-- A cancelled or finished appointment, or one moved to another Tunis day, loses its reminder in the bell:
-- the reminder would be wrong (cancelled, moved) or pointless (done). The next daily run writes a new one
-- for the new day (the reminder key carries the day).
create or replace function public.drop_stale_appointment_reminders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'planned'
     or (new.starts_at at time zone 'Africa/Tunis')::date <> (old.starts_at at time zone 'Africa/Tunis')::date then
    delete from public.notifications
    where appointment_id = new.id and kind = 'appointment_reminder';
  end if;
  return new;
end;
$$;

create trigger appointments_drop_stale_reminders after update of status, starts_at on public.appointments
  for each row execute function public.drop_stale_appointment_reminders();

-- Staff of each organization (org_admin, manager): the "staff in charge" list and the notification
-- recipients. Organization from auth.users.metadata, roles from auth.user_roles.
-- The organization id is cast only when it has the exact 8-4-4-4-12 shape (case guard: Postgres may
-- evaluate a WHERE before or after the select list), so one user with a bad metadata value is left out
-- instead of making the view fail for every organization.
create view public.staff_members as
select distinct on (s.id) s.id as user_id, s.organization_id, s.display_name, s.email, s.role
from (
  select
    u.id,
    case when (u.metadata ->> 'organization_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then (u.metadata ->> 'organization_id')::uuid end as organization_id,
    coalesce(nullif(u.display_name, ''), u.email) as display_name,
    u.email,
    r.role
  from auth.users u
  join auth.user_roles r on r.user_id = u.id
  where u.disabled = false
    and r.role in ('org_admin', 'manager')
) s
where s.organization_id is not null
order by s.id, case s.role when 'org_admin' then 0 else 1 end;

-- One feed for the calendar: appointments, plus all-day events derived from active leases
-- (one per leased unit). All-day events start at midnight Tunis time and end the next midnight
-- (end-exclusive). Cancelled appointments stay in the feed; the web hides them by default.
-- Lease titles are 'Bail <number>'; the web adds the French label of the kind.
create view public.calendar_feed as
select
  'a:' || a.id::text                      as event_id,
  a.organization_id,
  'appointment'::text                     as source,
  a.kind,
  a.title,
  a.starts_at,
  a.ends_at,
  false                                   as all_day,
  a.status,
  a.id                                    as appointment_id,
  a.lease_id,
  a.unit_id,
  p.branch_id,
  a.assigned_user_id,
  coalesce((select array_agg(ap.contact_id order by ap.contact_id)
            from public.appointment_participants ap where ap.appointment_id = a.id), '{}'::uuid[]) as contact_ids,
  a.location,
  a.notify_by_email
from public.appointments a
left join public.units u on u.id = a.unit_id
left join public.properties p on p.id = u.property_id
union all
select
  'l:' || l.id::text || ':' || lu.unit_id::text || ':' || ev.kind as event_id,
  l.organization_id,
  'lease'::text                           as source,
  ev.kind,
  'Bail ' || l.number::text               as title,
  (ev.day::timestamp at time zone 'Africa/Tunis')       as starts_at,
  ((ev.day + 1)::timestamp at time zone 'Africa/Tunis') as ends_at,
  true                                    as all_day,
  l.status,
  null::uuid                              as appointment_id,
  l.id                                    as lease_id,
  lu.unit_id,
  p.branch_id,
  null::uuid                              as assigned_user_id,
  coalesce((select array_agg(lp.contact_id order by lp.contact_id)
            from public.lease_parties lp where lp.lease_id = l.id), '{}'::uuid[]) as contact_ids,
  null::text                              as location,
  false                                   as notify_by_email
from public.leases l
join public.lease_units lu on lu.lease_id = l.id
join public.units u on u.id = lu.unit_id
join public.properties p on p.id = u.property_id
cross join lateral (
  values
    ('lease_start'::text, l.start_date),
    ('lease_end'::text, l.end_date),
    ('registration_deadline'::text,
     case when l.registered_at is null and l.signed_at is not null
          then l.signed_at + public.lease_rule('registration_days') end)
) as ev (kind, day)
where l.status = 'active'
  and l.archived_at is null
  and ev.day is not null;

-- Day thresholds: the 0003 values, plus how long an automatic expiry stays worth a notification and
-- how long notifications are kept.
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
    when 'expired_notice_days' then 7
    when 'notification_retention_days' then 90
  end;
$$;

-- Daily job (admin only, called by the lease-daily function after expire_overdue_leases).
-- Writes one notification per staff recipient; the dedupe key makes a second run the same day a no-op.
-- Titles are ASCII ('Bail <number>' or the appointment title); the web and the e-mail templates add the
-- French wording from the kind. Returns the notifications it inserted (a row set, because the data layer tracks
-- only set-returning functions).
create or replace function public.generate_daily_notifications()
returns setof public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.today_tunis();
begin
  -- Leases: ending soon, grace week, recent automatic expiry, registration due or overdue. Every staff member.
  return query
  with inserted as (
  insert into public.notifications (organization_id, user_id, kind, title, link, lease_id, dedupe_key)
  select o.organization_id, s.user_id, ev.kind, 'Bail ' || o.number::text, '/baux/' || o.id::text, o.id, ev.dedupe_key
  from public.lease_overview o
  join public.staff_members s on s.organization_id = o.organization_id
  cross join lateral (
    values
      ('lease_ending_soon', o.is_ending_soon,
       'lease_ending_soon:' || o.id::text || ':' || o.end_date::text),
      ('lease_grace', o.in_grace,
       'lease_grace:' || o.id::text || ':' || o.end_date::text),
      -- expire_overdue_leases sets ended_on to the END DATE and runs on the first day after the grace week,
      -- so the day a lease expired is end_date + grace_days + 1, not ended_on.
      ('lease_expired',
       o.status = 'expired' and o.end_reason = 'expired_auto'
         and o.end_date + public.lease_rule('grace_days') + 1 >= v_today - public.lease_rule('expired_notice_days'),
       'lease_expired:' || o.id::text),
      ('registration_due', o.registration_state = 'due_soon',
       'registration_due:' || o.id::text || ':' || coalesce(o.registration_deadline::text, '')),
      ('registration_overdue', o.registration_state = 'overdue',
       'registration_overdue:' || o.id::text || ':' || coalesce(o.registration_deadline::text, ''))
  ) as ev (kind, applies, dedupe_key)
  where o.archived_at is null
    and ev.applies
  on conflict (organization_id, user_id, dedupe_key) do nothing
  returning *
  )
  select * from inserted;

  -- Appointments planned for tomorrow (Tunis day): the staff member in charge, or every staff member
  -- when nobody is assigned. Cancelled and done appointments get nothing.
  return query
  with inserted as (
  insert into public.notifications (organization_id, user_id, kind, title, link, appointment_id, lease_id, dedupe_key)
  select a.organization_id, s.user_id, 'appointment_reminder', a.title, '/calendrier?rendezvous=' || a.id::text,
         a.id, a.lease_id,
         -- The key carries the appointment day: an appointment moved to another day is reminded again.
         'appointment_reminder:' || a.id::text || ':' || (a.starts_at at time zone 'Africa/Tunis')::date::text
  from public.appointments a
  join public.staff_members s
    on s.organization_id = a.organization_id
   and (a.assigned_user_id is null or s.user_id = a.assigned_user_id)
  where a.status = 'planned'
    and (a.starts_at at time zone 'Africa/Tunis')::date = v_today + 1
  on conflict (organization_id, user_id, dedupe_key) do nothing
  returning *
  )
  select * from inserted;

  -- reminder_sent_at = the last run that covered the appointment.
  update public.appointments
  set reminder_sent_at = now()
  where status = 'planned'
    and (starts_at at time zone 'Africa/Tunis')::date = v_today + 1;

  delete from public.notifications
  where created_at < now() - public.lease_rule('notification_retention_days') * interval '1 day';
end;
$$;

-- Only the data-layer database role (and the owner) may run the trigger function and the daily job.
do $$
declare
  v_fn   text;
  v_role text;
begin
  foreach v_fn in array array[
    'public.generate_daily_notifications()',
    'public.check_appointment_staff()',
    'public.drop_stale_appointment_reminders()'
  ] loop
    execute format('revoke execute on function %s from public', v_fn);
    foreach v_role in array array['nhost_hasura', 'postgres'] loop
      if exists (select 1 from pg_roles where rolname = v_role) then
        execute format('grant execute on function %s to %I', v_fn, v_role);
      end if;
    end loop;
  end loop;
end $$;
