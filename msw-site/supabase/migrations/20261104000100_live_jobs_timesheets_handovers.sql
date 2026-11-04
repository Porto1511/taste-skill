-- =============================================================================
-- MSW Site — operatives see live jobs only; daily timesheets for MSW
-- operatives; contractor handover sign-off.
-- No pay rates or other commercial data: timesheets record hours only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Outside the office, only LIVE jobs are accessible (planned, on-hold and
--    completed jobs disappear from site users entirely, including files).
-- ---------------------------------------------------------------------------
create or replace function app.user_job_assignment(p_user uuid, p_job uuid)
returns public.job_assignments
language sql stable security definer set search_path = ''
as $$
  select a.*
  from public.job_assignments a
  join public.profiles p on p.id = a.user_id
  join public.jobs j on j.id = a.job_id and j.status = 'live'
  where a.job_id = p_job
    and a.user_id = p_user
    and a.revoked_at is null
    and p.active
  limit 1
$$;

create or replace function app.user_has_area_access(p_user uuid, p_job uuid, p_area uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    or exists (
      select 1
      from public.job_assignments a
      join public.profiles p on p.id = a.user_id
      join public.jobs j on j.id = a.job_id and j.status = 'live'
      join public.job_areas ar on ar.id = p_area and ar.job_id = a.job_id
      where a.job_id = p_job
        and a.user_id = p_user
        and a.revoked_at is null
        and p.active
        and (
          a.all_areas
          or exists (
            select 1 from public.assignment_areas aa
            where aa.assignment_id = a.id and aa.area_id = p_area
          )
        )
    )
  )
$$;

create or replace function app.user_can_see_report_row(
  p_user uuid, p_job uuid, p_area uuid, p_author uuid, p_author_company uuid, p_shared boolean
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    or (p_author = p_user and app.user_has_job_access(p_user, p_job))
    or (
      p_shared
      and app.user_has_job_access(p_user, p_job)
      and (p_area is null or app.user_has_area_access(p_user, p_job, p_area))
    )
    or (
      app.user_has_job_access(p_user, p_job)
      and exists (
        select 1
        from public.job_assignments a
        join public.profiles p on p.id = a.user_id
        where a.job_id = p_job
          and a.user_id = p_user
          and a.revoked_at is null
          and a.can_view_company_reports
          and p.active
          and p.role = 'manager'
          and p.company_id = p_author_company
      )
    )
  )
$$;

-- Tell the people allocated to a job when it goes live.
create or replace function app.notify_job_live()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if new.status = 'live' and old.status is distinct from 'live' then
    for v_user in select * from app.job_audience(new.id) loop
      perform app.notify(v_user, 'job.live', new.job_number || ' is now live',
        new.name || ' — drawings, RAMS and site information are now available.', '/jobs/' || new.id, new.id);
    end loop;
  end if;
  return null;
end;
$$;
create trigger jobs_notify_live after update on public.jobs
  for each row execute function app.notify_job_live();

-- ---------------------------------------------------------------------------
-- 2. Daily timesheets (MSW's own operatives)
-- ---------------------------------------------------------------------------
create type public.timesheet_status as enum ('submitted', 'approved', 'query');

create or replace function app.minutes_between(p_start time, p_end time)
returns integer
language sql immutable set search_path = ''
as $$
  select case
    when p_start is null or p_end is null then 0
    when p_end >= p_start then (extract(epoch from (p_end - p_start)) / 60)::int
    else (extract(epoch from (p_end - p_start + interval '24 hours')) / 60)::int  -- past midnight
  end
$$;

create table public.timesheets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  work_date          date not null,
  job_id             uuid references public.jobs (id) on delete set null,
  location_note      text check (location_note is null or length(location_note) <= 200),
  vehicle_reg        text check (vehicle_reg is null or length(vehicle_reg) <= 12),
  travel_mode        text not null default 'driver' check (travel_mode in ('driver', 'passenger', 'none')),
  travel_out_start   time,
  travel_out_end     time,
  site_start         time,
  site_finish        time,
  break_minutes      integer not null default 0 check (break_minutes between 0 and 300),
  travel_back_start  time,
  travel_back_end    time,
  mileage            integer check (mileage is null or mileage between 0 and 2000),
  notes              text check (notes is null or length(notes) <= 1000),
  status             public.timesheet_status not null default 'submitted',
  office_note        text check (office_note is null or length(office_note) <= 500),
  reviewed_by        uuid references public.profiles (id),
  reviewed_at        timestamptz,
  travel_minutes     integer generated always as (
    app.minutes_between(travel_out_start, travel_out_end) + app.minutes_between(travel_back_start, travel_back_end)
  ) stored,
  driving_minutes    integer generated always as (
    case when travel_mode = 'driver'
      then app.minutes_between(travel_out_start, travel_out_end) + app.minutes_between(travel_back_start, travel_back_end)
      else 0 end
  ) stored,
  site_minutes       integer generated always as (
    greatest(app.minutes_between(site_start, site_finish) - break_minutes, 0)
  ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint timesheets_one_per_day unique (user_id, work_date),
  constraint timesheets_pairs check (
    (travel_out_start is null) = (travel_out_end is null)
    and (site_start is null) = (site_finish is null)
    and (travel_back_start is null) = (travel_back_end is null)
  ),
  constraint timesheets_something check (site_start is not null or travel_out_start is not null or travel_back_start is not null),
  constraint timesheets_not_future check (work_date <= current_date + 1)
);
create index timesheets_date_idx on public.timesheets (work_date);

-- Only active MSW operatives keep timesheets.
create or replace function app.can_keep_timesheet()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p join public.companies c on c.id = p.company_id
    where p.id = auth.uid() and p.active and c.is_msw and p.role = 'operative'
  )
