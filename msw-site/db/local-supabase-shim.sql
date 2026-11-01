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
    create role service_role nologin noinherit bypassrls;
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
