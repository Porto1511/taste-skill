-- =============================================================================
-- Only MSW administrators create jobs and upload/approve drawings & RAMS, and
-- administrators can delete a drawing (all revisions) or a single revision
-- that is not the one currently issued to site.  Enforced here, not in the UI.
-- =============================================================================

-- Jobs and their areas
drop policy jobs_insert on public.jobs;
create policy jobs_insert on public.jobs for insert to authenticated with check (app.is_admin());
drop policy jobs_update on public.jobs;
create policy jobs_update on public.jobs for update to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy job_areas_write on public.job_areas;
create policy job_areas_write on public.job_areas for insert to authenticated with check (app.is_admin());
drop policy job_areas_update on public.job_areas;
create policy job_areas_update on public.job_areas for update to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy job_areas_delete on public.job_areas;
create policy job_areas_delete on public.job_areas for delete to authenticated using (app.is_admin());

-- Documents (drawings & RAMS)
drop policy documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated with check (app.is_admin());
drop policy documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy documents_delete on public.documents for delete to authenticated using (app.is_admin());
grant delete on public.documents to authenticated;

drop policy document_areas_insert on public.document_areas;
create policy document_areas_insert on public.document_areas for insert to authenticated with check (app.is_admin());
drop policy document_areas_delete on public.document_areas;
create policy document_areas_delete on public.document_areas for delete to authenticated using (app.is_admin());

drop policy document_revisions_insert on public.document_revisions;
create policy document_revisions_insert on public.document_revisions for insert to authenticated with check (app.is_admin());
drop policy document_revisions_update on public.document_revisions;
create policy document_revisions_update on public.document_revisions for update to authenticated using (app.is_admin()) with check (app.is_admin());
drop policy document_revisions_delete on public.document_revisions;
-- A single revision can go unless it is the one on site (withdraw it, or delete the whole drawing).
create policy document_revisions_delete on public.document_revisions for delete to authenticated
  using (app.is_admin() and status <> 'approved');

create or replace function public.approve_revision(p_revision uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc uuid;
  v_status public.revision_status;
begin
  if not app.is_admin() then
    raise exception 'Only an MSW administrator can issue drawings' using errcode = '42501';
  end if;
  select r.document_id, r.status into v_doc, v_status
  from public.document_revisions r where r.id = p_revision for update;
  if v_doc is null then
    raise exception 'Revision not found' using errcode = 'P0002';
  end if;
  if v_status = 'approved' then
    return;
  end if;
  if v_status = 'withdrawn' then
    raise exception 'A withdrawn revision cannot be approved — upload a new revision' using errcode = '22023';
  end if;
  update public.document_revisions
     set status = 'superseded', superseded_at = app.now()
   where document_id = v_doc and status = 'approved';
  update public.document_revisions
     set status = 'approved', approved_at = app.now(), approved_by = auth.uid(), superseded_at = null
   where id = p_revision;
end;
$$;

create or replace function public.withdraw_revision(p_revision uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_status public.revision_status;
begin
  if not app.is_admin() then
    raise exception 'Only an MSW administrator can withdraw drawings' using errcode = '42501';
  end if;
  select r.status into v_status from public.document_revisions r where r.id = p_revision for update;
  if v_status is null then
    raise exception 'Revision not found' using errcode = 'P0002';
  end if;
  if v_status not in ('approved', 'draft') then
    raise exception 'Only draft or approved revisions can be withdrawn' using errcode = '22023';
  end if;
  update public.document_revisions
     set status = 'withdrawn', withdrawn_at = app.now()
   where id = p_revision;
end;
$$;

-- Deletions are recorded in the job's history.
create or replace function app.audit_document_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.write_activity(old.job_id, 'document.deleted', 'document', old.id,
    initcap(old.kind::text) || ' ' || old.doc_number || ' "' || old.title || '" deleted');
  return null;
end;
$$;
create trigger documents_deleted after delete on public.documents
  for each row execute function app.audit_document_deleted();

create or replace function app.audit_revision_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_doc public.documents;
begin
  select * into v_doc from public.documents d where d.id = old.document_id;
  if v_doc.id is null then
    return null; -- the whole drawing is being deleted
  end if;
  perform app.write_activity(v_doc.job_id, 'revision.deleted', 'document', v_doc.id,
    v_doc.doc_number || ' rev ' || old.revision || ' deleted');
  return null;
end;
$$;
create trigger document_revisions_deleted after delete on public.document_revisions
  for each row execute function app.audit_revision_deleted();
