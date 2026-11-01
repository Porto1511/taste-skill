-- =============================================================================
-- LOCAL DEMONSTRATION ONLY.
-- Emulates the parts of Supabase that the migrations depend on, so the exact
-- same schema, RLS policies and triggers run inside embedded Postgres (PGlite).
-- Never apply this file to a real Supabase project.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit;
  end if;
  -- The connecting role must be able to SET ROLE authenticated (needed on
  -- hosted Postgres where the app does not connect as a superuser).
  -- PostgreSQL 16+ separates membership from the SET option, so check and
  -- grant SET explicitly; superusers (e.g. PGlite) can always SET ROLE.
  if not (select rolsuper from pg_roles where rolname = current_user) then
    if current_setting('server_version_num')::int >= 160000 then
      if not pg_has_role(current_user, 'authenticated', 'SET') then
        execute format('grant authenticated to %I with set true, inherit false', current_user);
      end if;
      if not pg_has_role(current_user, 'anon', 'SET') then
        execute format('grant anon to %I with set true, inherit false', current_user);
      end if;
    elsif not pg_has_role(current_user, 'authenticated', 'MEMBER') then
      execute format('grant authenticated, anon to %I', current_user);
    end if;
  end if;
end
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

-- Same definition Supabase uses: the subject claim of the request JWT.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Local credential and session store (demo mode only; no API role access).
create schema if not exists local_auth;
revoke all on schema local_auth from public;

create table if not exists local_auth.credentials (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

create table if not exists local_auth.sessions (
  token_hash  text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on local_auth.sessions (user_id);

-- Hosted demo only: private file bytes kept in the database (no persistent disk).
create table if not exists local_auth.files (
  path        text primary key,
  content     bytea not null,
  created_at  timestamptz not null default now()
);
