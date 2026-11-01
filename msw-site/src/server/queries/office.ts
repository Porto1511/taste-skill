import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";
import type { SiteReportSummary } from "./site";

/* MSW office reads.  RLS still applies (staff policies grant the access);
   pages additionally call requireStaff()/requireAdmin(). */

export type JobStatus = "planned" | "live" | "on_hold" | "complete";

export interface DashboardData {
  stats: { live_jobs: number; open_issues: number; urgent_open: number; reports_24h: number; drafts_pending: number; people_on_live_jobs: number };
  openIssues: (SiteReportSummary & { job_id: string; job_number: string; job_name: string })[];
  jobs: JobSummary[];
  activity: ActivityRow[];
}

export interface JobSummary {
  id: string; job_number: string; name: string; site_address: string; postcode: string | null; status: JobStatus;
  main_contractor: string | null; start_date: string | null; end_date: string | null;
  contracts_manager_name: string | null; people: number; companies: number; open_issues: number; urgent_issues: number;
  drafts: number; current_docs: number; last_activity_at: string | null;
}

export interface ActivityRow {
  id: number; job_id: string | null; job_number: string | null; actor_name: string | null; action: string;
  entity_type: string; entity_id: string | null; summary: string; created_at: string;
}

const jobSummarySql = `
  select j.id, j.job_number, j.name, j.site_address, j.postcode, j.status, j.main_contractor, j.start_date, j.end_date,
         cm.full_name as contracts_manager_name,
         (select count(*)::int from job_assignments a join profiles p on p.id = a.user_id and p.active
           where a.job_id = j.id and a.revoked_at is null) as people,
         (select count(distinct p.company_id)::int from job_assignments a join profiles p on p.id = a.user_id and p.active
           where a.job_id = j.id and a.revoked_at is null) as companies,
         (select count(*)::int from reports r where r.job_id = j.id and r.status in ('open', 'in_progress')) as open_issues,
         (select count(*)::int from reports r where r.job_id = j.id and r.status in ('open', 'in_progress')
            and (r.priority = 'urgent' or r.category = 'safety')) as urgent_issues,
         (select count(*)::int from document_revisions rv join documents d on d.id = rv.document_id
           where d.job_id = j.id and rv.status = 'draft') as drafts,
         (select count(*)::int from document_revisions rv join documents d on d.id = rv.document_id
           where d.job_id = j.id and rv.status = 'approved') as current_docs,
         (select max(l.created_at) from activity_log l where l.job_id = j.id) as last_activity_at
  from jobs j
  left join profiles cm on cm.id = j.contracts_manager_id`;

const activitySql = `
  select l.id, l.job_id, j.job_number, l.actor_name, l.action, l.entity_type, l.entity_id, l.summary, l.created_at
  from activity_log l left join jobs j on j.id = l.job_id`;

export async function getDashboard(viewer: Viewer): Promise<DashboardData> {
  return withUser(viewer.id, async (tx) => {
    const [stats, openIssues, jobs, activity] = await Promise.all([
      tx.query<DashboardData["stats"]>(
        `select
           (select count(*)::int from jobs where status = 'live') as live_jobs,
           (select count(*)::int from reports where status in ('open', 'in_progress')) as open_issues,
           (select count(*)::int from reports where status in ('open', 'in_progress') and (priority = 'urgent' or category = 'safety')) as urgent_open,
           (select count(*)::int from reports where created_at > now() - interval '24 hours') as reports_24h,
           (select count(*)::int from document_revisions where status = 'draft') as drafts_pending,
           (select count(distinct a.user_id)::int from job_assignments a join jobs j on j.id = a.job_id and j.status = 'live'
              join profiles p on p.id = a.user_id and p.active where a.revoked_at is null) as people_on_live_jobs`,
      ),
      tx.query<DashboardData["openIssues"][number]>(
        `select r.id, r.kind, r.category, r.priority, r.title, r.status, r.author_id, r.author_name, r.author_company_name,
                ar.name as area_name, r.created_at, r.shared_with_team, r.job_id, j.job_number, j.name as job_name,
                (select count(*)::int from report_photos p where p.report_id = r.id) as photo_count,
                (select count(*)::int from report_responses x where x.report_id = r.id) as response_count,
                (select max(x.created_at) from report_responses x where x.report_id = r.id and x.from_office) as last_office_reply_at
         from reports r join jobs j on j.id = r.job_id left join job_areas ar on ar.id = r.area_id
         where r.status in ('open', 'in_progress')
         order by case r.priority when 'urgent' then 0 when 'high' then 1 else 2 end,
                  case when r.category = 'safety' then 0 else 1 end, r.status, r.created_at
         limit 12`,
      ),
      tx.query<JobSummary>(`${jobSummarySql} where j.status in ('live', 'planned', 'on_hold')
        order by case j.status when 'live' then 0 when 'planned' then 1 else 2 end, j.job_number desc limit 50`),
      tx.query<ActivityRow>(`${activitySql} order by l.created_at desc, l.id desc limit 16`),
    ]);
    return { stats: stats.rows[0], openIssues: openIssues.rows, jobs: jobs.rows, activity: activity.rows };
  });
}

