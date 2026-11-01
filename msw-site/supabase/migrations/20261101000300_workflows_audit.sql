-- =============================================================================
-- MSW Site — workflows, audit history and notifications
--
-- All audit entries and notifications are written by SECURITY DEFINER
-- triggers so they cannot be forged or skipped by API callers.
-- Business operations (granting access, approving drawings, responding to
-- reports) are SECURITY INVOKER functions: they run under the caller's RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internal writers (not executable by API roles)
-- ---------------------------------------------------------------------------
create or replace function app.write_activity(
  p_job uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
begin
  if v_actor is not null then
    select p.full_name into v_name from public.profiles p where p.id = v_actor;
  end if;
  insert into public.activity_log (job_id, actor_id, actor_name, action, entity_type, entity_id, summary, details, created_at)
  values (p_job, v_actor, coalesce(v_name, 'System'), p_action, p_entity_type, p_entity_id,
          p_summary, coalesce(p_details, '{}'::jsonb), app.now());
end;
$$;

create or replace function app.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_href text, p_job uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Never notify someone about their own action.
  if p_user is null or p_user = auth.uid() then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, href, job_id, created_at)
  values (p_user, p_kind, left(p_title, 200), left(p_body, 500), p_href, p_job, app.now());
end;
$$;

-- Office users who should hear about a job: its MSW contracts manager, or all
-- administrators when no (active) contracts manager is set.  For urgent
-- matters every active MSW office user is notified.
create or replace function app.office_recipients(p_job uuid, p_all_staff boolean)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.active
    and p.role in ('admin', 'office')
    and (
      p_all_staff
      or p.id = (select j.contracts_manager_id from public.jobs j where j.id = p_job)
      or (
        p.role = 'admin'
        and not exists (
          select 1 from public.jobs j
          join public.profiles cm on cm.id = j.contracts_manager_id and cm.active
          where j.id = p_job
        )
      )
    )
$$;

