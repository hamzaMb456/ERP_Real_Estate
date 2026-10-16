-- Local stand-ins for the Nhost schemas that our migrations reference. Never applied to Nhost.
create schema if not exists auth;
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  display_name  text not null default '',
  default_role  text not null default 'user',
  metadata      jsonb not null default '{}'::jsonb,
  disabled      boolean not null default false,
  created_at    timestamptz not null default now()
);
-- Nhost keeps every role a user may take (the JWT allowed roles) here.
create table if not exists auth.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create schema if not exists storage;
create table if not exists storage.buckets (
  id                     text primary key,
  max_upload_file_size   integer,
  min_upload_file_size   integer,
  presigned_urls_enabled boolean,
  download_expiration    integer,
  cache_control          text
);
-- Nhost always has a "default" bucket.
insert into storage.buckets (id) values ('default') on conflict (id) do nothing;
create table if not exists storage.files (
  id                  uuid primary key default gen_random_uuid(),
  bucket_id           text references storage.buckets (id),
  name                text,
  size                integer,
  mime_type           text,
  etag                text,
  is_uploaded         boolean default true,
  uploaded_by_user_id uuid,
  metadata            jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
