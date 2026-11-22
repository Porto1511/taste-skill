-- =============================================================================
-- 1. Deliveries are typed in (job number + site address), because a delivery
--    often goes out before the job exists in the system.  If the job number
--    matches a job we already have, the delivery is linked to it.
-- 2. Certificates: each company (MSW and every subcontractor) keeps a library
--    of certificate files (e.g. net certs) to send to clients on request.
-- =============================================================================

alter table public.deliveries alter column job_id drop not null;
alter table public.deliveries
  add constraint deliveries_job_number check (job_number is null or length(trim(job_number)) between 1 and 40),
  add constraint deliveries_job_address check (job_address is null or length(trim(job_address)) between 3 and 300),
  add constraint deliveries_where check (job_id is not null or (job_number is not null and job_address is not null));

create or replace function app.deliveries_job_snapshot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j public.jobs;
begin
  if new.job_id is null and new.job_number is not null then
    select * into j from public.jobs where lower(job_number) = lower(trim(new.job_number)) limit 1;
    new.job_id := j.id;
  elsif new.job_id is not null then
    select * into j from public.jobs where id = new.job_id;
    if j.id is null then
      raise exception 'Job not found' using errcode = 'foreign_key_violation';
    end if;
  end if;
  -- What the driver typed wins; fill any gaps from the job we know about.
  new.job_number := coalesce(nullif(trim(new.job_number), ''), j.job_number);
  new.job_name := coalesce(nullif(trim(new.job_name), ''), j.name);
  new.job_address := coalesce(nullif(trim(new.job_address), ''), j.site_address || coalesce(', ' || j.postcode, ''));
  return new;
end;
$$;

create or replace function app.audit_deliveries()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform app.write_activity(new.job_id, 'delivery.signed', 'delivery', new.id,
    'Delivery to ' || new.job_number || ' by ' || new.delivered_by || ' received and signed by ' || new.receiver_name || ' (' || new.receiver_company || ')');
  for v_user in select * from app.office_recipients(new.job_id, new.job_id is null) loop
    perform app.notify(v_user, 'delivery.signed', 'Delivery signed for on ' || new.job_number,
      jsonb_array_length(new.items) || ' item(s), delivered by ' || new.delivered_by || ', received by ' || new.receiver_name,
      '/office/deliveries/' || new.id, new.job_id);
  end loop;
  return null;
end;
$$;

-- Known jobs (planned or live) to suggest while typing; names and addresses only.
create or replace function app.delivery_jobs()
returns table (id uuid, job_number text, name text, site_address text, postcode text, main_contractor text, site_contact_name text)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.job_number, j.name, j.site_address, j.postcode, j.main_contractor, j.site_contact_name
  from public.jobs j
  where app.is_msw_member() and j.status in ('planned', 'live')
  order by j.job_number desc
$$;

-- ---------------------------------------------------------------------------
-- Company certificates
-- ---------------------------------------------------------------------------
create table public.company_certificates (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  title         text not null check (length(trim(title)) between 2 and 160),
  file_name     text not null check (length(file_name) <= 255),
  file_size     integer not null check (file_size > 0),
  storage_path  text not null unique,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  uploaded_by_name text,
  created_at    timestamptz not null default now()
);
create index company_certificates_company_idx on public.company_certificates (company_id, created_at desc);

-- MSW office sees every company's certificates; anyone else sees their own company's.
create or replace function app.can_manage_certificates(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_is_staff(auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.active and p.company_id = p_company)
$$;

create or replace function app.certificates_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.uploaded_by := auth.uid();
    new.created_at := now();
  end if;
  select p.full_name into new.uploaded_by_name from public.profiles p where p.id = new.uploaded_by;
  return new;
end;
$$;
create trigger company_certificates_before_insert before insert on public.company_certificates
  for each row execute function app.certificates_before_insert();

alter table public.company_certificates enable row level security;
create policy company_certificates_select on public.company_certificates for select to authenticated
  using (app.can_manage_certificates(company_id));
create policy company_certificates_insert on public.company_certificates for insert to authenticated
  with check (app.can_manage_certificates(company_id));
create policy company_certificates_delete on public.company_certificates for delete to authenticated
  using (app.can_manage_certificates(company_id));
grant select, insert, delete on public.company_certificates to authenticated;

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
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text), app.is_msw_member(), app.delivery_jobs(), app.can_manage_certificates(uuid)
to authenticated;
