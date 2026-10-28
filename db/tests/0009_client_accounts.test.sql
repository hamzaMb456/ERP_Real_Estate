-- Tests for 0009_client_accounts. Run locally with: bash scripts/db-local.sh test db/tests/0009_client_accounts.test.sql
-- or paste into the legacy console SQL editor. Always ends with an exception so nothing stays; success = "OK: all client account tests passed".

do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';
  br     uuid := '21111111-1111-4111-8111-111111111111';
  prop   uuid := 'f0000000-0000-4000-8000-000000000003';
  u_rent uuid := 'f0000000-0000-4000-8000-000000000011';
  client uuid := 'f0000000-0000-4000-8000-000000000041';
  f1     uuid := 'f0000000-0000-4000-8000-000000000201';
  v_id   uuid;
  v_who  uuid;
  v_date date := public.today_tunis() + 3;
begin
  if extract(isodow from v_date) = 7 then v_date := v_date + 1; end if;
  insert into properties (id, organization_id, branch_id, name, type, city) values (prop, org, br, 'Bien test clients', 'building', 'Tunis');
  insert into units (id, organization_id, property_id, code, type, status, rent_amount) values (u_rent, org, prop, 'C-1', 'apartment', 'vacant', 900);
  insert into storage.files (id, bucket_id) values (f1, 'property-files');
  insert into property_files (organization_id, unit_id, storage_file_id, kind, title) values (org, u_rent, f1, 'photo', 'Photo');
  insert into auth.users (id, email, metadata) values (client, 'client@test.local', '{}'::jsonb);

  -- 1. No session: both requests are refused.
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Client Test', '20111222', null, null);
    raise exception 'FAIL 1a: rental request without a signed-in client';
  exception when others then if sqlerrm <> 'REQUEST_LOGIN_REQUIRED' then raise exception 'FAIL 1a: wrong error %', sqlerrm; end if; end;
  begin perform submit_visit_request(u_rent, v_date, time '10:00', 'Client Test', '20111222', null, null);
    raise exception 'FAIL 1b: visit request without a signed-in client';
  exception when others then if sqlerrm <> 'REQUEST_LOGIN_REQUIRED' then raise exception 'FAIL 1b: wrong error %', sqlerrm; end if; end;

  -- 2. A session value that is not a uuid counts as no session.
  perform set_config('hasura.user', '{"x-hasura-user-id":"not-a-uuid"}', true);
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Client Test', '20111222', null, null);
    raise exception 'FAIL 2: request with a malformed user id';
  exception when others then if sqlerrm <> 'REQUEST_LOGIN_REQUIRED' then raise exception 'FAIL 2: wrong error %', sqlerrm; end if; end;

  -- 3. A signed-in client: the request is stored with the client's id, for both kinds.
  perform set_config('hasura.user', '{"x-hasura-user-id":"' || client || '","x-hasura-role":"user"}', true);
  select id into v_id from submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Client Test', '20111222', null, null);
  select client_user_id into v_who from rental_requests where id = v_id;
  if v_who is distinct from client then raise exception 'FAIL 3a: rental request not tied to the client (%)', v_who; end if;
  select id into v_id from submit_visit_request(u_rent, v_date, time '10:00', 'Client Test', '20111223', null, null);
  select client_user_id into v_who from visit_requests where id = v_id;
  if v_who is distinct from client then raise exception 'FAIL 3b: visit request not tied to the client (%)', v_who; end if;

  -- 4. A client cannot claim another user's id through the function arguments: the id only comes from the session.
  if (select count(*) from rental_requests where client_user_id <> client) <> 0 then raise exception 'FAIL 4: foreign client id stored'; end if;

  raise exception 'OK: all client account tests passed';
end $$;
