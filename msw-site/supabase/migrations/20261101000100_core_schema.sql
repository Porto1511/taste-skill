-- =============================================================================
-- MSW Site — core schema
-- Operational information only. This schema deliberately contains NO
-- commercial data (orders, rates, values, invoices or purchasing).
-- =============================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'admin',      -- MSW administrator: full control including access permissions
  'office',     -- MSW office staff: jobs, documents and reports; cannot change access
  'operative',  -- MSW direct or subcontractor operative
  'manager'     -- Subcontractor owner/manager: sees only what MSW explicitly grants
);

create type public.job_status as enum ('planned', 'live', 'on_hold', 'complete');
create type public.area_kind as enum ('floor', 'phase', 'zone', 'area');
create type public.document_kind as enum ('drawing', 'rams');
create type public.revision_status as enum ('draft', 'approved', 'superseded', 'withdrawn');
create type public.report_kind as enum ('issue', 'progress', 'photo');
create type public.issue_category as enum (
  'delay', 'access', 'edge_protection', 'materials', 'drawing_query', 'safety', 'other'
);
create type public.report_priority as enum ('normal', 'high', 'urgent');
create type public.report_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- Request context helpers
--   app.is_api_context(): true when the statement runs under an API role
--     (the app's per-user transactions and Supabase's REST API both
--     SET ROLE authenticated/anon).  Triggers then force server-generated
--     timestamps and authorship.  Trusted maintenance connections (seeding,
--     migrations) are not API context.
--   app.now(): the server clock for API calls; trusted maintenance
--     connections may supply msw.activity_time to backdate seeded history.
-- ---------------------------------------------------------------------------
create or replace function app.is_api_context()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
$$;

create or replace function app.now()
returns timestamptz
language sql stable set search_path = ''
as $$
  select case
    when app.is_api_context() then now()
    else coalesce(nullif(current_setting('msw.activity_time', true), '')::timestamptz, now())
  end
$$;

-- ---------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := app.now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Companies (MSW itself plus subcontractors)
-- ---------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 2 and 120),
  is_msw        boolean not null default false,
  trade         text check (trade is null or length(trade) <= 120),
  contact_name  text check (contact_name is null or length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 40),
  contact_email text check (contact_email is null or length(contact_email) <= 200),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index companies_name_key on public.companies (lower(name));
