-- Tests for 0002_core_records. Paste into Nhost dashboard → Database → SQL Editor and Run.
-- Everything runs inside one DO block that always ends by raising an exception, so the
-- whole transaction rolls back and no test data stays in the database.
-- Success: the editor shows the error « OK: all core-records tests passed ».
-- Failure: the editor shows an error starting with « FAIL ».
do $$
declare
  org    uuid := '11111111-1111-4111-8111-111111111111';  -- demo organization (seed 0001)
  br     uuid := '21111111-1111-4111-8111-111111111111';
  prop   uuid := 'a0000000-0000-4000-8000-000000000001';
  u1     uuid := 'a0000000-0000-4000-8000-000000000011';
  u2     uuid := 'a0000000-0000-4000-8000-000000000012';
  c1     uuid := 'a0000000-0000-4000-8000-000000000021';
  c2     uuid := 'a0000000-0000-4000-8000-000000000022';
  org2   uuid := 'a0000000-0000-4000-8000-000000000031';
  c_org2 uuid := 'a0000000-0000-4000-8000-000000000032';
  house  uuid := 'a0000000-0000-4000-8000-000000000041';
  n int;
begin
  insert into properties (id, organization_id, branch_id, name, type) values (prop, org, br, 'Test bien', 'building');
  insert into units (id, organization_id, property_id, code) values (u1, org, prop, 'T-1'), (u2, org, prop, 'T-2');
  insert into contacts (id, organization_id, full_name) values (c1, org, 'Test Un'), (c2, org, 'Test Deux');

  -- 1. Shares above 100 % on the same day are refused.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c1, 80, '2026-01-01'), (org, u1, c2, 30, '2026-01-01');
    set constraints ownerships_shares_cap immediate;
    raise exception 'FAIL 1: shares above 100 %% were accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like 'ownership_shares_exceeded:01/01/2026%' then
      raise exception 'FAIL 1: wrong error: %', sqlerrm;
    end if;
  end;

  -- 2. A transfer in one transaction is accepted even when the new owner is inserted
  --    before the old one is ended (only possible because the check is deferred).
  begin
    set constraints ownerships_shares_cap deferred;
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c1, 100, '2026-01-01');
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c2, 100, '2026-03-15');
    update ownerships set ends_on = '2026-03-14' where unit_id = u1 and contact_id = c1;
    set constraints ownerships_shares_cap immediate;
    raise exception 'PASS 2';
  exception when others then
    if sqlerrm <> 'PASS 2' then raise exception 'FAIL 2: transfer refused: %', sqlerrm; end if;
  end;

  -- 3. The same owner cannot hold overlapping periods on one unit.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on, ends_on)
    values (org, u2, c1, 50, '2026-01-01', '2026-06-30'), (org, u2, c1, 50, '2026-06-01', null);
    raise exception 'FAIL 3: overlap accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%ownerships_no_overlap%' then raise exception 'FAIL 3: wrong error: %', sqlerrm; end if;
  end;

  -- 4. End date before start date is refused.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on, ends_on)
    values (org, u2, c1, 50, '2026-05-01', '2026-04-30');
    raise exception 'FAIL 4: end before start accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%ownerships_dates_check%' then raise exception 'FAIL 4: wrong error: %', sqlerrm; end if;
  end;

  -- 5. A contact of another organization cannot own a unit of this one.
  begin
    insert into organizations (id, name) values (org2, 'Autre org');
    insert into contacts (id, organization_id, full_name) values (c_org2, org2, 'Étranger');
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u2, c_org2, 10, '2026-01-01');
    raise exception 'FAIL 5: cross-organization ownership accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%violates foreign key constraint%' then raise exception 'FAIL 5: wrong error: %', sqlerrm; end if;
  end;

  -- 6. A new organization gets its self contact, with the owner role.
  begin
    insert into organizations (id, name) values (org2, 'Autre org');
    select count(*) into n from contacts c join contact_roles r on r.contact_id = c.id and r.role = 'owner'
    where c.organization_id = org2 and c.is_organization and c.full_name = 'Autre org';
    if n <> 1 then raise exception 'FAIL 6: self contact missing (found %)', n; end if;
    raise exception 'PASS 6';
  exception when others then
    if sqlerrm <> 'PASS 6' then raise; end if;
  end;

  -- 7. A house gets its single unit automatically.
  begin
    insert into properties (id, organization_id, branch_id, name, type) values (house, org, br, 'Maison test', 'house');
    select count(*) into n from units where property_id = house and code = 'MAISON' and type = 'house';
    if n <> 1 then raise exception 'FAIL 7: house unit missing (found %)', n; end if;
    raise exception 'PASS 7';
  exception when others then
    if sqlerrm <> 'PASS 7' then raise; end if;
  end;

  -- 8. Unit references stay unique inside a bien.
  begin
    insert into units (organization_id, property_id, code) values (org, prop, 'T-1');
    raise exception 'FAIL 8: duplicate unit code accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%units_property_id_code_key%' then raise exception 'FAIL 8: wrong error: %', sqlerrm; end if;
  end;

  -- 9. Owning a unit gives the contact the owner role.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u2, c2, 100, '2026-01-01');
    select count(*) into n from contact_roles where contact_id = c2 and role = 'owner';
    if n <> 1 then raise exception 'FAIL 9: owner role not added'; end if;
    raise exception 'PASS 9';
  exception when others then
    if sqlerrm <> 'PASS 9' then raise; end if;
  end;

  -- 10. record_gaps lists a unit without owner and a building whose shares do not total 1000.
  select count(*) into n from record_gaps where entity_id = u1 and gap_code = 'no_owner';
  if n <> 1 then raise exception 'FAIL 10: no_owner gap missing for T-1'; end if;
  select count(*) into n from record_gaps where entity_id = prop and gap_code = 'shares_total';
  if n <> 1 then raise exception 'FAIL 10: shares_total gap missing'; end if;
  update units set common_share = 500 where id in (u1, u2);
  select count(*) into n from record_gaps where entity_id = prop and gap_code = 'shares_total';
  if n <> 0 then raise exception 'FAIL 10: shares_total gap still present at 1000'; end if;

  -- 11. A file targets exactly one of bien/unit.
  begin
    insert into storage.files (id, bucket_id, name) values (gen_random_uuid(), 'property-files', 'x.png')
    returning id into c_org2;
    insert into property_files (organization_id, property_id, unit_id, storage_file_id, kind, title)
    values (org, prop, u1, c_org2, 'photo', 'x');
    raise exception 'FAIL 11: file with two targets accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%property_files_one_target%' then raise exception 'FAIL 11: wrong error: %', sqlerrm; end if;
  end;

  -- 12. An update that pushes a unit above 100 % is refused.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on)
    values (org, u1, c1, 50, '2026-01-01'), (org, u1, c2, 50, '2026-01-01');
    set constraints ownerships_shares_cap immediate;
    update ownerships set share_percent = 60 where unit_id = u1 and contact_id = c1;
    set constraints ownerships_shares_cap immediate;
    raise exception 'FAIL 12: update above 100 %% accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like 'ownership_shares_exceeded:%' then raise exception 'FAIL 12: wrong error: %', sqlerrm; end if;
  end;

  -- 13. Exactly 100 % and back-to-back periods of the same owner are accepted.
  begin
    insert into ownerships (organization_id, unit_id, contact_id, share_percent, starts_on, ends_on)
    values (org, u1, c1, 40, '2026-01-01', '2026-01-31'), (org, u1, c1, 40, '2026-02-01', null), (org, u1, c2, 60, '2026-01-01', null);
    set constraints ownerships_shares_cap immediate;
    raise exception 'PASS 13';
  exception when others then
    if sqlerrm <> 'PASS 13' then raise exception 'FAIL 13: valid ownerships refused: %', sqlerrm; end if;
  end;

  -- 14. A file of another bucket cannot be linked to a bien.
  begin
    insert into storage.files (id, bucket_id, name) values (gen_random_uuid(), 'default', 'autre.png')
    returning id into c_org2;
    insert into property_files (organization_id, property_id, storage_file_id, kind, title)
    values (org, prop, c_org2, 'photo', 'x');
    raise exception 'FAIL 14: file of another bucket accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like 'invalid_storage_file%' then raise exception 'FAIL 14: wrong error: %', sqlerrm; end if;
  end;

  -- 15. The organization's own contact cannot be archived.
  begin
    update contacts set archived_at = now() where organization_id = org and is_organization;
    raise exception 'FAIL 15: self contact archived';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    if sqlerrm not like '%contacts_self_not_archived%' then raise exception 'FAIL 15: wrong error: %', sqlerrm; end if;
  end;

  -- 16. Every house or plot has its unit (back-fill of biens created before 0002).
  select count(*) into n from properties p
  where p.type in ('house', 'plot')
    and not exists (select 1 from units u where u.property_id = p.id and u.archived_at is null);
  if n <> 0 then raise exception 'FAIL 16: % house/plot without unit', n; end if;

  raise exception 'OK: all core-records tests passed';
end $$;
