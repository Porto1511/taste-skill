-- =============================================================================
-- Completion certificates in MSW's own format, and daywork sheets.
-- Neither holds rates or prices: commercial terms stay on the order.
-- =============================================================================

-- Handovers become completion certificates (netting / decking / stud welding).
alter table public.handovers
  add column details jsonb not null default '{}'::jsonb,
  add column days_worked text[] not null default '{}'
    check (days_worked <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  add column week_commencing date,
  add column msw_signature_path text unique;

-- ---------------------------------------------------------------------------
-- Daywork sheets: signed record of extra work / standing time (hours and
-- materials only).  Optional — raised on any job when needed.
-- ---------------------------------------------------------------------------
create table public.dayworks (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null references public.jobs (id) on delete cascade,
  week_commencing        date not null,
  workers                jsonb not null default '[]'::jsonb,
  description            text not null check (length(trim(description)) between 3 and 4000),
  materials              text check (materials is null or length(materials) <= 2000),
  work_complete          boolean not null,
  client_name            text not null check (length(trim(client_name)) between 2 and 120),
  client_position        text check (client_position is null or length(client_position) <= 120),
  client_company         text not null check (length(trim(client_company)) between 2 and 160),
  client_email           text check (client_email is null or length(client_email) <= 200),
  client_signature_path  text not null unique,
  msw_signature_path     text not null unique,
  captured_by            uuid not null references public.profiles (id),
  captured_by_name       text not null,
  captured_by_company    text not null,
  captured_by_company_id uuid not null references public.companies (id),
  signed_at              timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  constraint dayworks_workers check (jsonb_typeof(workers) = 'array' and jsonb_array_length(workers) between 1 and 20)
);
create index dayworks_job_idx on public.dayworks (job_id, signed_at desc);

-- Who can see a daywork sheet: MSW office; the person who raised it while on
-- the job; a subcontractor manager for their own company where MSW granted
-- report visibility on that job.  Other gangs never see each other's sheets.
create or replace function app.can_see_daywork(p_daywork uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.dayworks d
    where d.id = p_daywork
      and (
        app.user_is_staff(auth.uid())
        or (d.captured_by = auth.uid() and app.user_has_job_access(auth.uid(), d.job_id))
        or app.user_can_see_report_row(auth.uid(), d.job_id, null, '00000000-0000-0000-0000-000000000000'::uuid, d.captured_by_company_id, false)
      )
  )
$$;

create or replace function app.dayworks_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.captured_by := auth.uid();
    new.signed_at := now();
    new.created_at := now();
  end if;
  select p.full_name, c.name, c.id into new.captured_by_name, new.captured_by_company, new.captured_by_company_id
  from public.profiles p join public.companies c on c.id = p.company_id where p.id = new.captured_by;
  if new.captured_by_name is null then
    raise exception 'Unknown user' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger dayworks_before_insert before insert on public.dayworks
  for each row execute function app.dayworks_before_insert();

create or replace function app.audit_dayworks()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs;
  v_user uuid;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;
  perform app.write_activity(new.job_id, 'daywork.signed', 'daywork', new.id,
    'Daywork sheet signed by ' || new.client_name || ' (' || new.client_company || '), raised by ' || new.captured_by_name);
  for v_user in select * from app.office_recipients(new.job_id, false) loop
    perform app.notify(v_user, 'daywork.signed', 'Daywork sheet signed on ' || v_job.job_number,
      left(new.description, 120) || ' — ' || new.captured_by_name, '/office/daywork/' || new.id, new.job_id);
  end loop;
  return null;
end;
$$;
create trigger dayworks_audit after insert on public.dayworks
  for each row execute function app.audit_dayworks();

alter table public.dayworks enable row level security;
create policy dayworks_select on public.dayworks for select to authenticated
  using (app.can_see_daywork(id));
create policy dayworks_insert on public.dayworks for insert to authenticated
  with check (captured_by = auth.uid() and app.has_job_access(job_id));
-- Signed sheets are a record: no update or delete through the API.
grant select, insert on public.dayworks to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery notes: what was delivered to site, by whom, signed by the receiver.
-- ---------------------------------------------------------------------------
create table public.deliveries (
  id                       uuid primary key default gen_random_uuid(),
  job_id                   uuid not null references public.jobs (id) on delete cascade,
  items                    jsonb not null,
  delivered_by             text not null check (length(trim(delivered_by)) between 2 and 120),
  vehicle_reg              text check (vehicle_reg is null or length(vehicle_reg) <= 12),
  notes                    text check (notes is null or length(notes) <= 2000),
  receiver_name            text not null check (length(trim(receiver_name)) between 2 and 120),
  receiver_position        text check (receiver_position is null or length(receiver_position) <= 120),
  receiver_company         text not null check (length(trim(receiver_company)) between 2 and 160),
  receiver_email           text check (receiver_email is null or length(receiver_email) <= 200),
  receiver_signature_path  text not null unique,
  driver_signature_path    text not null unique,
  captured_by              uuid not null references public.profiles (id),
  captured_by_name         text not null,
  captured_by_company      text not null,
  captured_by_company_id   uuid not null references public.companies (id),
  signed_at                timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  constraint deliveries_items check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50)
);
create index deliveries_job_idx on public.deliveries (job_id, signed_at desc);

create or replace function app.can_see_delivery(p_delivery uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.deliveries d
    where d.id = p_delivery
      and (
        app.user_is_staff(auth.uid())
        or (d.captured_by = auth.uid() and app.user_has_job_access(auth.uid(), d.job_id))
        or app.user_can_see_report_row(auth.uid(), d.job_id, null, '00000000-0000-0000-0000-000000000000'::uuid, d.captured_by_company_id, false)
      )
  )
$$;

create trigger deliveries_before_insert before insert on public.deliveries
  for each row execute function app.dayworks_before_insert();

create or replace function app.audit_deliveries()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs;
  v_user uuid;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;
  perform app.write_activity(new.job_id, 'delivery.signed', 'delivery', new.id,
    'Delivery by ' || new.delivered_by || ' received and signed by ' || new.receiver_name || ' (' || new.receiver_company || ')');
  for v_user in select * from app.office_recipients(new.job_id, false) loop
    perform app.notify(v_user, 'delivery.signed', 'Delivery signed for on ' || v_job.job_number,
      jsonb_array_length(new.items) || ' item(s), delivered by ' || new.delivered_by || ', received by ' || new.receiver_name,
      '/office/deliveries/' || new.id, new.job_id);
  end loop;
  return null;
end;
$$;
create trigger deliveries_audit after insert on public.deliveries
  for each row execute function app.audit_deliveries();

alter table public.deliveries enable row level security;
create policy deliveries_select on public.deliveries for select to authenticated
  using (app.can_see_delivery(id));
create policy deliveries_insert on public.deliveries for insert to authenticated
  with check (captured_by = auth.uid() and app.has_job_access(job_id));
grant select, insert on public.deliveries to authenticated;

-- Storage read policy covers MSW signatures and daywork signatures too.
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
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text)
to authenticated;