-- Non-office users currently assigned to a job.
create or replace function app.job_audience(p_job uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.user_id
  from public.job_assignments a
  join public.profiles p on p.id = a.user_id
  where a.job_id = p_job
    and a.revoked_at is null
    and p.active
    and p.role not in ('admin', 'office')
$$;

-- Non-office users who can currently see a document (job + area aware).
create or replace function app.document_audience(p_document uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select u.user_id
  from public.documents d
  cross join lateral app.job_audience(d.job_id) as u(user_id)
  where d.id = p_document
    and app.user_can_see_document(u.user_id, p_document)
$$;

create or replace function app.field_label(p_key text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_key
    when 'job_number' then 'job number'
    when 'site_address' then 'site address'
    when 'main_contractor' then 'main contractor'
    when 'site_contact_name' then 'site contact'
    when 'site_contact_role' then 'site contact role'
    when 'site_contact_phone' then 'site contact phone'
    when 'start_date' then 'start date'
    when 'end_date' then 'end date'
    when 'induction_url' then 'induction link'
    when 'induction_notes' then 'induction notes'
    when 'site_instructions' then 'site instructions'
    when 'contracts_manager_id' then 'contracts manager'
    when 'what3words' then 'what3words'
    else replace(p_key, '_', ' ')
  end
$$;

create or replace function app.changed_keys(p_old jsonb, p_new jsonb, p_ignore text[])
returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(n.key order by n.key), '{}')
  from jsonb_each(p_new) n
  where not (n.key = any (p_ignore))
    and n.value is distinct from (p_old -> n.key)
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create or replace function app.audit_jobs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed text[];
  v_labels text;
  v_user uuid;
begin
  if tg_op = 'INSERT' then
    perform app.write_activity(new.id, 'job.created', 'job', new.id,
      'Job ' || new.job_number || ' ' || new.name || ' created');
    return null;
  end if;

  v_changed := app.changed_keys(to_jsonb(old), to_jsonb(new), array['updated_at']);
  if cardinality(v_changed) = 0 then
    return null;
  end if;
  select string_agg(app.field_label(k), ', ') into v_labels from unnest(v_changed) k;

  if new.status is distinct from old.status then
    perform app.write_activity(new.id, 'job.status_changed', 'job', new.id,
      'Job status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if cardinality(array_remove(v_changed, 'status')) > 0 then
    perform app.write_activity(new.id, 'job.updated', 'job', new.id,
      'Job details updated: ' || v_labels, jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  -- Tell the people on site when information they rely on changes.
  if new.site_instructions is distinct from old.site_instructions
     or new.induction_url is distinct from old.induction_url
     or new.site_contact_phone is distinct from old.site_contact_phone
     or new.site_address is distinct from old.site_address then
    for v_user in select * from app.job_audience(new.id) loop
      perform app.notify(v_user, 'job.updated',
        'Site information updated: ' || new.job_number,
        'Changed: ' || v_labels, '/jobs/' || new.id, new.id);
    end loop;
  end if;
  return null;
end;
$$;
create trigger jobs_audit after insert or update on public.jobs
  for each row execute function app.audit_jobs();

create or replace function app.audit_job_areas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_activity(new.job_id, 'area.created', 'area', new.id,
      initcap(new.kind::text) || ' "' || new.name || '" added');
    return null;
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      perform app.write_activity(new.job_id, 'area.renamed', 'area', new.id,
        'Area "' || old.name || '" renamed to "' || new.name || '"');
    end if;
    return null;
  else
    -- Deletions are also logged when they cascade from a job deletion.
    perform app.write_activity(
      (select j.id from public.jobs j where j.id = old.job_id),
      'area.deleted', 'area', old.id, 'Area "' || old.name || '" removed');
    return null;
  end if;
end;
$$;
create trigger job_areas_audit after insert or update or delete on public.job_areas
  for each row execute function app.audit_job_areas();

-- ---------------------------------------------------------------------------
-- Access changes: logged at COMMIT so the entry reflects the final areas.
-- ---------------------------------------------------------------------------
create or replace function app.audit_assignment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.job_assignments;
  v_user_name text;
  v_job_label text;
  v_areas text;
  v_details jsonb;
begin
  select * into a from public.job_assignments x where x.id = new.id;
  if a.id is null then
    return null;
  end if;
  select p.full_name into v_user_name from public.profiles p where p.id = a.user_id;
  select j.job_number || ' ' || j.name into v_job_label from public.jobs j where j.id = a.job_id;

  if a.all_areas then
    v_areas := 'all areas';
  else
    select coalesce(string_agg(ar.name, ', ' order by ar.sort_order, ar.name), 'job-wide information only')
      into v_areas
    from public.assignment_areas aa
    join public.job_areas ar on ar.id = aa.area_id
    where aa.assignment_id = a.id;
  end if;

  v_details := jsonb_build_object(
    'user_id', a.user_id, 'areas', v_areas,
    'attendance_from', a.attendance_from, 'attendance_to', a.attendance_to,
    'can_view_company_reports', a.can_view_company_reports);

  if tg_op = 'INSERT' then
    perform app.write_activity(a.job_id, 'access.granted', 'assignment', a.id,
      v_user_name || ' given access (' || v_areas || ')', v_details);
    perform app.notify(a.user_id, 'access.granted', 'You have been added to ' || v_job_label,
      'Allocated: ' || v_areas, '/jobs/' || a.job_id, a.job_id);
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform app.write_activity(a.job_id, 'access.revoked', 'assignment', a.id,
      v_user_name || ' access revoked', v_details);
    perform app.notify(a.user_id, 'access.revoked', 'Your access to ' || v_job_label || ' has ended',
      'Contact the MSW office if you think this is wrong.', '/jobs', null);
  elsif a.revoked_at is null then
    perform app.write_activity(a.job_id, 'access.updated', 'assignment', a.id,
      v_user_name || ' access updated (' || v_areas || ')', v_details);
    perform app.notify(a.user_id, 'access.updated', 'Your allocation on ' || v_job_label || ' changed',
      'Now: ' || v_areas, '/jobs/' || a.job_id, a.job_id);
  end if;
  return null;
end;
$$;
create constraint trigger job_assignments_audit
  after insert or update on public.job_assignments
  deferrable initially deferred
  for each row execute function app.audit_assignment();

-- ---------------------------------------------------------------------------
-- Documents and revisions
-- ---------------------------------------------------------------------------
create or replace function app.audit_documents()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_activity(new.job_id, 'document.created', 'document', new.id,
      initcap(new.kind::text) || ' ' || new.doc_number || ' "' || new.title || '" added');
  elsif (new.title, new.doc_number, new.description) is distinct from (old.title, old.doc_number, old.description) then
    perform app.write_activity(new.job_id, 'document.updated', 'document', new.id,
      initcap(new.kind::text) || ' ' || new.doc_number || ' details updated');
  end if;
  return null;
end;
$$;
create trigger documents_audit after insert or update on public.documents
  for each row execute function app.audit_documents();

create or replace function app.audit_document_areas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_doc public.documents;
  v_area text;
  r public.document_areas;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select * into v_doc from public.documents d where d.id = r.document_id;
  if v_doc.id is null then
    return null; -- document is being deleted
  end if;
  select ar.name into v_area from public.job_areas ar where ar.id = r.area_id;
  perform app.write_activity(v_doc.job_id,
    case when tg_op = 'DELETE' then 'document.area_removed' else 'document.area_added' end,
    'document', v_doc.id,
    v_doc.doc_number || case when tg_op = 'DELETE' then ' no longer limited to ' else ' applies to ' end
      || coalesce(v_area, 'area'));
  return null;
end;
$$;
create trigger document_areas_audit after insert or delete on public.document_areas
  for each row execute function app.audit_document_areas();

create or replace function app.audit_revisions()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_doc public.documents;
  v_prev text;
  v_label text;
  v_user uuid;
  v_href text;
begin
  select * into v_doc from public.documents d where d.id = new.document_id;
  v_label := v_doc.doc_number || ' rev ' || new.revision;
  v_href := '/jobs/' || v_doc.job_id || '/documents/' || v_doc.id;

  if tg_op = 'INSERT' then
    perform app.write_activity(v_doc.job_id, 'revision.uploaded', 'revision', new.id,
      v_label || ' uploaded (' || new.status || ')',
      jsonb_build_object('document_id', v_doc.id, 'file_name', new.file_name));
    if new.status <> 'approved' then
      return null;
    end if;
  elsif new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'approved' then
    select r.revision into v_prev
    from public.document_revisions r
    where r.document_id = new.document_id
      and r.id <> new.id
      and r.status = 'superseded'
      and r.superseded_at = app.now()
    limit 1;

    perform app.write_activity(v_doc.job_id, 'revision.approved', 'revision', new.id,
      v_label || ' approved for use' || coalesce(' (supersedes rev ' || v_prev || ')', ''),
      jsonb_build_object('document_id', v_doc.id, 'previous', v_prev));

    for v_user in select * from app.document_audience(v_doc.id) loop
      perform app.notify(v_user, 'document.updated',
        case when v_prev is null
          then 'New ' || v_doc.kind || ' issued: ' || v_doc.doc_number
          else initcap(v_doc.kind::text) || ' updated: ' || v_doc.doc_number || ' now rev ' || new.revision
        end,
        v_doc.title || coalesce(' — rev ' || v_prev || ' is superseded, do not use it.', ''),
        v_href, v_doc.job_id);
    end loop;
  elsif new.status = 'superseded' then
    perform app.write_activity(v_doc.job_id, 'revision.superseded', 'revision', new.id,
      v_label || ' superseded', jsonb_build_object('document_id', v_doc.id));
  elsif new.status = 'withdrawn' then
    perform app.write_activity(v_doc.job_id, 'revision.withdrawn', 'revision', new.id,
      v_label || ' withdrawn', jsonb_build_object('document_id', v_doc.id));
    if old.status = 'approved' then
      for v_user in select * from app.document_audience(v_doc.id) loop
        perform app.notify(v_user, 'document.withdrawn',
          'Withdrawn — do not use: ' || v_doc.doc_number || ' rev ' || new.revision,
          v_doc.title || '. Check with the MSW office before continuing.',
          '/jobs/' || v_doc.job_id, v_doc.job_id);
      end loop;
    end if;
  end if;
  return null;
end;
$$;
create trigger document_revisions_audit after insert or update on public.document_revisions
  for each row execute function app.audit_revisions();

-- ---------------------------------------------------------------------------
-- Reports: authorship and timestamps are always set by the server.
-- ---------------------------------------------------------------------------
create or replace function app.reports_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if app.is_api_context() then
    new.author_id := v_uid;
    new.created_at := now();
    new.updated_at := now();
    new.resolved_at := null;
    if not app.user_is_staff(v_uid) then
      new.shared_with_team := false;
    end if;
    if new.kind = 'issue' then
      new.status := 'open';
    end if;
  end if;

  if new.kind = 'issue' then
    new.status := coalesce(new.status, 'open');
  else
    new.status := null;
    new.category := null;
  end if;

  select p.full_name, p.company_id, c.name
    into new.author_name, new.author_company_id, new.author_company_name
  from public.profiles p
  join public.companies c on c.id = p.company_id
  where p.id = new.author_id;

  if new.author_name is null then
    raise exception 'Unknown report author' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function app.reports_before_insert();

create or replace function app.reports_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- What was reported, by whom and when is immutable.
  new.id := old.id;
  new.job_id := old.job_id;
  new.area_id := old.area_id;
  new.kind := old.kind;
  new.category := old.category;
  new.title := old.title;
  new.description := old.description;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.author_company_id := old.author_company_id;
  new.author_company_name := old.author_company_name;
  new.created_at := old.created_at;
  if old.kind <> 'issue' then
    new.status := null;
  end if;
  if new.status is distinct from old.status then
    new.resolved_at := case when new.status in ('resolved', 'closed') then app.now() end;
  else
    new.resolved_at := old.resolved_at;
  end if;
  new.updated_at := app.now();
  return new;
end;
$$;
create trigger reports_before_update before update on public.reports
  for each row execute function app.reports_before_update();

create or replace function app.audit_reports()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.jobs;
  v_urgent boolean;
  v_user uuid;
  v_kind_label text;
begin
  select * into v_job from public.jobs j where j.id = new.job_id;
  v_kind_label := case new.kind when 'issue' then 'Issue' when 'progress' then 'Progress update' else 'Photos' end;

  if tg_op = 'INSERT' then
    v_urgent := new.priority = 'urgent' or new.category = 'safety';
    perform app.write_activity(new.job_id, 'report.created', 'report', new.id,
      v_kind_label || ' submitted by ' || new.author_name || ': ' || new.title,
      jsonb_build_object('kind', new.kind, 'category', new.category, 'priority', new.priority));
    for v_user in select * from app.office_recipients(new.job_id, v_urgent) loop
      perform app.notify(v_user, 'report.created',
        case when v_urgent then 'URGENT ' else '' end || v_kind_label || ' on ' || v_job.job_number || ': ' || new.title,
        new.author_name || ' (' || new.author_company_name || ')',
        '/office/reports/' || new.id, new.job_id);
    end loop;
    return null;
  end if;

  if new.status is distinct from old.status then
    perform app.write_activity(new.job_id, 'report.status_changed', 'report', new.id,
      'Issue "' || new.title || '" marked ' || replace(new.status::text, '_', ' '),
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.shared_with_team is distinct from old.shared_with_team then
    perform app.write_activity(new.job_id,
      case when new.shared_with_team then 'report.shared' else 'report.unshared' end, 'report', new.id,
      '"' || new.title || '" ' || case when new.shared_with_team
        then 'shared with the job team' else 'no longer shared with the job team' end);
  end if;
  if new.priority is distinct from old.priority then
    perform app.write_activity(new.job_id, 'report.priority_changed', 'report', new.id,
      '"' || new.title || '" priority set to ' || new.priority);
  end if;
  return null;
end;
$$;
create trigger reports_audit after insert or update on public.reports
  for each row execute function app.audit_reports();

create or replace function app.report_photos_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.uploaded_by := auth.uid();
    new.created_at := now();
  end if;
  return new;
end;
$$;
create trigger report_photos_before_insert before insert on public.report_photos
  for each row execute function app.report_photos_before_insert();

create or replace function app.report_responses_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.is_api_context() then
    new.author_id := auth.uid();
  end if;
  new.created_at := app.now();
  select p.full_name, p.role in ('admin', 'office')
    into new.author_name, new.from_office
  from public.profiles p where p.id = new.author_id;
  if new.author_name is null then
    raise exception 'Unknown response author' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger report_responses_before_insert before insert on public.report_responses
  for each row execute function app.report_responses_before_insert();

create or replace function app.audit_report_responses()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports;
  v_user uuid;
  v_title text;
begin
  select * into v_report from public.reports r where r.id = new.report_id;

  if new.body is not null then
    perform app.write_activity(v_report.job_id, 'report.responded', 'report', v_report.id,
      new.author_name || ' replied on "' || v_report.title || '"');
  end if;

  if new.from_office then
    v_title := case
      when new.status_to is not null and new.body is not null
        then 'MSW replied and marked ' || replace(new.status_to::text, '_', ' ') || ': ' || v_report.title
      when new.status_to is not null
        then 'Issue marked ' || replace(new.status_to::text, '_', ' ') || ': ' || v_report.title
      else 'MSW replied: ' || v_report.title
    end;
    perform app.notify(v_report.author_id, 'report.response', v_title, left(new.body, 300),
      '/jobs/' || v_report.job_id || '/reports/' || v_report.id, v_report.job_id);
  else
    for v_user in select * from app.office_recipients(v_report.job_id, false) loop
      perform app.notify(v_user, 'report.response',
        new.author_name || ' replied: ' || v_report.title, left(new.body, 300),
        '/office/reports/' || v_report.id, v_report.job_id);
    end loop;
  end if;
  return null;
end;
$$;
create trigger report_responses_audit after insert on public.report_responses
  for each row execute function app.audit_report_responses();

-- ---------------------------------------------------------------------------
-- Directory changes
-- ---------------------------------------------------------------------------
create or replace function app.audit_profiles()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    perform app.write_activity(null, 'user.created', 'user', new.id,
      new.full_name || ' added as ' || new.role,
      jsonb_build_object('company_id', new.company_id, 'role', new.role));
    return null;
  end if;
  v_changed := app.changed_keys(to_jsonb(old), to_jsonb(new), array['updated_at', 'last_seen_at']);
  if cardinality(v_changed) = 0 then
    return null;
  end if;
  if new.active is distinct from old.active then
    perform app.write_activity(null, case when new.active then 'user.reactivated' else 'user.deactivated' end,
      'user', new.id, new.full_name || case when new.active then ' reactivated' else ' deactivated — all access suspended' end);
  end if;
  if new.role is distinct from old.role then
    perform app.write_activity(null, 'user.role_changed', 'user', new.id,
      new.full_name || ' role changed from ' || old.role || ' to ' || new.role);
  end if;
  if new.company_id is distinct from old.company_id then
    perform app.write_activity(null, 'user.company_changed', 'user', new.id,
      new.full_name || ' moved to ' || (select c.name from public.companies c where c.id = new.company_id));
  end if;
  if cardinality(array_remove(array_remove(array_remove(v_changed, 'active'), 'role'), 'company_id')) > 0 then
    perform app.write_activity(null, 'user.updated', 'user', new.id, new.full_name || ' details updated',
      jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return null;
end;
$$;
create trigger profiles_audit after insert or update on public.profiles
  for each row execute function app.audit_profiles();

create or replace function app.audit_companies()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_activity(null, 'company.created', 'company', new.id, 'Company ' || new.name || ' added');
  elsif new.active is distinct from old.active then
    perform app.write_activity(null, 'company.updated', 'company', new.id,
      'Company ' || new.name || case when new.active then ' reactivated' else ' deactivated' end);
  elsif to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    perform app.write_activity(null, 'company.updated', 'company', new.id, 'Company ' || new.name || ' details updated');
  end if;
  return null;
end;
$$;
create trigger companies_audit after insert or update on public.companies
  for each row execute function app.audit_companies();

-- ---------------------------------------------------------------------------
-- Business operations (SECURITY INVOKER: caller's RLS applies)
-- ---------------------------------------------------------------------------

-- Grant or update access for one or many people in a single action.
-- Existing active assignments are updated in place (no duplicates).
create or replace function public.grant_job_access(
  p_job uuid,
  p_user_ids uuid[],
  p_all_areas boolean,
  p_area_ids uuid[] default '{}',
  p_attendance_from date default null,
  p_attendance_to date default null,
  p_note text default null,
  p_can_view_company_reports boolean default false
)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid;
  v_role public.app_role;
  v_assignment uuid;
  v_count integer := 0;
  v_areas uuid[] := coalesce(p_area_ids, '{}');
begin
  if not app.is_admin() then
    raise exception 'Only MSW administrators can change job access' using errcode = '42501';
  end if;
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    raise exception 'Select at least one person' using errcode = '22023';
  end if;
  if not exists (select 1 from public.jobs j where j.id = p_job) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from unnest(v_areas) as x(area_id)
    where not exists (select 1 from public.job_areas ja where ja.id = x.area_id and ja.job_id = p_job)
  ) then
    raise exception 'Selected areas must belong to this job' using errcode = '22023';
  end if;
  if p_attendance_from is not null and p_attendance_to is not null and p_attendance_to < p_attendance_from then
    raise exception 'Attendance end date is before the start date' using errcode = '22023';
  end if;

  foreach v_user in array (select array_agg(distinct u) from unnest(p_user_ids) u) loop
    select p.role into v_role from public.profiles p where p.id = v_user and p.active;
    if v_role is null then
      raise exception 'One of the selected people is not an active account' using errcode = '22023';
    end if;
    if v_role in ('admin', 'office') then
      continue; -- MSW office users already see every job
    end if;

    select a.id into v_assignment
    from public.job_assignments a
    where a.job_id = p_job and a.user_id = v_user and a.revoked_at is null;

    if v_assignment is null then
      insert into public.job_assignments (
        job_id, user_id, all_areas, attendance_from, attendance_to, note,
        can_view_company_reports, granted_by
      ) values (
        p_job, v_user, p_all_areas, p_attendance_from, p_attendance_to, nullif(trim(p_note), ''),
        coalesce(p_can_view_company_reports, false) and v_role = 'manager', auth.uid()
      )
      returning id into v_assignment;
    else
      update public.job_assignments set
        all_areas = p_all_areas,
        attendance_from = p_attendance_from,
        attendance_to = p_attendance_to,
        note = nullif(trim(p_note), ''),
        can_view_company_reports = coalesce(p_can_view_company_reports, false) and v_role = 'manager'
      where id = v_assignment;
      delete from public.assignment_areas where assignment_id = v_assignment;
    end if;

    if not p_all_areas and cardinality(v_areas) > 0 then
      insert into public.assignment_areas (assignment_id, area_id)
      select v_assignment, x from unnest(v_areas) as x group by x;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.revoke_job_access(p_assignment_ids uuid[])
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'Only MSW administrators can change job access' using errcode = '42501';
  end if;
  update public.job_assignments
     set revoked_at = app.now(), revoked_by = auth.uid()
   where id = any (p_assignment_ids) and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Approve a revision for use; the previous approved revision is superseded.
create or replace function public.approve_revision(p_revision uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc uuid;
  v_status public.revision_status;
begin
  if not app.is_staff() then
    raise exception 'Only MSW office users can approve documents' using errcode = '42501';
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
  if not app.is_staff() then
    raise exception 'Only MSW office users can withdraw documents' using errcode = '42501';
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

-- Replace the set of areas a document applies to (empty = whole job).
create or replace function public.set_document_areas(p_document uuid, p_area_ids uuid[])
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_job uuid;
begin
  if not app.is_staff() then
    raise exception 'Only MSW office users can change documents' using errcode = '42501';
  end if;
  select d.job_id into v_job from public.documents d where d.id = p_document;
  if v_job is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  delete from public.document_areas da
   where da.document_id = p_document and not (da.area_id = any (coalesce(p_area_ids, '{}')));
  insert into public.document_areas (document_id, area_id)
  select p_document, x from unnest(coalesce(p_area_ids, '{}')) as x
  where not exists (select 1 from public.document_areas da where da.document_id = p_document and da.area_id = x)
  group by x;
end;
$$;

-- Reply to a report and/or change an issue's status (status: office only).
create or replace function public.respond_to_report(
  p_report uuid, p_body text, p_status public.report_status default null
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_status public.report_status;
  v_kind public.report_kind;
  v_body text := nullif(trim(p_body), '');
  v_new_status public.report_status;
  v_id uuid;
begin
  select r.status, r.kind into v_status, v_kind from public.reports r where r.id = p_report;
  if v_kind is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if p_status is not null and not app.is_staff() then
    raise exception 'Only MSW office users can change an issue''s status' using errcode = '42501';
  end if;
  if p_status is not null and v_kind <> 'issue' then
    raise exception 'Only issues have a status' using errcode = '22023';
  end if;
  v_new_status := case when p_status is distinct from v_status then p_status end;
  if v_body is null and v_new_status is null then
    raise exception 'Enter a response or choose a new status' using errcode = '22023';
  end if;

  insert into public.report_responses (report_id, author_id, author_name, body, status_from, status_to)
  values (p_report, auth.uid(), '-', v_body,
          case when v_new_status is not null then v_status end, v_new_status)
  returning id into v_id;

  if v_new_status is not null then
    update public.reports set status = v_new_status where id = p_report;
  end if;
  return v_id;
end;
$$;

-- Record that the current user opened/downloaded a revision they can see.
-- Repeated opens within ten minutes are collapsed.
create or replace function public.log_document_access(p_revision uuid, p_action text default 'viewed')
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := case when p_action = 'downloaded' then 'document.downloaded' else 'document.viewed' end;
  v_job uuid;
  v_label text;
  v_doc uuid;
begin
  if v_uid is null or not app.user_can_see_revision(v_uid, p_revision) then
    return false;
  end if;
  if exists (
    select 1 from public.activity_log l
    where l.entity_id = p_revision and l.action = v_action and l.actor_id = v_uid
      and l.created_at > now() - interval '10 minutes'
  ) then
    return true;
  end if;
  select d.job_id, d.id, d.doc_number || ' rev ' || r.revision into v_job, v_doc, v_label
  from public.document_revisions r join public.documents d on d.id = r.document_id
  where r.id = p_revision;
  perform app.write_activity(v_job, v_action, 'revision', p_revision,
    v_label || case when v_action = 'document.downloaded' then ' downloaded' else ' opened' end,
    jsonb_build_object('document_id', v_doc));
  return true;
end;
$$;

create or replace function public.touch_last_seen()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
$$;

revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(), app.now(),
  app.current_role(), app.is_staff(), app.is_admin(), app.my_company_id(),
  app.has_job_access(uuid), app.has_area_access(uuid, uuid), app.can_see_document(uuid),
  app.can_see_revision(uuid), app.can_see_report(uuid),
  app.can_see_report_row(uuid, uuid, uuid, uuid, boolean), app.is_my_assignment(uuid)
to authenticated;

revoke execute on function
  public.grant_job_access(uuid, uuid[], boolean, uuid[], date, date, text, boolean),
  public.revoke_job_access(uuid[]),
  public.approve_revision(uuid),
  public.withdraw_revision(uuid),
  public.set_document_areas(uuid, uuid[]),
  public.respond_to_report(uuid, text, public.report_status),
  public.log_document_access(uuid, text),
  public.touch_last_seen()
from public, anon;
grant execute on function
  public.grant_job_access(uuid, uuid[], boolean, uuid[], date, date, text, boolean),
  public.revoke_job_access(uuid[]),
  public.approve_revision(uuid),
  public.withdraw_revision(uuid),
  public.set_document_areas(uuid, uuid[]),
  public.respond_to_report(uuid, text, public.report_status),
  public.log_document_access(uuid, text),
  public.touch_last_seen()
to authenticated;
