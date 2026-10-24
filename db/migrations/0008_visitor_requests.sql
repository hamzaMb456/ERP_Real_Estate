-- 0008_visitor_requests: what a visitor of the public site can ask for on a unit: a rental request (start date and lease
-- duration) and a visit request (a day and a time). Both land in the ERP, notify the staff, and are answered there.
-- Apply after 0007, then run db/tests/0008_visitor_requests.test.sql. Safe to run twice.
-- ASCII only: this file travels through the clipboard, so French text never appears here (notification titles are ASCII).
--
-- Visitors never touch the tables. They call submit_rental_request / submit_visit_request (Hasura mutations for the role
-- public), which check the unit is on the website, validate every value, throttle abuse and insert the row.
-- Abuse limits (SQL cannot see an IP address; add a per-IP rate limit at the edge if the site is attacked):
--   - one phone number (digits only, so "20 111 222" and "20111222" are the same) sends at most 3 requests of a kind an hour;
--   - the whole organization receives at most 30 requests of a kind in 10 minutes;
--   - an identical pending request is refused.
-- "Today" is always Tunisia (public.today_tunis()).

-- A phone number reduced to its digits.
create or replace function public.phone_digits(p_phone text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$ select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') $$;

create table if not exists public.rental_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  unit_id          uuid not null,
  start_date       date not null,
  duration_months  smallint not null check (duration_months between 1 and 120),
  full_name        text not null check (length(trim(full_name)) between 2 and 120 and full_name !~ '[[:cntrl:]<>\u202A-\u202E\u2066-\u2069]'),
  phone            text not null check (phone ~ '^[0-9 +().-]{6,25}$' and length(public.phone_digits(phone)) >= 7),
  phone_digits     text generated always as (public.phone_digits(phone)) stored,
  email            text check (email is null or (length(email) <= 200 and email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$')),
  message          text check (message is null or length(message) <= 2000),
  status           text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined', 'closed')),
  staff_note       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict
);
create index if not exists rental_requests_org_status_idx on public.rental_requests (organization_id, status, created_at desc);
create index if not exists rental_requests_unit_idx on public.rental_requests (unit_id);
create index if not exists rental_requests_throttle_idx on public.rental_requests (organization_id, phone_digits, created_at desc);
drop trigger if exists rental_requests_set_updated_at on public.rental_requests;
create trigger rental_requests_set_updated_at before update on public.rental_requests
  for each row execute function public.set_updated_at();

create table if not exists public.visit_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  unit_id          uuid not null,
  visit_date       date not null,
  visit_time       time not null,
  full_name        text not null check (length(trim(full_name)) between 2 and 120 and full_name !~ '[[:cntrl:]<>\u202A-\u202E\u2066-\u2069]'),
  phone            text not null check (phone ~ '^[0-9 +().-]{6,25}$' and length(public.phone_digits(phone)) >= 7),
  phone_digits     text generated always as (public.phone_digits(phone)) stored,
  email            text check (email is null or (length(email) <= 200 and email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$')),
  message          text check (message is null or length(message) <= 2000),
  status           text not null default 'new' check (status in ('new', 'confirmed', 'declined', 'done', 'cancelled')),
  -- The calendar appointment created when staff confirm the visit (same organization, enforced by the composite key).
  appointment_id   uuid,
  staff_note       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (unit_id, organization_id) references public.units (id, organization_id) on delete restrict,
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id)
);
create index if not exists visit_requests_org_status_idx on public.visit_requests (organization_id, status, created_at desc);
create index if not exists visit_requests_unit_idx on public.visit_requests (unit_id);
create index if not exists visit_requests_appointment_idx on public.visit_requests (appointment_id) where appointment_id is not null;
create index if not exists visit_requests_throttle_idx on public.visit_requests (organization_id, phone_digits, created_at desc);
-- A unit is visited by one party at a time: two confirmed visits never share a slot.
create unique index if not exists visit_requests_one_confirmed_slot on public.visit_requests (unit_id, visit_date, visit_time)
  where status = 'confirmed';
drop trigger if exists visit_requests_set_updated_at on public.visit_requests;
create trigger visit_requests_set_updated_at before update on public.visit_requests
  for each row execute function public.set_updated_at();

-- The two new kinds of notification, shown in the staff's bell.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('lease_ending_soon', 'lease_grace', 'lease_expired', 'registration_due', 'registration_overdue',
           'appointment_reminder', 'rental_request', 'visit_request')
);

