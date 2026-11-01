-- =============================================================================
-- MSW Site — access control
--
-- Model:
--   * MSW staff (admin, office) can see all operational data.
--   * Everyone else sees a job ONLY through an active, individual
--     job_assignments row.  Company membership never grants access.
--   * Within a job, documents/areas/reports are further limited to the areas
--     on the user's assignment (unless the assignment covers all areas).
--   * Only approved-for-use revisions are visible outside the office.
--   * Subcontractor managers see their company's reports on a job only when
--     can_view_company_reports is set on THEIR OWN assignment to that job.
--
-- Helper functions are SECURITY DEFINER so they can be used inside policies
-- without recursive RLS evaluation.  The user-parameterised internals are not
-- executable by API roles; only the auth.uid()-bound wrappers are.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internal, user-parameterised helpers (NOT granted to API roles)
-- ---------------------------------------------------------------------------
create or replace function app.user_role(p_user uuid)
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = p_user and p.active
$$;

create or replace function app.user_is_staff(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(app.user_role(p_user) in ('admin', 'office'), false)
$$;

create or replace function app.user_job_assignment(p_user uuid, p_job uuid)
returns public.job_assignments
language sql stable security definer set search_path = ''
as $$
  select a.*
  from public.job_assignments a
  join public.profiles p on p.id = a.user_id
  where a.job_id = p_job
    and a.user_id = p_user
    and a.revoked_at is null
    and p.active
  limit 1
$$;

create or replace function app.user_has_job_access(p_user uuid, p_job uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    or (app.user_job_assignment(p_user, p_job)).id is not null
  )
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

create or replace function app.user_can_see_document(p_user uuid, p_document uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    or exists (
      select 1
      from public.documents d
      where d.id = p_document
        and app.user_has_job_access(p_user, d.job_id)
        and (
          not exists (select 1 from public.document_areas da where da.document_id = d.id)
          or exists (
            select 1 from public.document_areas da
            where da.document_id = d.id
              and app.user_has_area_access(p_user, d.job_id, da.area_id)
          )
        )
    )
  )
$$;

create or replace function app.user_can_see_revision(p_user uuid, p_revision uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.document_revisions r
    where r.id = p_revision
      and (
        app.user_is_staff(p_user)
        or (r.status = 'approved' and app.user_can_see_document(p_user, r.document_id))
      )
  )
$$;

create or replace function app.user_can_see_report_row(
  p_user uuid,
  p_job uuid,
  p_area uuid,
  p_author uuid,
  p_author_company uuid,
  p_shared boolean
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and (
    app.user_is_staff(p_user)
    -- Authors see their own reports while they still hold access to the job.
    or (p_author = p_user and app.user_has_job_access(p_user, p_job))
    -- MSW may share a report (e.g. site photos) with the job team, respecting areas.
    or (
      p_shared
      and app.user_has_job_access(p_user, p_job)
      and (p_area is null or app.user_has_area_access(p_user, p_job, p_area))
    )
    -- Subcontractor manager with an explicit grant on THIS job, own company only.
    or exists (
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
$$;

create or replace function app.user_can_see_report(p_user uuid, p_report uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report
      and app.user_can_see_report_row(
        p_user, r.job_id, r.area_id, r.author_id, r.author_company_id, r.shared_with_team
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- auth.uid()-bound wrappers used by policies (granted to authenticated)
-- ---------------------------------------------------------------------------
create or replace function app.current_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select app.user_role(auth.uid()) $$;

create or replace function app.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_is_staff(auth.uid()) $$;

create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(app.user_role(auth.uid()) = 'admin', false) $$;

create or replace function app.my_company_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select p.company_id from public.profiles p where p.id = auth.uid() and p.active $$;

create or replace function app.has_job_access(p_job uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_has_job_access(auth.uid(), p_job) $$;

create or replace function app.has_area_access(p_job uuid, p_area uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_has_area_access(auth.uid(), p_job, p_area) $$;

create or replace function app.can_see_document(p_document uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_can_see_document(auth.uid(), p_document) $$;

create or replace function app.can_see_revision(p_revision uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_can_see_revision(auth.uid(), p_revision) $$;

create or replace function app.can_see_report(p_report uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.user_can_see_report(auth.uid(), p_report) $$;

create or replace function app.can_see_report_row(
  p_job uuid, p_area uuid, p_author uuid, p_author_company uuid, p_shared boolean
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.user_can_see_report_row(auth.uid(), p_job, p_area, p_author, p_author_company, p_shared)
$$;

create or replace function app.is_my_assignment(p_assignment uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.job_assignments a
    where a.id = p_assignment and a.user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.profiles           enable row level security;
alter table public.jobs               enable row level security;
alter table public.job_areas          enable row level security;
alter table public.job_assignments    enable row level security;
alter table public.assignment_areas   enable row level security;
alter table public.documents          enable row level security;
alter table public.document_areas     enable row level security;
alter table public.document_revisions enable row level security;
alter table public.reports            enable row level security;
alter table public.report_photos      enable row level security;
alter table public.report_responses   enable row level security;
alter table public.notifications      enable row level security;
alter table public.activity_log       enable row level security;

-- Companies
create policy companies_select on public.companies for select to authenticated
  using (app.is_staff() or id = app.my_company_id());
create policy companies_insert on public.companies for insert to authenticated
  with check (app.is_admin());
create policy companies_update on public.companies for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Profiles: users see themselves; MSW staff see the directory.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_staff());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (app.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- Jobs
create policy jobs_select on public.jobs for select to authenticated
  using (app.has_job_access(id));
create policy jobs_insert on public.jobs for insert to authenticated
  with check (app.is_staff());
create policy jobs_update on public.jobs for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- Areas: non-staff see only the areas they are allocated to.
create policy job_areas_select on public.job_areas for select to authenticated
  using (app.is_staff() or app.has_area_access(job_id, id));
create policy job_areas_write on public.job_areas for insert to authenticated
  with check (app.is_staff());
create policy job_areas_update on public.job_areas for update to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy job_areas_delete on public.job_areas for delete to authenticated
  using (app.is_staff());

-- Assignments: only MSW administrators change access.
create policy job_assignments_select on public.job_assignments for select to authenticated
  using (app.is_staff() or user_id = auth.uid());
create policy job_assignments_insert on public.job_assignments for insert to authenticated
  with check (app.is_admin());
create policy job_assignments_update on public.job_assignments for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy assignment_areas_select on public.assignment_areas for select to authenticated
  using (app.is_staff() or app.is_my_assignment(assignment_id));
create policy assignment_areas_insert on public.assignment_areas for insert to authenticated
  with check (app.is_admin());
create policy assignment_areas_delete on public.assignment_areas for delete to authenticated
  using (app.is_admin());

-- Documents
create policy documents_select on public.documents for select to authenticated
  using (app.can_see_document(id));
create policy documents_insert on public.documents for insert to authenticated
  with check (app.is_staff());
create policy documents_update on public.documents for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

create policy document_areas_select on public.document_areas for select to authenticated
  using (app.is_staff() or app.can_see_document(document_id));
create policy document_areas_insert on public.document_areas for insert to authenticated
  with check (app.is_staff());
create policy document_areas_delete on public.document_areas for delete to authenticated
  using (app.is_staff());

-- Revisions: outside the office, only approved-for-use revisions exist.
create policy document_revisions_select on public.document_revisions for select to authenticated
  using (app.is_staff() or (status = 'approved' and app.can_see_document(document_id)));
create policy document_revisions_insert on public.document_revisions for insert to authenticated
  with check (app.is_staff());
create policy document_revisions_update on public.document_revisions for update to authenticated
  using (app.is_staff()) with check (app.is_staff());
create policy document_revisions_delete on public.document_revisions for delete to authenticated
  using (app.is_staff() and status = 'draft');

-- Reports
create policy reports_select on public.reports for select to authenticated
  using (app.can_see_report_row(job_id, area_id, author_id, author_company_id, shared_with_team));
create policy reports_insert on public.reports for insert to authenticated
  with check (
    author_id = auth.uid()
    and app.has_job_access(job_id)
    and (area_id is null or app.has_area_access(job_id, area_id))
  );
create policy reports_update on public.reports for update to authenticated
  using (app.is_staff()) with check (app.is_staff());

create policy report_photos_select on public.report_photos for select to authenticated
  using (app.can_see_report(report_id));
create policy report_photos_insert on public.report_photos for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.author_id = auth.uid() or app.is_staff())
        and app.has_job_access(r.job_id)
    )
  );

create policy report_responses_select on public.report_responses for select to authenticated
  using (app.can_see_report(report_id));
create policy report_responses_insert on public.report_responses for insert to authenticated
  with check (
    author_id = auth.uid()
    and (status_to is null or app.is_staff())
    and (
      app.is_staff()
      or exists (
        select 1 from public.reports r
        where r.id = report_id and r.author_id = auth.uid() and app.has_job_access(r.job_id)
      )
    )
  );

-- Notifications: strictly personal
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Activity history: MSW staff only; written exclusively by triggers.
create policy activity_log_select on public.activity_log for select to authenticated
  using (app.is_staff());

-- ---------------------------------------------------------------------------
-- Privileges.  Anonymous users get nothing.  Authenticated users get the
-- minimum table privileges; RLS narrows them to rows.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.companies, public.profiles, public.jobs,
  public.job_assignments, public.documents, public.reports to authenticated;
grant select, insert, update, delete on public.job_areas to authenticated;
grant select, insert, delete on public.assignment_areas, public.document_areas to authenticated;
grant select, insert, update, delete on public.document_revisions to authenticated;
grant select, insert on public.report_photos, public.report_responses to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.activity_log to authenticated;

revoke all on schema app from public;
grant usage on schema app to authenticated;
revoke execute on all functions in schema app from public;
grant execute on function
  app.is_api_context(),
  app.now(),
  app.current_role(),
  app.is_staff(),
  app.is_admin(),
  app.my_company_id(),
  app.has_job_access(uuid),
  app.has_area_access(uuid, uuid),
  app.can_see_document(uuid),
  app.can_see_revision(uuid),
  app.can_see_report(uuid),
  app.can_see_report_row(uuid, uuid, uuid, uuid, boolean),
  app.is_my_assignment(uuid)
to authenticated;
