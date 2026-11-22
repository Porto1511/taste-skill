-- =============================================================================
-- Deliveries are done by MSW's own people only, to any live job (allocated or
-- not).  Each delivery keeps the job's number, name and address, so the driver
-- can see their own notes without being given access to the job's drawings.
-- Daywork is one kind of sheet: the type column is no longer required.
-- =============================================================================

create or replace function app.is_msw_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p join public.companies c on c.id = p.company_id
                 where p.id = auth.uid() and p.active and c.is_msw)
$$;

-- Live jobs a delivery can be booked to (names and addresses only).
create or replace function app.delivery_jobs()
returns table (id uuid, job_number text, name text, site_address text, postcode text, main_contractor text, site_contact_name text)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.job_number, j.name, j.site_address, j.postcode, j.main_contractor, j.site_contact_name
  from public.jobs j
  where app.is_msw_member() and j.status = 'live'
  order by j.job_number desc
$$;

alter table public.deliveries
  add column job_number text,
  add column job_name text,
  add column job_address text;
update public.deliveries v
   set job_number = j.job_number, job_name = j.name,
       job_address = j.site_address || coalesce(', ' || j.postcode, '')
  from public.jobs j where j.id = v.job_id;

create or replace function app.deliveries_job_snapshot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if j.id is null then
    raise exception 'Job not found' using errcode = 'foreign_key_violation';
  end if;
  if app.is_api_context() and j.status <> 'live' then
    raise exception 'Deliveries can only be booked to a live job' using errcode = '42501';
  end if;
  new.job_number := j.job_number;
  new.job_name := j.name;
  new.job_address := j.site_address || coalesce(', ' || j.postcode, '');
  return new;
end;
$$;
create trigger deliveries_job_snapshot before insert on public.deliveries
  for each row execute function app.deliveries_job_snapshot();

drop policy deliveries_insert on public.deliveries;
create policy deliveries_insert on public.deliveries for insert to authenticated
  with check (captured_by = auth.uid() and app.is_msw_member());

-- The office, and the MSW person who raised it.
create or replace function app.can_see_delivery(p_delivery uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.deliveries d
    where d.id = p_delivery
      and (app.user_is_staff(auth.uid()) or d.captured_by = auth.uid())
  )
$$;

-- Daywork: one sheet type (reason, people, hours).
alter table public.dayworks alter column kind drop not null, alter column kind drop default;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text), app.is_msw_member(), app.delivery_jobs()
to authenticated;