-- Every staff member of the organization is told about a new request, linking to the right ERP page.
create or replace function public.notify_staff_of_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind  text := case tg_table_name when 'rental_requests' then 'rental_request' else 'visit_request' end;
  v_title text := case tg_table_name when 'rental_requests' then 'Nouvelle demande de location' else 'Nouvelle demande de visite' end;
  v_link  text := case tg_table_name when 'rental_requests' then '/erp/baux/demandes' else '/erp/visites' end;
  v_code  text;
begin
  select u.code into v_code from public.units u where u.id = new.unit_id;
  insert into public.notifications (organization_id, user_id, kind, title, body, link, dedupe_key)
  select new.organization_id, s.user_id, v_kind, v_title, new.full_name || ' - ' || coalesce(v_code, ''), v_link, v_kind || ':' || new.id
  from public.staff_members s
  where s.organization_id = new.organization_id
  on conflict do nothing;
  return null;
end;
$$;
drop trigger if exists rental_requests_notify on public.rental_requests;
create trigger rental_requests_notify after insert on public.rental_requests
  for each row execute function public.notify_staff_of_request();
drop trigger if exists visit_requests_notify on public.visit_requests;
create trigger visit_requests_notify after insert on public.visit_requests
  for each row execute function public.notify_staff_of_request();

-- What a submit function answers: the id of the new request. A view with no rows only gives Hasura a row type to track.
create or replace view public.request_receipt as
select null::uuid as id, null::text as kind
where false;

