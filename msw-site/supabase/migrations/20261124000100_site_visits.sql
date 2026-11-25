-- =============================================================================
-- Site visits (office only): what's ready, access & safety checklist,
-- blockers, photos and the outcome.  Only MSW office staff create or see them.
-- =============================================================================
create table public.site_visits (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references public.jobs (id) on delete set null,
  job_number      text not null check (length(trim(job_number)) between 1 and 40),
  job_name        text check (job_name is null or length(job_name) <= 160),
  site_address    text not null check (length(trim(site_address)) between 3 and 300),
  visit_date      date not null,
  visit_type      text not null check (visit_type in ('pre_start', 'progress', 'snagging')),
  met_name        text check (met_name is null or length(met_name) <= 120),
  met_phone       text check (met_phone is null or length(met_phone) <= 40),
  areas           jsonb not null default '[]'::jsonb check (jsonb_typeof(areas) = 'array' and jsonb_array_length(areas) <= 40),
  checklist       jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  blockers        jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array' and jsonb_array_length(blockers) <= 40),
  ready           text not null check (ready in ('yes', 'conditional', 'no')),
  conditions      text check (conditions is null or length(conditions) <= 2000),
  proposed_start  date,
  men_needed      text check (men_needed is null or length(men_needed) <= 200),
  plant_needed    text check (plant_needed is null or length(plant_needed) <= 500),
  actions         jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 40),
  notes           text check (notes is null or length(notes) <= 4000),
  visited_by      uuid not null references public.profiles (id),
  visited_by_name text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index site_visits_date_idx on public.site_visits (visit_date desc);
create index site_visits_job_idx on public.site_visits (job_id, visit_date desc);

create table public.site_visit_photos (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.site_visits (id) on delete cascade,
  storage_path  text not null unique,
  caption       text check (caption is null or length(caption) <= 300),
  file_size     integer not null,
  width         integer not null,
  height        integer not null,
  created_at    timestamptz not null default now()
);
create index site_visit_photos_visit_idx on public.site_visit_photos (visit_id);

create or replace function app.site_visits_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
begin
  if tg_op = 'INSERT' and app.is_api_context() then
    new.visited_by := auth.uid();
    new.created_at := now();
  end if;
  new.updated_at := now();
  select p.full_name into new.visited_by_name from public.profiles p where p.id = new.visited_by;
  -- A typed job number we already know links the visit to that job.
  if new.job_id is null then
    select * into j from public.jobs where lower(job_number) = lower(trim(new.job_number)) limit 1;
    new.job_id := j.id;
  end if;
  return new;
end;
$$;
create trigger site_visits_before_write before insert or update on public.site_visits
  for each row execute function app.site_visits_before_write();

create or replace function app.audit_site_visits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.write_activity(new.job_id, 'site_visit.recorded', 'site_visit', new.id,
    'Site visit to ' || new.job_number || ' by ' || new.visited_by_name || ' — ' ||
    case new.ready when 'yes' then 'ready to start' when 'conditional' then 'ready with conditions' else 'not ready yet' end);
  return null;
end;
$$;
create trigger site_visits_audit after insert on public.site_visits
  for each row execute function app.audit_site_visits();

alter table public.site_visits enable row level security;
alter table public.site_visit_photos enable row level security;
create policy site_visits_staff on public.site_visits for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy site_visit_photos_staff on public.site_visit_photos for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
grant select, insert, update, delete on public.site_visits, public.site_visit_photos to authenticated;

create or replace function app.can_read_storage_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.document_revisions r
            where r.storage_path = p_name and app.user_can_see_revision(auth.uid(), r.id))
    or exists (select 1 from public.report_photos ph
               where ph.storage_path = p_name and app.user_can_see_report(auth.uid(), ph.report_id))
    or exists (select 1 from public.handovers h
               where (h.signature_path = p_name or h.msw_signature_path = p_name) and app.can_see_handover(h.id))
    or exists (select 1 from public.handover_photos hp where hp.storage_path = p_name and app.can_see_handover(hp.handover_id))
    or exists (select 1 from public.dayworks d
               where (d.client_signature_path = p_name or d.msw_signature_path = p_name) and app.can_see_daywork(d.id))
    or exists (select 1 from public.deliveries v
               where (v.receiver_signature_path = p_name or v.driver_signature_path = p_name) and app.can_see_delivery(v.id))
    or exists (select 1 from public.company_certificates c
               where c.storage_path = p_name and app.can_manage_certificates(c.company_id))
    or exists (select 1 from public.site_visit_photos sp where sp.storage_path = p_name and app.user_is_staff(auth.uid()))
  )
$$;