export async function listJobs(viewer: Viewer, opts: { q?: string; status?: string }): Promise<JobSummary[]> {
  return withUser(viewer.id, async (tx) => {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.q) {
      params.push(`%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      const i = params.length;
      where.push(`(j.job_number ilike $${i} or j.name ilike $${i} or j.site_address ilike $${i} or j.postcode ilike $${i} or j.main_contractor ilike $${i})`);
    }
    if (opts.status && ["planned", "live", "on_hold", "complete"].includes(opts.status)) {
      params.push(opts.status);
      where.push(`j.status = $${params.length}`);
    }
    const { rows } = await tx.query<JobSummary>(
      `${jobSummarySql} ${where.length ? `where ${where.join(" and ")}` : ""}
       order by case j.status when 'live' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end, j.job_number desc`,
      params,
    );
    return rows;
  });
}

export interface OfficeJob {
  job: {
    id: string; job_number: string; name: string; site_address: string; postcode: string | null; what3words: string | null;
    directions: string | null; main_contractor: string | null; site_contact_name: string | null; site_contact_role: string | null;
    site_contact_phone: string | null; start_date: string | null; end_date: string | null; induction_url: string | null;
    induction_notes: string | null; site_instructions: string | null; status: JobStatus; contracts_manager_id: string | null;
    created_at: string; updated_at: string;
  };
  areas: { id: string; name: string; kind: string; sort_order: number; people: number; documents: number; reports: number }[];
  staff: { id: string; full_name: string; job_title: string | null }[];
  summary: JobSummary;
}

export async function getOfficeJob(viewer: Viewer, jobId: string): Promise<OfficeJob | null> {
  return withUser(viewer.id, async (tx) => {
    const job = (await tx.query<OfficeJob["job"]>("select * from jobs where id = $1", [jobId])).rows[0];
    if (!job) return null;
    const [areas, staff, summary] = await Promise.all([
      tx.query<OfficeJob["areas"][number]>(
        `select ar.id, ar.name, ar.kind, ar.sort_order,
                (select count(*)::int from job_assignments a join profiles p on p.id = a.user_id and p.active
                  where a.job_id = ar.job_id and a.revoked_at is null
                    and (a.all_areas or exists (select 1 from assignment_areas aa where aa.assignment_id = a.id and aa.area_id = ar.id))) as people,
                (select count(*)::int from document_areas da where da.area_id = ar.id) as documents,
                (select count(*)::int from reports r where r.area_id = ar.id) as reports
         from job_areas ar where ar.job_id = $1 order by ar.sort_order, ar.name`,
        [jobId],
      ),
      tx.query<OfficeJob["staff"][number]>(
        "select id, full_name, job_title from profiles where role in ('admin', 'office') and active order by full_name",
      ),
      tx.query<JobSummary>(`${jobSummarySql} where j.id = $1`, [jobId]),
    ]);
    return { job, areas: areas.rows, staff: staff.rows, summary: summary.rows[0] };
  });
}

export interface OfficeRevision {
  id: string; revision: string; status: "draft" | "approved" | "superseded" | "withdrawn"; change_note: string | null;
  file_name: string; file_size: number; uploaded_at: string; uploaded_by_name: string | null; approved_at: string | null;
  approved_by_name: string | null; superseded_at: string | null; withdrawn_at: string | null; views: number;
}
export interface OfficeDocument {
  id: string; job_id: string; kind: "drawing" | "rams"; doc_number: string; title: string; description: string | null;
  areas: { id: string; name: string }[]; revisions: OfficeRevision[]; updated_at: string;
}

const officeDocumentSql = `
  select d.id, d.job_id, d.kind, d.doc_number, d.title, d.description, d.updated_at,
         coalesce((select json_agg(json_build_object('id', ar.id, 'name', ar.name) order by ar.sort_order)
                   from document_areas da join job_areas ar on ar.id = da.area_id where da.document_id = d.id), '[]'::json) as areas,
         coalesce((select json_agg(json_build_object(
                     'id', r.id, 'revision', r.revision, 'status', r.status, 'change_note', r.change_note,
                     'file_name', r.file_name, 'file_size', r.file_size, 'uploaded_at', r.uploaded_at,
                     'uploaded_by_name', up.full_name, 'approved_at', r.approved_at, 'approved_by_name', ap.full_name,
                     'superseded_at', r.superseded_at, 'withdrawn_at', r.withdrawn_at,
                     'views', (select count(distinct l.actor_id) from activity_log l
                               where l.entity_id = r.id and l.action in ('document.viewed', 'document.downloaded')))
                     order by r.uploaded_at desc)
                   from document_revisions r
                   left join profiles up on up.id = r.uploaded_by
                   left join profiles ap on ap.id = r.approved_by
                   where r.document_id = d.id), '[]'::json) as revisions
  from documents d`;

export async function listOfficeDocuments(viewer: Viewer, jobId: string): Promise<OfficeDocument[]> {
  return withUser(viewer.id, async (tx) => {
    const { rows } = await tx.query<OfficeDocument>(`${officeDocumentSql} where d.job_id = $1 order by d.kind, d.doc_number`, [jobId]);
    return rows;
  });
}

export interface DocumentReach { user_id: string; full_name: string; company_name: string; viewed_at: string | null }

export async function getOfficeDocument(viewer: Viewer, documentId: string) {
  return withUser(viewer.id, async (tx) => {
    const doc = (await tx.query<OfficeDocument>(`${officeDocumentSql} where d.id = $1`, [documentId])).rows[0];
    if (!doc) return null;
    const current = doc.revisions.find((r) => r.status === "approved");
    const [reach, areas] = await Promise.all([
      current
        ? tx.query<DocumentReach>("select * from public.document_reach($1)", [current.id])
        : Promise.resolve({ rows: [] as DocumentReach[] }),
      tx.query<{ id: string; name: string }>("select id, name from job_areas where job_id = $1 order by sort_order, name", [doc.job_id]),
    ]);
    return { doc, reach: reach.rows, jobAreas: areas.rows };
  });
}

export interface AccessAssignment {
  id: string; user_id: string; full_name: string; job_title: string | null; role: string; company_id: string; company_name: string;
  is_msw: boolean; all_areas: boolean; area_ids: string[]; area_names: string[]; attendance_from: string | null;
  attendance_to: string | null; note: string | null; can_view_company_reports: boolean; granted_at: string; updated_at: string;
  granted_by_name: string | null; user_active: boolean;
}
export interface AccessPerson { id: string; full_name: string; job_title: string | null; role: string; email: string }
export interface AccessCompany { id: string; name: string; is_msw: boolean; trade: string | null; people: AccessPerson[] }
export interface RevokedAssignment { id: string; full_name: string; company_name: string; granted_at: string; revoked_at: string; revoked_by_name: string | null; note: string | null }

export async function getJobAccess(viewer: Viewer, jobId: string) {
  return withUser(viewer.id, async (tx) => {
    const [areas, assignments, companies, revoked] = await Promise.all([
      tx.query<{ id: string; name: string; kind: string }>("select id, name, kind from job_areas where job_id = $1 order by sort_order, name", [jobId]),
      tx.query<AccessAssignment>(
        `select a.id, a.user_id, p.full_name, p.job_title, p.role, p.company_id, c.name as company_name, c.is_msw, a.all_areas,
                coalesce((select json_agg(aa.area_id) from assignment_areas aa where aa.assignment_id = a.id), '[]'::json) as area_ids,
                coalesce((select json_agg(ar.name order by ar.sort_order) from assignment_areas aa join job_areas ar on ar.id = aa.area_id
                          where aa.assignment_id = a.id), '[]'::json) as area_names,
                a.attendance_from, a.attendance_to, a.note, a.can_view_company_reports, a.granted_at, a.updated_at,
                g.full_name as granted_by_name, p.active as user_active
         from job_assignments a
         join profiles p on p.id = a.user_id
         join companies c on c.id = p.company_id
         left join profiles g on g.id = a.granted_by
         where a.job_id = $1 and a.revoked_at is null
         order by c.is_msw desc, c.name, p.full_name`,
        [jobId],
      ),
      tx.query<AccessCompany>(
        `select c.id, c.name, c.is_msw, c.trade,
                coalesce((select json_agg(json_build_object('id', p.id, 'full_name', p.full_name, 'job_title', p.job_title,
                                                            'role', p.role, 'email', p.email) order by p.full_name)
                          from profiles p where p.company_id = c.id and p.active and p.role in ('operative', 'manager')), '[]'::json) as people
         from companies c where c.active order by c.is_msw desc, c.name`,
      ),
      tx.query<RevokedAssignment>(
        `select a.id, p.full_name, c.name as company_name, a.granted_at, a.revoked_at, rb.full_name as revoked_by_name, a.note
         from job_assignments a join profiles p on p.id = a.user_id join companies c on c.id = p.company_id
         left join profiles rb on rb.id = a.revoked_by
         where a.job_id = $1 and a.revoked_at is not null order by a.revoked_at desc limit 30`,
        [jobId],
      ),
    ]);
    return { areas: areas.rows, assignments: assignments.rows, companies: companies.rows, revoked: revoked.rows };
  });
}

export type ReportFilter = { status?: string; kind?: string; jobId?: string; priority?: string };
export type OfficeReportRow = SiteReportSummary & { job_id: string; job_number: string; job_name: string };

export async function listOfficeReports(viewer: Viewer, f: ReportFilter): Promise<OfficeReportRow[]> {
  return withUser(viewer.id, async (tx) => {
    const where: string[] = [];
    const params: unknown[] = [];
    if (f.status === "active") where.push("r.status in ('open', 'in_progress')");
    else if (f.status && ["open", "in_progress", "resolved", "closed"].includes(f.status)) {
      params.push(f.status);
      where.push(`r.status = $${params.length}`);
    }
    if (f.kind && ["issue", "progress", "photo"].includes(f.kind)) {
      params.push(f.kind);
      where.push(`r.kind = $${params.length}`);
    }
    if (f.priority === "urgent") where.push("(r.priority = 'urgent' or r.category = 'safety')");
    if (f.jobId && /^[0-9a-f-]{36}$/.test(f.jobId)) {
      params.push(f.jobId);
      where.push(`r.job_id = $${params.length}`);
    }
    const { rows } = await tx.query<OfficeReportRow>(
      `select r.id, r.kind, r.category, r.priority, r.title, r.status, r.author_id, r.author_name, r.author_company_name,
              ar.name as area_name, r.created_at, r.shared_with_team, r.job_id, j.job_number, j.name as job_name,
              (select count(*)::int from report_photos p where p.report_id = r.id) as photo_count,
              (select count(*)::int from report_responses x where x.report_id = r.id) as response_count,
              (select max(x.created_at) from report_responses x where x.report_id = r.id and x.from_office) as last_office_reply_at
       from reports r join jobs j on j.id = r.job_id left join job_areas ar on ar.id = r.area_id
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by case when r.status in ('open', 'in_progress') then 0 else 1 end,
                case r.priority when 'urgent' then 0 when 'high' then 1 else 2 end, r.created_at desc
       limit 200`,
      params,
    );
    return rows;
  });
}

export interface PersonRow {
  id: string; full_name: string; email: string; phone: string | null; job_title: string | null; role: string; active: boolean;
  company_id: string; company_name: string; is_msw: boolean; last_seen_at: string | null; job_count: number; job_numbers: string[];
}

export async function listPeople(viewer: Viewer, opts: { companyId?: string; q?: string } = {}): Promise<PersonRow[]> {
  return withUser(viewer.id, async (tx) => {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.companyId && /^[0-9a-f-]{36}$/.test(opts.companyId)) {
      params.push(opts.companyId);
      where.push(`p.company_id = $${params.length}`);
    }
    if (opts.q) {
      params.push(`%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      where.push(`(p.full_name ilike $${params.length} or p.email ilike $${params.length})`);
    }
    const { rows } = await tx.query<PersonRow>(
      `select p.id, p.full_name, p.email, p.phone, p.job_title, p.role, p.active, p.company_id, c.name as company_name, c.is_msw,
              p.last_seen_at,
              (select count(*)::int from job_assignments a where a.user_id = p.id and a.revoked_at is null) as job_count,
              coalesce((select json_agg(j.job_number order by j.job_number) from job_assignments a join jobs j on j.id = a.job_id
                        where a.user_id = p.id and a.revoked_at is null), '[]'::json) as job_numbers
       from profiles p join companies c on c.id = p.company_id
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by c.is_msw desc, c.name, p.active desc, p.full_name`,
      params,
    );
    return rows;
  });
}

