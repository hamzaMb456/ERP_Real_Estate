-- 0013_storage_ownership: file storage moved from the old cloud storage to Floci/S3 (web/src/lib/storage.ts).
-- property_files_check_storage / lease_files_check_storage (0002, 0003) validated every linked
-- storage_file_id against the old storage.files table (uploader + bucket), which is how a
-- guessed/leaked file id was stopped from being linked into another organization's records. Files
-- no longer go through the old cloud storage, so storage.files never gets a row for them — replace that
-- check with our own tracking table, written by the Next.js server (admin-secret authenticated,
-- see web/src/app/api/storage/upload/route.ts) at upload time.
-- Apply after 0012. Run with the legacy console SQL editor (same workflow as every prior migration).

create table public.app_storage_files (
  id                 uuid primary key,
  bucket             text not null check (bucket in ('property-files', 'lease-files')),
  uploaded_by_user_id uuid not null,
  created_at         timestamptz not null default now()
);
-- Never exposed over GraphQL to any role (not added to the permissions script's TRACK list
-- with any role permissions) — only the trigger functions below and the admin-secret upload route
-- touch it.

-- storage_file_id also carried an actual foreign key to storage.files (0002/0003), not only the
-- trigger check below — repoint both at app_storage_files, keeping the same on-delete-cascade
-- behaviour (deleting the app_storage_files row — see the delete route's cleanup — now cascades to
-- remove the property_files/lease_files row that linked it, closing a gap neither this migration nor
-- the storage it replaces used to close: that link row was never cleaned up before).
-- NOT VALID: rows uploaded before this migration reference real legacy storage.files entries that
-- app_storage_files has no row for (and never will, short of a separate data-copy migration), so a
-- validating ALTER would fail outright on existing data. NOT VALID only enforces the FK going
-- forward (new inserts/updates of storage_file_id); it never re-checks rows already in the table,
-- matching the trigger below, which likewise only fires on insert/update. Old file records are left
-- exactly as they already were: nothing here makes pre-migration files more or less reachable — that
-- was already broken by moving storage.ts off the old cloud storage, which is a known, separate gap (the
-- file bytes themselves are not in Floci), not something this constraint controls.
alter table public.property_files drop constraint property_files_storage_file_id_fkey;
alter table public.property_files add constraint property_files_storage_file_id_fkey
  foreign key (storage_file_id) references public.app_storage_files (id) on delete cascade not valid;
alter table public.lease_files drop constraint lease_files_storage_file_id_fkey;
alter table public.lease_files add constraint lease_files_storage_file_id_fkey
  foreign key (storage_file_id) references public.app_storage_files (id) on delete cascade not valid;

create or replace function public.check_property_file_storage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id';
begin
  if not exists (
    select 1 from public.app_storage_files f
    where f.id = new.storage_file_id
      and f.bucket = 'property-files'
      and (v_user is null or f.uploaded_by_user_id::text = v_user)
  ) then
    raise exception 'invalid_storage_file' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.check_lease_file_storage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id';
begin
  if not exists (
    select 1 from public.app_storage_files f
    where f.id = new.storage_file_id
      and f.bucket = 'lease-files'
      and (v_user is null or f.uploaded_by_user_id::text = v_user)
  ) then
    raise exception 'invalid_storage_file' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Triggers themselves (created in 0002/0003) are unchanged — only the function bodies moved
-- from storage.files to app_storage_files.
