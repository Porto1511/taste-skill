-- =============================================================================
-- MSW Site — subcontractor invoices for the QS.
--
-- The ONLY commercial data in the app, so it is fenced off hard:
--   * seen by the MSW office, and by the boss of the company that sent it;
--   * never by operatives (not even that company's own), never by another
--     company, never in job activity or notifications anyone else receives.
-- =============================================================================

create type public.invoice_status as enum ('submitted', 'checked', 'query');

create table public.subcontractor_invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  invoice_number  text not null check (length(trim(invoice_number)) between 1 and 60),
  invoice_date    date not null,
  amount          numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  notes           text check (notes is null or length(notes) <= 2000),
  file_name       text not null check (length(file_name) <= 255),
  file_size       integer not null check (file_size > 0),
  storage_path    text not null unique,
  status          public.invoice_status not null default 'submitted',
  office_note     text check (office_note is null or length(office_note) <= 2000),
  checked_by      uuid references public.profiles (id) on delete set null,
  checked_at      timestamptz,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  uploaded_by_name text,
  created_at      timestamptz not null default now()
);
create index subcontractor_invoices_company_idx on public.subcontractor_invoices (company_id, created_at desc);
create index subcontractor_invoices_job_idx on public.subcontractor_invoices (job_id);
create unique index subcontractor_invoices_number_key on public.subcontractor_invoices (company_id, lower(invoice_number));

-- The office, or the boss of the company the invoice belongs to.  Nobody else.
create or replace function app.can_see_invoices(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_is_staff(auth.uid())
      or (app.user_is_company_boss(auth.uid()) and p_company = app.my_company_id())
$$;

create or replace function app.invoices_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.uploaded_by := auth.uid();
    new.created_at := now();
    new.status := 'submitted';
    new.office_note := null;
    new.checked_by := null;
    new.checked_at := null;
  end if;
  select p.full_name into new.uploaded_by_name from public.profiles p where p.id = new.uploaded_by;
  -- A company invoices only for a job MSW gave it (now or before).
  if not exists (select 1 from public.job_companies jc where jc.job_id = new.job_id and jc.company_id = new.company_id) then
    raise exception 'Your company has not been given that job' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger subcontractor_invoices_before_insert before insert on public.subcontractor_invoices
  for each row execute function app.invoices_before_insert();

-- Only the office checks invoices; a boss can't change one once sent.
create or replace function app.invoices_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    if not app.is_staff() then
      raise exception 'Only the MSW office can check invoices' using errcode = '42501';
    end if;
    -- The office records its check; the invoice itself stays as sent.
    new.company_id := old.company_id; new.job_id := old.job_id; new.invoice_number := old.invoice_number;
    new.invoice_date := old.invoice_date; new.amount := old.amount; new.notes := old.notes;
    new.file_name := old.file_name; new.file_size := old.file_size; new.storage_path := old.storage_path;
    new.uploaded_by := old.uploaded_by; new.uploaded_by_name := old.uploaded_by_name; new.created_at := old.created_at;
    new.checked_by := auth.uid();
    new.checked_at := now();
  end if;
  return new;
end;
$$;
create trigger subcontractor_invoices_before_update before update on public.subcontractor_invoices
  for each row execute function app.invoices_before_update();

-- Tell the office (all of it — the QS included) and, on a check, the boss.
-- No amounts in alerts: they're only ever shown on the invoice screens.
create or replace function app.audit_invoices()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_company text;
  v_job public.jobs;
  v_user uuid;
begin
  select c.name into v_company from public.companies c where c.id = new.company_id;
  select * into v_job from public.jobs j where j.id = new.job_id;
  if tg_op = 'INSERT' then
    for v_user in select p.id from public.profiles p where p.active and p.role in ('admin', 'office') loop
      perform app.notify(v_user, 'invoice.submitted', v_company || ' sent invoice ' || new.invoice_number,
        v_job.job_number || ' — ' || v_job.name, '/office/invoices/' || new.id, null);
    end loop;
  elsif new.status is distinct from old.status then
    for v_user in select p.id from public.profiles p
                  where p.company_id = new.company_id and p.active and p.role = 'manager' loop
      perform app.notify(v_user, 'invoice.checked',
        'Invoice ' || new.invoice_number || case new.status when 'checked' then ' has been checked' when 'query' then ': MSW have a query' else ' updated' end,
        coalesce(new.office_note, ''), '/company/invoices', null);
    end loop;
  end if;
  return null;
end;
$$;
create trigger subcontractor_invoices_audit after insert or update on public.subcontractor_invoices
  for each row execute function app.audit_invoices();

alter table public.subcontractor_invoices enable row level security;
create policy subcontractor_invoices_select on public.subcontractor_invoices for select to authenticated
  using (app.can_see_invoices(company_id));
create policy subcontractor_invoices_insert on public.subcontractor_invoices for insert to authenticated
  with check (app.can_see_invoices(company_id));
create policy subcontractor_invoices_update on public.subcontractor_invoices for update to authenticated
  using (app.is_staff()) with check (app.is_staff());
grant select, insert, update on public.subcontractor_invoices to authenticated;

-- Files: the same two parties only.
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
    or exists (select 1 from public.site_visit_photos sp where sp.storage_path = p_name and app.can_do_site_visits())
    or exists (select 1 from public.operative_cards oc where oc.storage_path = p_name and app.can_see_cards(oc.user_id))
    or exists (select 1 from public.variations va
               where (va.client_signature_path = p_name or va.operative_signature_path = p_name) and app.can_see_variation(va.id))
    or exists (select 1 from public.variation_photos vp where vp.storage_path = p_name and app.can_see_variation(vp.variation_id))
    or exists (select 1 from public.subcontractor_invoices si where si.storage_path = p_name and app.can_see_invoices(si.company_id))
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text), app.is_msw_member(), app.delivery_jobs(), app.can_manage_certificates(uuid), app.can_do_site_visits(),
  app.is_company_boss(), app.is_my_person(uuid), app.can_see_cards(uuid), app.can_manage_cards(uuid), app.can_edit_certificates(uuid),
  app.can_see_variation(uuid), app.can_see_invoices(uuid)
to authenticated;