export interface CompanyRow {
  id: string; name: string; is_msw: boolean; trade: string | null; contact_name: string | null; contact_phone: string | null;
  contact_email: string | null; active: boolean; people: number; active_people: number; live_jobs: number;
}

export async function listCompanies(viewer: Viewer): Promise<CompanyRow[]> {
  return withUser(viewer.id, async (tx) => {
    const { rows } = await tx.query<CompanyRow>(
      `select c.*,
              (select count(*)::int from profiles p where p.company_id = c.id) as people,
              (select count(*)::int from profiles p where p.company_id = c.id and p.active) as active_people,
              (select count(distinct a.job_id)::int from job_assignments a join profiles p on p.id = a.user_id
                 join jobs j on j.id = a.job_id where p.company_id = c.id and a.revoked_at is null and j.status = 'live') as live_jobs
       from companies c order by c.is_msw desc, c.active desc, c.name`,
    );
    return rows;
  });
}

export async function getPerson(viewer: Viewer, personId: string) {
  return withUser(viewer.id, async (tx) => {
    const person = (
      await tx.query<PersonRow & { invited_at: string | null; created_at: string }>(
        `select p.*, c.name as company_name, c.is_msw, 0 as job_count, '[]'::json as job_numbers
         from profiles p join companies c on c.id = p.company_id where p.id = $1`,
        [personId],
      )
    ).rows[0];
    if (!person) return null;
    const [assignments, activity, companies] = await Promise.all([
      tx.query<{
        id: string; job_id: string; job_number: string; job_name: string; job_status: JobStatus; all_areas: boolean; area_names: string[];
        attendance_from: string | null; attendance_to: string | null; granted_at: string; revoked_at: string | null; can_view_company_reports: boolean;
      }>(
        `select a.id, a.job_id, j.job_number, j.name as job_name, j.status as job_status, a.all_areas,
                coalesce((select json_agg(ar.name order by ar.sort_order) from assignment_areas aa join job_areas ar on ar.id = aa.area_id
                          where aa.assignment_id = a.id), '[]'::json) as area_names,
                a.attendance_from, a.attendance_to, a.granted_at, a.revoked_at, a.can_view_company_reports
         from job_assignments a join jobs j on j.id = a.job_id where a.user_id = $1
         order by (a.revoked_at is null) desc, a.granted_at desc`,
        [personId],
      ),
      tx.query<ActivityRow>(`${activitySql} where l.actor_id = $1 or (l.entity_id = $1) order by l.created_at desc limit 25`, [personId]),
      tx.query<{ id: string; name: string; is_msw: boolean }>("select id, name, is_msw from companies where active order by is_msw desc, name"),
    ]);
    return { person, assignments: assignments.rows, activity: activity.rows, companies: companies.rows };
  });
}