create unique index companies_single_msw on public.companies (is_msw) where is_msw;
create trigger companies_touch before update on public.companies
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles: one per authenticated user (auth.users is managed by Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  company_id      uuid not null references public.companies (id),
  full_name       text not null check (length(trim(full_name)) between 2 and 120),
  email           text not null check (position('@' in email) > 1 and length(email) <= 200),
  phone           text check (phone is null or length(phone) <= 40),
  job_title       text check (job_title is null or length(job_title) <= 120),
  role            public.app_role not null default 'operative',
  active          boolean not null default true,
  invited_at      timestamptz,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_company_idx on public.profiles (company_id);
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- MSW office roles may only be held by members of the MSW company.
create or replace function app.enforce_profile_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_msw boolean;
begin
  select c.is_msw into v_is_msw from public.companies c where c.id = new.company_id;
  if new.role in ('admin', 'office') and not coalesce(v_is_msw, false) then
    raise exception 'Only MSW employees can hold office roles'
      using errcode = 'check_violation';
  end if;
  new.email := lower(trim(new.email));
  return new;
end;
$$;
create trigger profiles_rules before insert or update on public.profiles
  for each row execute function app.enforce_profile_rules();

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  job_number          text not null check (length(trim(job_number)) between 2 and 40),
  name                text not null check (length(trim(name)) between 2 and 160),
  site_address        text not null check (length(site_address) <= 400),
  postcode            text check (postcode is null or length(postcode) <= 12),
  what3words          text check (what3words is null or length(what3words) <= 80),
  directions          text check (directions is null or length(directions) <= 2000),
  main_contractor     text check (main_contractor is null or length(main_contractor) <= 160),
  site_contact_name   text check (site_contact_name is null or length(site_contact_name) <= 120),
  site_contact_role   text check (site_contact_role is null or length(site_contact_role) <= 120),
  site_contact_phone  text check (site_contact_phone is null or length(site_contact_phone) <= 40),
  start_date          date,
  end_date            date,
  induction_url       text check (induction_url is null or induction_url ~* '^https?://'),
  induction_notes     text check (induction_notes is null or length(induction_notes) <= 2000),
  site_instructions   text check (site_instructions is null or length(site_instructions) <= 8000),
  status              public.job_status not null default 'planned',
  contracts_manager_id uuid references public.profiles (id),
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint jobs_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index jobs_number_key on public.jobs (upper(job_number));
create index jobs_status_idx on public.jobs (status);
create trigger jobs_touch before update on public.jobs
  for each row execute function app.touch_updated_at();

-- Floors, phases and work areas within a job
create table public.job_areas (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  kind        public.area_kind not null default 'floor',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index job_areas_name_key on public.job_areas (job_id, lower(name));
create index job_areas_job_idx on public.job_areas (job_id, sort_order);

-- ---------------------------------------------------------------------------
-- Individual user-to-job access.  Company membership NEVER grants access.
-- A revoked assignment is retained for audit; re-granting creates a new row.
-- ---------------------------------------------------------------------------
create table public.job_assignments (
  id                        uuid primary key default gen_random_uuid(),
  job_id                    uuid not null references public.jobs (id) on delete cascade,
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  all_areas                 boolean not null default false,
  attendance_from           date,
  attendance_to             date,
  note                      text check (note is null or length(note) <= 300),
  -- Only meaningful for subcontractor managers: see reports raised by their
  -- own company's operatives on THIS job.  Never implied, always explicit.
  can_view_company_reports  boolean not null default false,
  granted_by                uuid references public.profiles (id),
  granted_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  revoked_at                timestamptz,
  revoked_by                uuid references public.profiles (id),
  constraint job_assignments_dates
    check (attendance_to is null or attendance_from is null or attendance_to >= attendance_from)
);
create unique index job_assignments_active_key
  on public.job_assignments (job_id, user_id) where revoked_at is null;
create index job_assignments_user_idx on public.job_assignments (user_id) where revoked_at is null;
create trigger job_assignments_touch before update on public.job_assignments
  for each row execute function app.touch_updated_at();

create table public.assignment_areas (
  assignment_id uuid not null references public.job_assignments (id) on delete cascade,
  -- NO ACTION (not cascade): deleting an area in use must fail rather than
  -- silently widening access.
  area_id       uuid not null references public.job_areas (id),
  primary key (assignment_id, area_id)
);
create index assignment_areas_area_idx on public.assignment_areas (area_id);

create or replace function app.enforce_assignment_area_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.job_assignments a
    join public.job_areas ar on ar.job_id = a.job_id
    where a.id = new.assignment_id and ar.id = new.area_id
  ) then
    raise exception 'Area does not belong to the assignment''s job'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger assignment_areas_job before insert or update on public.assignment_areas
  for each row execute function app.enforce_assignment_area_job();

-- ---------------------------------------------------------------------------
-- Documents (drawings and RAMS) and their revisions
-- ---------------------------------------------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  kind         public.document_kind not null,
  doc_number   text not null check (length(trim(doc_number)) between 1 and 60),
  title        text not null check (length(trim(title)) between 2 and 200),
  description  text check (description is null or length(description) <= 1000),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index documents_number_key on public.documents (job_id, kind, upper(doc_number));
create index documents_job_idx on public.documents (job_id, kind);
create trigger documents_touch before update on public.documents
  for each row execute function app.touch_updated_at();

-- A document with no rows here applies to the whole job.
create table public.document_areas (
  document_id uuid not null references public.documents (id) on delete cascade,
  -- NO ACTION (not cascade): removing an area from a document must be explicit,
  -- otherwise an area-restricted drawing would become visible job-wide.
  area_id     uuid not null references public.job_areas (id),
  primary key (document_id, area_id)
);
create index document_areas_area_idx on public.document_areas (area_id);

create or replace function app.enforce_document_area_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.documents d
    join public.job_areas ar on ar.job_id = d.job_id
    where d.id = new.document_id and ar.id = new.area_id
  ) then
    raise exception 'Area does not belong to the document''s job'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger document_areas_job before insert or update on public.document_areas
  for each row execute function app.enforce_document_area_job();

