-- Tests for 0008_visitor_requests. Paste into the legacy console SQL Editor and Run, or run locally with
-- bash scripts/db-local.sh test db/tests/0008_visitor_requests.test.sql
-- One DO block that always ends by raising an exception, so everything rolls back and no test data stays.
-- Success: the error "OK: all visitor request tests passed". Failure: an error starting with "FAIL".

do $$
declare
  org   uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br    uuid := '21111111-1111-4111-8111-111111111111';
  prop  uuid := 'f0000000-0000-4000-8000-000000000003';
  u_rent uuid := 'f0000000-0000-4000-8000-000000000011';
  u_sale uuid := 'f0000000-0000-4000-8000-000000000012';
  u_off  uuid := 'f0000000-0000-4000-8000-000000000013';  -- vacant, no photo: not on the website
  staff1 uuid := 'f0000000-0000-4000-8000-000000000031';
  staff2 uuid := 'f0000000-0000-4000-8000-000000000032';
  f1 uuid := 'f0000000-0000-4000-8000-000000000201';
  f2 uuid := 'f0000000-0000-4000-8000-000000000202';
  v_id uuid;
  v_text text;
  v_int integer;
  v_date date := public.today_tunis() + 3;
begin
  -- A Monday-to-Saturday day for the visits (skip Sunday).
  if extract(isodow from v_date) = 7 then v_date := v_date + 1; end if;

  insert into properties (id, organization_id, branch_id, name, type, city) values (prop, org, br, 'Bien test demandes', 'building', 'Tunis');
  insert into units (id, organization_id, property_id, code, type, status, rent_amount, sale_price) values
    (u_rent, org, prop, 'R-1', 'apartment', 'vacant', 900, null),
    (u_sale, org, prop, 'R-2', 'apartment', 'for_sale', null, 300000),
    (u_off,  org, prop, 'R-3', 'apartment', 'vacant', 700, null);
  insert into storage.files (id, bucket_id) values (f1, 'property-files'), (f2, 'property-files');
  insert into property_files (organization_id, unit_id, storage_file_id, kind, title) values
    (org, u_rent, f1, 'photo', 'Photo'), (org, u_sale, f2, 'photo', 'Photo');
  -- Two staff members of the organization.
  insert into auth.users (id, email, metadata) values
    (staff1, 'a@test.local', json_build_object('organization_id', org)::jsonb),
    (staff2, 'b@test.local', json_build_object('organization_id', org)::jsonb);
  insert into auth.user_roles (user_id, role) values (staff1, 'org_admin'), (staff2, 'manager');
  -- Requests need a signed-in client (migration 0009): the calls below run as this user.
  perform set_config('hasura.user', '{"x-hasura-user-id":"' || staff1 || '"}', true);

  -- 1. A rental request lands in the table and notifies every staff member.
  select id into v_id from submit_rental_request(u_rent, public.today_tunis() + 5, 12, ' Amine Test ', '+216 20 111 222', 'amine@example.tn', 'Bonjour');
  select status || '/' || duration_months::text || '/' || full_name || '/' || phone into v_text from rental_requests where id = v_id;
  if v_text <> 'new/12/Amine Test/+216 20 111 222' then raise exception 'FAIL 1a: row is %', v_text; end if;
  select count(*) into v_int from notifications where kind = 'rental_request' and dedupe_key = 'rental_request:' || v_id and user_id in (staff1, staff2);
  if v_int <> 2 then raise exception 'FAIL 1b: % staff notified', v_int; end if;
  select link into v_text from notifications where dedupe_key = 'rental_request:' || v_id limit 1;
  if v_text <> '/erp/baux/demandes' then raise exception 'FAIL 1c: link is %', v_text; end if;

  -- 1d. The same pending request again is refused.
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine Test', '+216 20 111 222', null, null);
    raise exception 'FAIL 1d: identical pending request accepted';
  exception when others then if sqlerrm <> 'REQUEST_DUPLICATE' then raise exception 'FAIL 1d: wrong error %', sqlerrm; end if; end;

  -- 2. Rental request rules: only a unit for rent, a sane start date and duration, a sane contact.
  begin perform submit_rental_request(u_sale, public.today_tunis() + 5, 12, 'Amine Test', '20111222', null, null);
    raise exception 'FAIL 2a: rental request on a unit for sale';
  exception when others then if sqlerrm <> 'REQUEST_NOT_FOR_RENT' then raise exception 'FAIL 2a: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_off, public.today_tunis() + 5, 12, 'Amine Test', '20111222', null, null);
    raise exception 'FAIL 2b: request on a unit that is not on the website';
  exception when others then if sqlerrm <> 'REQUEST_UNIT_UNAVAILABLE' then raise exception 'FAIL 2b: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() - 1, 12, 'Amine Test', '20111222', null, null);
    raise exception 'FAIL 2c: start date in the past';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2c: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 0, 'Amine Test', '20111222', null, null);
    raise exception 'FAIL 2d: duration 0';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2d: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'A', '20111222', null, null);
    raise exception 'FAIL 2e: one-letter name';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2e: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine Test', 'abc', null, null);
    raise exception 'FAIL 2f: phone with letters';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2f: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine Test', '20111222', 'not-an-email', null);
    raise exception 'FAIL 2g: bad email';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2g: wrong error %', sqlerrm; end if; end;

  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, '  ', '20111222', null, null);
    raise exception 'FAIL 2h: blank name';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2h: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine <b>Test', '20111222', null, null);
    raise exception 'FAIL 2i: name with angle brackets';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2i: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine Test', ' 12 34 ', null, null);
    raise exception 'FAIL 2j: phone with fewer than 7 digits';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2j: wrong error %', sqlerrm; end if; end;

  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine ' || chr(8238) || 'Test', '20111222', null, null);
    raise exception 'FAIL 2k: name with a bidi override';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2k: wrong error %', sqlerrm; end if; end;
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 12, 'Amine Test', '20111222', 'a@b.co?bcc=x@evil.com', null);
    raise exception 'FAIL 2l: e-mail with a query string';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 2l: wrong error %', sqlerrm; end if; end;

  -- 3. Throttle: a phone number (digits only, whatever the formatting) may send 3 rental requests per hour.
  perform submit_rental_request(u_rent, public.today_tunis() + 5, 6, 'Amine Test', '+216 20 111 222', null, null);
  perform submit_rental_request(u_rent, public.today_tunis() + 5, 7, 'Amine Test', '(216) 20-111-222', null, null);
  begin perform submit_rental_request(u_rent, public.today_tunis() + 5, 8, 'Amine Test', '+216-20-111-222', null, null);
    raise exception 'FAIL 3: fourth request in an hour accepted';
  exception when others then if sqlerrm <> 'REQUEST_TOO_MANY' then raise exception 'FAIL 3: wrong error %', sqlerrm; end if; end;

  -- 4. A visit request: any unit on the website, tomorrow to 30 days, Monday to Saturday, half-hour slots 09:00-17:30.
  select id into v_id from submit_visit_request(u_sale, v_date, time '10:30', 'Sana Test', '71 000 111', null, null);
  select status || '/' || visit_time::text into v_text from visit_requests where id = v_id;
  if v_text <> 'new/10:30:00' then raise exception 'FAIL 4a: row is %', v_text; end if;
  select count(*) into v_int from notifications where kind = 'visit_request' and dedupe_key = 'visit_request:' || v_id and link = '/erp/visites' and user_id in (staff1, staff2);
  if v_int <> 2 then raise exception 'FAIL 4b: % staff notified', v_int; end if;
  begin perform submit_visit_request(u_sale, public.today_tunis(), time '10:30', 'Sana Test', '71000222', null, null);
    raise exception 'FAIL 4c: visit today';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 4c: wrong error %', sqlerrm; end if; end;
  begin perform submit_visit_request(u_sale, public.today_tunis() + 31, time '10:30', 'Sana Test', '71000222', null, null);
    raise exception 'FAIL 4d: visit in 31 days';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 4d: wrong error %', sqlerrm; end if; end;
  begin perform submit_visit_request(u_sale, v_date, time '10:15', 'Sana Test', '71000222', null, null);
    raise exception 'FAIL 4e: quarter-hour slot';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 4e: wrong error %', sqlerrm; end if; end;
  begin perform submit_visit_request(u_sale, v_date, time '18:00', 'Sana Test', '71000222', null, null);
    raise exception 'FAIL 4f: evening slot';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 4f: wrong error %', sqlerrm; end if; end;
  begin perform submit_visit_request(u_sale, v_date + (7 - extract(isodow from v_date)::integer), time '10:30', 'Sana Test', '71000222', null, null);
    raise exception 'FAIL 4g: Sunday visit';
  exception when others then if sqlerrm <> 'REQUEST_INVALID' then raise exception 'FAIL 4g: wrong error %', sqlerrm; end if; end;

  -- 4h. Visit throttle: 3 per phone per hour.
  perform submit_visit_request(u_sale, v_date, time '09:00', 'Sana Test', '55 000 111', null, null);
  perform submit_visit_request(u_sale, v_date, time '09:30', 'Sana Test', '55-000-111', null, null);
  perform submit_visit_request(u_sale, v_date, time '11:00', 'Sana Test', '55000111', null, null);
  begin perform submit_visit_request(u_sale, v_date, time '11:30', 'Sana Test', '55 000 111', null, null);
    raise exception 'FAIL 4h: fourth visit request in an hour accepted';
  exception when others then if sqlerrm <> 'REQUEST_TOO_MANY' then raise exception 'FAIL 4h: wrong error %', sqlerrm; end if; end;

  -- 5. A confirmed slot is taken: it shows in the public view and cannot be requested again; a second confirmation is refused.
  update visit_requests set status = 'confirmed' where id = v_id;
  select count(*) into v_int from public_taken_visit_slots where unit_id = u_sale and visit_date = v_date and visit_time = time '10:30';
  if v_int <> 1 then raise exception 'FAIL 5a: slot not in the public view'; end if;
  begin perform submit_visit_request(u_sale, v_date, time '10:30', 'Autre Test', '71000333', null, null);
    raise exception 'FAIL 5b: confirmed slot requested again';
  exception when others then if sqlerrm <> 'REQUEST_SLOT_TAKEN' then raise exception 'FAIL 5b: wrong error %', sqlerrm; end if; end;
  insert into visit_requests (organization_id, unit_id, visit_date, visit_time, full_name, phone)
  values (org, u_sale, v_date, time '10:30', 'Autre Test', '71000333');
  begin update visit_requests set status = 'confirmed' where unit_id = u_sale and visit_date = v_date and visit_time = time '10:30' and status = 'new';
    raise exception 'FAIL 5c: two confirmed visits on one slot';
  exception when unique_violation then null; end;

  -- 5d. A confirmed visit on a unit that is not on the website never shows in the public view.
  insert into visit_requests (organization_id, unit_id, visit_date, visit_time, full_name, phone, status)
  values (org, u_off, v_date, time '14:00', 'Cache Test', '71000444', 'confirmed');
  select count(*) into v_int from public_taken_visit_slots where unit_id = u_off;
  if v_int <> 0 then raise exception 'FAIL 5d: hidden unit slot leaked in the public view'; end if;

  -- 6. updated_at follows updates.
  update rental_requests set staff_note = 'rappel', updated_at = now() - interval '1 day' where id = (select id from rental_requests limit 1);
  if (select min(updated_at) from rental_requests) < now() - interval '1 minute' then raise exception 'FAIL 6: updated_at not maintained'; end if;

  raise exception 'OK: all visitor request tests passed';
end $$;