export async function listActivity(viewer: Viewer, opts: { jobId?: string; before?: number; limit?: number; scope?: string } = {}) {
  return withUser(viewer.id, async (tx) => {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.jobId) {
      params.push(opts.jobId);
      where.push(`l.job_id = $${params.length}`);
    }
    if (opts.before) {
      params.push(opts.before);
      where.push(`l.id < $${params.length}`);
    }
    const scopes: Record<string, string> = {
      access: "l.action like 'access.%'",
      documents: "(l.action like 'revision.%' or l.action like 'document.%')",
      reports: "l.action like 'report.%'",
      people: "(l.action like 'user.%' or l.action like 'company.%')",
      jobs: "(l.action like 'job.%' or l.action like 'area.%')",
    };
    if (opts.scope && scopes[opts.scope]) where.push(scopes[opts.scope]);
    params.push(opts.limit ?? 50);
    const { rows } = await tx.query<ActivityRow>(
      `${activitySql} ${where.length ? `where ${where.join(" and ")}` : ""} order by l.id desc limit $${params.length}`,
      params,
    );
    return rows;
  });
}

export async function listJobOptions(viewer: Viewer) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<{ id: string; job_number: string; name: string; status: JobStatus }>(
      "select id, job_number, name, status from jobs order by case status when 'live' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end, job_number desc",
    )).rows,
  );
}

export async function countActiveReports(viewer: Viewer) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<{ n: number; urgent: number }>(
      `select count(*)::int as n,
              count(*) filter (where priority = 'urgent' or category = 'safety')::int as urgent
       from reports where status in ('open', 'in_progress')`,
    )).rows[0],
  );
}