$$;

create or replace function app.timesheets_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.timesheet_status;
  v_note text;
begin
  if not app.is_api_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := v_uid;
    new.status := 'submitted';
    new.office_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if v_uid = old.user_id and not app.user_is_staff(v_uid) then
    -- The operative edits their own day; any change goes back to the office.
    new.user_id := old.user_id;
    new.work_date := old.work_date;
    new.status := 'submitted';
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.office_note := old.office_note;
    new.created_at := old.created_at;
    new.updated_at := now();
    return new;
  end if;
  -- MSW office: may only review (status + note); recorded hours are untouched.
  v_status := new.status;
  v_note := new.office_note;
  new := old;
  new.status := v_status;
  new.office_note := v_note;
  new.reviewed_by := v_uid;
  new.reviewed_at := now();
  new.updated_at := now();
  return new;
end;
$$;
create trigger timesheets_guard before insert or update on public.timesheets
  for each row execute function app.timesheets_guard();

create or replace function app.audit_timesheets()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_day text;
begin
  if new.status is not distinct from old.status or new.status = 'submitted' then
    return null;
  end if;
  select p.full_name into v_name from public.profiles p where p.id = new.user_id;
  v_day := to_char(new.work_date, 'Dy DD Mon');
  perform app.write_activity(new.job_id, 'timesheet.' || new.status, 'timesheet', new.id,
    'Timesheet for ' || v_name || ' (' || v_day || ') ' || case when new.status = 'approved' then 'approved' else 'queried' end);
  perform app.notify(new.user_id, 'timesheet.' || new.status,
    case when new.status = 'approved' then 'Timesheet approved: ' || v_day else 'Timesheet query: ' || v_day end,
    coalesce(new.office_note, case when new.status = 'approved' then 'No action needed.' else 'Please check and resubmit.' end),
    '/timesheet/' || new.work_date, new.job_id);
  return null;
end;
$$;
create trigger timesheets_audit after update on public.timesheets
  for each row execute function app.audit_timesheets();

alter table public.timesheets enable row level security;
create policy timesheets_select on public.timesheets for select to authenticated
  using (user_id = auth.uid() or app.is_staff());
create policy timesheets_insert on public.timesheets for insert to authenticated
  with check (
    user_id = auth.uid() and app.can_keep_timesheet()
    and (job_id is null or app.has_job_access(job_id))
  );
create policy timesheets_update_own on public.timesheets for update to authenticated
  using (user_id = auth.uid() and status <> 'approved' and app.can_keep_timesheet())
  with check (user_id = auth.uid() and (job_id is null or app.has_job_access(job_id)));
create policy timesheets_review on public.timesheets for update to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy timesheets_delete_own on public.timesheets for delete to authenticated
  using (user_id = auth.uid() and status <> 'approved');