-- Checks shared by both submit functions: the unit is on the website, the contact details are sane, and the abuse limits
-- above. Returns the organization of the unit. Everything is validated on the trimmed values that get stored.
create or replace function public.check_visitor_request(p_unit uuid, p_name text, p_phone text, p_email text, p_message text,
                                                        p_table text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org    uuid;
  v_name   text := trim(coalesce(p_name, ''));
  v_phone  text := trim(coalesce(p_phone, ''));
  v_email  text := nullif(trim(coalesce(p_email, '')), '');
  v_digits text;
  v_phone_count integer;
  v_org_count   integer;
begin
  select l.organization_id into v_org from public.public_listings l where l.id = p_unit;
  if v_org is null then
    raise exception 'REQUEST_UNIT_UNAVAILABLE' using errcode = '23514';
  end if;
  v_digits := public.phone_digits(v_phone);
  if length(v_name) not between 2 and 120 or v_name ~ '[[:cntrl:]<>\u202A-\u202E\u2066-\u2069]'
     or v_phone !~ '^[0-9 +().-]{6,25}$' or length(v_digits) < 7
     or (v_email is not null and (length(v_email) > 200 or v_email !~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$'))
     or length(coalesce(p_message, '')) > 2000 then
    raise exception 'REQUEST_INVALID' using errcode = '23514';
  end if;
  -- Concurrent submissions of one phone number queue here, so the count below cannot be raced past the limit.
  perform pg_advisory_xact_lock(hashtext('visitor_request:' || v_digits));
  if p_table = 'rental_requests' then
    select count(*) filter (where r.phone_digits = v_digits and r.created_at > now() - interval '1 hour'),
           count(*) filter (where r.created_at > now() - interval '10 minutes')
    into v_phone_count, v_org_count
    from public.rental_requests r where r.organization_id = v_org and r.created_at > now() - interval '1 hour';
  else
    select count(*) filter (where r.phone_digits = v_digits and r.created_at > now() - interval '1 hour'),
           count(*) filter (where r.created_at > now() - interval '10 minutes')
    into v_phone_count, v_org_count
    from public.visit_requests r where r.organization_id = v_org and r.created_at > now() - interval '1 hour';
  end if;
  if v_phone_count >= 3 or v_org_count >= 30 then
    raise exception 'REQUEST_TOO_MANY' using errcode = '23514';
  end if;
  return v_org;
end;
$$;

-- Rental request: only for a unit offered for rent, starting from today within a year, for 1 to 120 months.
create or replace function public.submit_rental_request(p_unit_id uuid, p_start_date date, p_duration_months integer,
                                                        p_full_name text, p_phone text, p_email text, p_message text)
returns setof public.request_receipt
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.check_visitor_request(p_unit_id, p_full_name, p_phone, p_email, p_message, 'rental_requests');
  v_id  uuid;
begin
  if (select l.kind from public.public_listings l where l.id = p_unit_id) <> 'rent' then
    raise exception 'REQUEST_NOT_FOR_RENT' using errcode = '23514';
  end if;
  if p_start_date is null or p_start_date < public.today_tunis() or p_start_date > public.today_tunis() + 365
     or p_duration_months is null or p_duration_months not between 1 and 120 then
    raise exception 'REQUEST_INVALID' using errcode = '23514';
  end if;
  if exists (select 1 from public.rental_requests r
             where r.unit_id = p_unit_id and r.phone_digits = public.phone_digits(p_phone) and r.status = 'new'
               and r.start_date = p_start_date and r.duration_months = p_duration_months) then
    raise exception 'REQUEST_DUPLICATE' using errcode = '23514';
  end if;
  insert into public.rental_requests (organization_id, unit_id, start_date, duration_months, full_name, phone, email, message)
  values (v_org, p_unit_id, p_start_date, p_duration_months, trim(p_full_name), trim(p_phone),
          nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return query select v_id, 'rental'::text;
end;
$$;

-- Visit request: from tomorrow to 30 days ahead, Monday to Saturday, 09:00 to 17:30 on the half hour, never on a slot
-- already confirmed for this unit.
create or replace function public.submit_visit_request(p_unit_id uuid, p_visit_date date, p_visit_time time,
                                                       p_full_name text, p_phone text, p_email text, p_message text)
returns setof public.request_receipt
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.check_visitor_request(p_unit_id, p_full_name, p_phone, p_email, p_message, 'visit_requests');
  v_id  uuid;
begin
  if p_visit_date is null or p_visit_time is null
     or p_visit_date < public.today_tunis() + 1 or p_visit_date > public.today_tunis() + 30
     or extract(isodow from p_visit_date) = 7
     or p_visit_time < time '09:00' or p_visit_time > time '17:30'
     or extract(minute from p_visit_time) not in (0, 30) or extract(second from p_visit_time) <> 0 then
    raise exception 'REQUEST_INVALID' using errcode = '23514';
  end if;
  if exists (select 1 from public.visit_requests r
             where r.unit_id = p_unit_id and r.visit_date = p_visit_date and r.visit_time = p_visit_time and r.status = 'confirmed') then
    raise exception 'REQUEST_SLOT_TAKEN' using errcode = '23514';
  end if;
  if exists (select 1 from public.visit_requests r
             where r.unit_id = p_unit_id and r.phone_digits = public.phone_digits(p_phone) and r.status = 'new'
               and r.visit_date = p_visit_date and r.visit_time = p_visit_time) then
    raise exception 'REQUEST_DUPLICATE' using errcode = '23514';
  end if;
  insert into public.visit_requests (organization_id, unit_id, visit_date, visit_time, full_name, phone, email, message)
  values (v_org, p_unit_id, p_visit_date, p_visit_time, trim(p_full_name), trim(p_phone),
          nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_message, '')), ''))
  returning id into v_id;
  return query select v_id, 'visit'::text;
end;
$$;

-- The slots already taken (confirmed visits) of the units that are on the website, so the site can grey them out.
-- No names, no phones, and nothing about units that are not public.
create or replace view public.public_taken_visit_slots as
select vr.unit_id, vr.organization_id, vr.visit_date, vr.visit_time
from public.visit_requests vr
join public.public_listings l on l.id = vr.unit_id
where vr.status = 'confirmed' and vr.visit_date >= public.today_tunis();

-- Only the Hasura database role (and the owner) may run these functions directly.
do $$
declare
  v_fn   text;
  v_role text;
begin
  foreach v_fn in array array[
    'public.notify_staff_of_request()',
    'public.check_visitor_request(uuid, text, text, text, text, text)',
    'public.submit_rental_request(uuid, date, integer, text, text, text, text)',
    'public.submit_visit_request(uuid, date, time, text, text, text, text)'
  ] loop
    execute format('revoke execute on function %s from public', v_fn);
    foreach v_role in array array['nhost_hasura', 'postgres'] loop
      if exists (select 1 from pg_roles where rolname = v_role) then
        execute format('grant execute on function %s to %I', v_fn, v_role);
      end if;
    end loop;
  end loop;
end $$;
