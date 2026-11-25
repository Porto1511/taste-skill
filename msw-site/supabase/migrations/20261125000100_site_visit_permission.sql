-- MSW lads can be given site visits too (e.g. a supervisor who goes out to look
-- at jobs).  Office staff always can.  Nobody else sees site visits.
alter table public.profiles add column site_visits boolean not null default false;

create or replace function app.can_do_site_visits()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_is_staff(auth.uid())
      or exists (select 1 from public.profiles p join public.companies c on c.id = p.company_id
                 where p.id = auth.uid() and p.active and c.is_msw and p.site_visits)
$$;

drop policy site_visits_staff on public.site_visits;
drop policy site_visit_photos_staff on public.site_visit_photos;
create policy site_visits_access on public.site_visits for all to authenticated
  using (app.can_do_site_visits()) with check (app.can_do_site_visits());
create policy site_visit_photos_access on public.site_visit_photos for all to authenticated
  using (app.can_do_site_visits()) with check (app.can_do_site_visits());

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
  )
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(), app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid), app.can_see_revision(uuid),
  app.can_see_report(uuid), app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid),
  app.minutes_between(time, time), app.can_keep_timesheet(), app.can_see_handover(uuid), app.can_see_daywork(uuid), app.can_see_delivery(uuid),
  app.can_read_storage_object(text), app.is_msw_member(), app.delivery_jobs(), app.can_manage_certificates(uuid), app.can_do_site_visits()
to authenticated;