grant select, insert, update, delete on public.timesheets to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Handover sign-off: the main contractor signs off MSW's completed works
-- ---------------------------------------------------------------------------
create table public.handovers (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null references public.jobs (id) on delete cascade,
  area_id              uuid references public.job_areas (id),
  title                text not null check (length(trim(title)) between 3 and 160),
  scope                text check (scope is null or length(scope) <= 4000),
  checklist            jsonb not null default '[]'::jsonb,
  drawing_refs         jsonb not null default '[]'::jsonb,
  signer_name          text not null check (length(trim(signer_name)) between 2 and 120),
  signer_company       text not null check (length(trim(signer_company)) between 2 and 160),
  signer_position      text check (signer_position is null or length(signer_position) <= 120),
  signer_email         text check (signer_email is null or length(signer_email) <= 200),
  declaration          text not null,
  signature_path       text not null unique,
  captured_by          uuid not null references public.profiles (id),
  captured_by_name     text not null,
  captured_by_company  text not null,
  signed_at            timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create index handovers_job_idx on public.handovers (job_id, signed_at desc);

create table public.handover_photos (
  id            uuid primary key default gen_random_uuid(),
  handover_id   uuid not null references public.handovers (id) on delete cascade,
  storage_path  text not null unique,
  caption       text check (caption is null or length(caption) <= 300),
  file_size     bigint not null check (file_size > 0),
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);
create index handover_photos_idx on public.handover_photos (handover_id);

create or replace function app.can_see_handover(p_handover uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.handovers h
    where h.id = p_handover
      and (
        app.user_is_staff(auth.uid())
        or (app.user_has_job_access(auth.uid(), h.job_id)
            and (h.area_id is null or app.user_has_area_access(auth.uid(), h.job_id, h.area_id)))
      )
  )
$$;

create or replace function app.handovers_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.captured_by := auth.uid();
    new.signed_at := now();
    new.created_at := now();
  end if;
  select p.full_name, c.name into new.captured_by_name, new.captured_by_company
  from public.profiles p join public.companies c on c.id = p.company_id where p.id = new.captured_by;
  if new.captured_by_name is null then
    raise exception 'Unknown user' using errcode = 'foreign_key_violation';
  end if;
  -- Record, server-side, which drawings were current for this area when it was signed.
  select coalesce(jsonb_agg(jsonb_build_object('doc_number', d.doc_number, 'title', d.title, 'revision', r.revision)
                            order by d.doc_number), '[]'::jsonb)
    into new.drawing_refs
  from public.documents d
  join public.document_revisions r on r.document_id = d.id and r.status = 'approved'
  where d.job_id = new.job_id and d.kind = 'drawing'
    and (
      not exists (select 1 from public.document_areas da where da.document_id = d.id)
      or new.area_id is null
      or exists (select 1 from public.document_areas da where da.document_id = d.id and da.area_id = new.area_id)
    );
  return new;
end;
$$;
create trigger handovers_before_insert before insert on public.handovers
  for each row execute function app.handovers_before_insert();

create or replace function app.audit_handovers()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs;
  v_user uuid;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;
  perform app.write_activity(new.job_id, 'handover.signed', 'handover', new.id,
    'Handover "' || new.title || '" signed by ' || new.signer_name || ' (' || new.signer_company || ')',
    jsonb_build_object('captured_by', new.captured_by_name));
  for v_user in select * from app.office_recipients(new.job_id, false) loop
    perform app.notify(v_user, 'handover.signed', 'Handover signed on ' || v_job.job_number || ': ' || new.title,
      new.signer_name || ', ' || new.signer_company || ' — captured by ' || new.captured_by_name,
      '/office/handovers/' || new.id, new.job_id);
  end loop;
  return null;
end;
$$;
create trigger handovers_audit after insert on public.handovers
  for each row execute function app.audit_handovers();

alter table public.handovers enable row level security;
alter table public.handover_photos enable row level security;
create policy handovers_select on public.handovers for select to authenticated
  using (app.can_see_handover(id));
create policy handovers_insert on public.handovers for insert to authenticated
  with check (
    captured_by = auth.uid()
    and app.has_job_access(job_id)
    and (area_id is null or app.has_area_access(job_id, area_id))
  );
create policy handover_photos_select on public.handover_photos for select to authenticated
  using (app.can_see_handover(handover_id));
create policy handover_photos_insert on public.handover_photos for insert to authenticated
  with check (exists (select 1 from public.handovers h where h.id = handover_id and h.captured_by = auth.uid()));
-- Signed handovers are a record: no update or delete for anyone through the API.
grant select, insert on public.handovers, public.handover_photos to authenticated;

-- Supabase Storage read policy also covers handover photos and signatures.
create or replace function app.can_read_storage_object(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.document_revisions r
            where r.storage_path = p_name and app.user_can_see_revision(auth.uid(), r.id))
    or exists (select 1 from public.report_photos ph
               where ph.storage_path = p_name and app.user_can_see_report(auth.uid(), ph.report_id))
    or exists (select 1 from public.handovers h where h.signature_path = p_name and app.can_see_handover(h.id))
    or exists (select 1 from public.handover_photos hp where hp.storage_path = p_name and app.can_see_handover(hp.handover_id))
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid),
  app.can_read_storage_object(text)
to authenticated;
