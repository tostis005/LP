-- Miniatura de esquemas gestionados por Supabase para ejecutar las migraciones
-- contra PostgreSQL real en CI. No sustituye la prueba final en Supabase.
create role authenticated nologin;
create role anon nologin;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists test;
create table auth.users(
 id uuid primary key,
 email text not null unique,
 email_confirmed_at timestamptz,
 raw_user_meta_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
 select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))
$$;
create table storage.buckets(
 id text primary key,
 name text not null,
 public boolean not null default false,
 file_size_limit bigint,
 allowed_mime_types text[]
);
create table storage.objects(
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null references storage.buckets(id),
 name text not null
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(p_name text)
 returns text[] language sql immutable as $$select string_to_array(p_name,'/')$$;
create or replace function test.assert(p_pass boolean,p_label text)
returns void language plpgsql as $$
begin
 if not coalesce(p_pass,false) then raise exception 'FAIL: %',p_label; end if;
 raise notice 'PASS: %',p_label;
end; $$;
create or replace function test.expect_error(p_sql text,p_message text)
returns void language plpgsql as $$
begin
 execute p_sql;
 raise exception 'TEST_NO_ERROR: %',p_sql;
exception when others then
 if sqlerrm like 'TEST_NO_ERROR:%' then raise; end if;
 if position(lower(p_message) in lower(sqlerrm))=0 then
   raise exception 'Expected error containing "%", got "%"',p_message,sqlerrm;
 end if;
 raise notice 'PASS: expected error (%)',p_message;
end; $$;
