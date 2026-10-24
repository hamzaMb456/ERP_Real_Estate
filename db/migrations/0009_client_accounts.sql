-- 0009_client_accounts: visitors must be signed in to send a rental or visit request. A client account is an ordinary
-- Nhost user with the default role "user" (not a staff role). The two submit functions are now called with the client's
-- own token; this trigger records who sent the request and refuses a request without a signed-in user.
-- Apply after 0008, then run db/tests/0009_client_accounts.test.sql. Safe to run twice. ASCII only.

alter table public.rental_requests add column if not exists client_user_id uuid references auth.users (id) on delete set null;
alter table public.visit_requests add column if not exists client_user_id uuid references auth.users (id) on delete set null;
create index if not exists rental_requests_client_idx on public.rental_requests (client_user_id) where client_user_id is not null;
create index if not exists visit_requests_client_idx on public.visit_requests (client_user_id) where client_user_id is not null;

-- The user id Hasura puts in the session of the call (null when there is none).
create or replace function public.current_client_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select case
           when coalesce(current_setting('hasura.user', true), '') = '' then null
           when (current_setting('hasura.user', true)::json ->> 'x-hasura-user-id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then (current_setting('hasura.user', true)::json ->> 'x-hasura-user-id')::uuid
         end
$$;

create or replace function public.require_client_on_request()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.client_user_id := public.current_client_id();
  if new.client_user_id is null then
    raise exception 'REQUEST_LOGIN_REQUIRED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists rental_requests_require_client on public.rental_requests;
create trigger rental_requests_require_client before insert on public.rental_requests
  for each row execute function public.require_client_on_request();
drop trigger if exists visit_requests_require_client on public.visit_requests;
create trigger visit_requests_require_client before insert on public.visit_requests
  for each row execute function public.require_client_on_request();

do $$
declare
  v_role text;
begin
  foreach v_role in array array['nhost_hasura', 'postgres'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('grant execute on function public.current_client_id() to %I', v_role);
    end if;
  end loop;
end $$;