create table public.document_revisions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents (id) on delete cascade,
  revision      text not null check (length(trim(revision)) between 1 and 12),
  status        public.revision_status not null default 'draft',
  change_note   text check (change_note is null or length(change_note) <= 1000),
  storage_path  text not null unique,
  file_name     text not null check (length(file_name) <= 255),
  file_size     bigint not null check (file_size > 0),
  mime_type     text not null default 'application/pdf',
  sha256        text,
  uploaded_by   uuid references public.profiles (id),
  uploaded_at   timestamptz not null default now(),
  approved_by   uuid references public.profiles (id),
  approved_at   timestamptz,
  superseded_at timestamptz,
  withdrawn_at  timestamptz
);
create unique index document_revisions_rev_key on public.document_revisions (document_id, upper(revision));
-- At most ONE approved-for-use revision per document at any time.
create unique index document_revisions_one_approved
  on public.document_revisions (document_id) where status = 'approved';
create index document_revisions_doc_idx on public.document_revisions (document_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Site reports: issues, progress updates and photo uploads
-- ---------------------------------------------------------------------------
create table public.reports (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null references public.jobs (id) on delete cascade,
  area_id              uuid references public.job_areas (id),
  kind                 public.report_kind not null,
  category             public.issue_category,
  priority             public.report_priority not null default 'normal',
  title                text not null check (length(trim(title)) between 3 and 160),
  description          text check (description is null or length(description) <= 4000),
  status               public.report_status,
  shared_with_team     boolean not null default false,
  author_id            uuid not null references public.profiles (id),
  author_name          text not null,
  author_company_id    uuid not null references public.companies (id),
  author_company_name  text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  constraint reports_issue_shape check (
    (kind = 'issue' and category is not null and status is not null)
    or (kind <> 'issue' and status is null)
  )
);
create index reports_job_idx on public.reports (job_id, created_at desc);
create index reports_author_idx on public.reports (author_id, created_at desc);
create index reports_open_idx on public.reports (status) where status in ('open', 'in_progress');

create table public.report_photos (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports (id) on delete cascade,
  storage_path text not null unique,
  caption      text check (caption is null or length(caption) <= 300),
  mime_type    text not null default 'image/jpeg',
  file_size    bigint not null check (file_size > 0),
  width        integer,
  height       integer,
  uploaded_by  uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index report_photos_report_idx on public.report_photos (report_id);

create table public.report_responses (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports (id) on delete cascade,
  author_id    uuid not null references public.profiles (id),
  author_name  text not null,
  from_office  boolean not null default false,
  body         text check (body is null or length(body) <= 4000),
  status_from  public.report_status,
  status_to    public.report_status,
  created_at   timestamptz not null default now(),
  constraint report_responses_content check (body is not null or status_to is not null)
);
create index report_responses_report_idx on public.report_responses (report_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications (per user) and append-only activity history
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  href        text,
  job_id      uuid references public.jobs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.activity_log (
  id           bigint generated always as identity primary key,
  job_id       uuid references public.jobs (id) on delete set null,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_name   text,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text not null,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index activity_log_job_idx on public.activity_log (job_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_id, action);
create index activity_log_created_idx on public.activity_log (created_at desc);
