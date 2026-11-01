import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

/* Operative / site-facing reads.  Every query runs as the viewer under RLS:
   rows the user may not see simply do not exist for these queries. */

export interface MyJob {
  id: string;
  job_number: string;
  name: string;
  site_address: string;
  postcode: string | null;
  status: "planned" | "live" | "on_hold" | "complete";
  start_date: string | null;
  end_date: string | null;
  all_areas: boolean | null;
  attendance_from: string | null;
  attendance_to: string | null;
  note: string | null;
  area_names: string[];
  recent_updates: number;
  unread: number;
  open_reports: number;
}

export async function listMyJobs(viewer: Viewer): Promise<MyJob[]> {
  return withUser(viewer.id, async (tx) => {
    const { rows } = await tx.query<MyJob>(
      `select j.id, j.job_number, j.name, j.site_address, j.postcode, j.status, j.start_date, j.end_date,
              a.all_areas, a.attendance_from, a.attendance_to, a.note,
              coalesce((select json_agg(ar.name order by ar.sort_order, ar.name)
                        from job_areas ar where ar.job_id = j.id), '[]'::json) as area_names,
              (select count(*)::int from documents d
                 join document_revisions r on r.document_id = d.id and r.status = 'approved'
                where d.job_id = j.id and r.approved_at > now() - interval '7 days') as recent_updates,
              (select count(*)::int from notifications n where n.job_id = j.id and n.read_at is null) as unread,
              (select count(*)::int from reports rp
                where rp.job_id = j.id and rp.author_id = auth.uid() and rp.status in ('open', 'in_progress')) as open_reports
       from jobs j
       left join job_assignments a on a.job_id = j.id and a.user_id = auth.uid() and a.revoked_at is null
       order by case j.status when 'live' then 0 when 'planned' then 1 when 'on_hold' then 2 else 3 end,
                j.start_date nulls last, j.name`,
    );
    return rows;
  });
}

export interface SiteArea { id: string; name: string; kind: string }
export interface SiteDocument {
  id: string;
  kind: "drawing" | "rams";
  doc_number: string;
  title: string;
  revision_id: string;
  revision: string;
  approved_at: string;
  change_note: string | null;
  file_size: number;
  areas: SiteArea[];
}
export interface SiteReportSummary {
  id: string;
  kind: "issue" | "progress" | "photo";
  category: string | null;
  priority: "normal" | "high" | "urgent";
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed" | null;
  author_id: string;
  author_name: string;
  author_company_name: string;
  area_name: string | null;
  created_at: string;
  shared_with_team: boolean;
  photo_count: number;
  response_count: number;
  last_office_reply_at: string | null;
}
export interface SitePhoto { id: string; caption: string | null; report_id: string; report_title: string; created_at: string; area_name: string | null }

export interface SiteJob {
  job: {
    id: string; job_number: string; name: string; site_address: string; postcode: string | null;
    what3words: string | null; directions: string | null; main_contractor: string | null;
    site_contact_name: string | null; site_contact_role: string | null; site_contact_phone: string | null;
    start_date: string | null; end_date: string | null; induction_url: string | null; induction_notes: string | null;
    site_instructions: string | null; status: MyJob["status"]; updated_at: string;
  };
  assignment: { all_areas: boolean; attendance_from: string | null; attendance_to: string | null; note: string | null; can_view_company_reports: boolean } | null;
  areas: SiteArea[];
  office: { full_name: string; job_title: string | null; phone: string | null; email: string } | null;
  documents: SiteDocument[];
  reports: SiteReportSummary[];
  photos: SitePhoto[];
}

const reportSummarySql = `
  select r.id, r.kind, r.category, r.priority, r.title, r.status, r.author_id, r.author_name, r.author_company_name,
         ar.name as area_name, r.created_at, r.shared_with_team,
         (select count(*)::int from report_photos p where p.report_id = r.id) as photo_count,
         (select count(*)::int from report_responses x where x.report_id = r.id) as response_count,
         (select max(x.created_at) from report_responses x where x.report_id = r.id and x.from_office) as last_office_reply_at
  from reports r
  left join job_areas ar on ar.id = r.area_id`;

export async function getSiteJob(viewer: Viewer, jobId: string): Promise<SiteJob | null> {
  return withUser(viewer.id, async (tx) => {
    const job = (
      await tx.query<SiteJob["job"]>(
        `select id, job_number, name, site_address, postcode, what3words, directions, main_contractor,
                site_contact_name, site_contact_role, site_contact_phone, start_date, end_date, induction_url,
                induction_notes, site_instructions, status, updated_at
         from jobs where id = $1`,
        [jobId],
      )
    ).rows[0];
    if (!job) return null;

    const [assignment, areas, office, documents, reports, photos] = await Promise.all([
      tx.query<NonNullable<SiteJob["assignment"]>>(
        `select all_areas, attendance_from, attendance_to, note, can_view_company_reports
         from job_assignments where job_id = $1 and user_id = auth.uid() and revoked_at is null`,
        [jobId],
      ),
      tx.query<SiteArea>("select id, name, kind from job_areas where job_id = $1 order by sort_order, name", [jobId]),
      tx.query<NonNullable<SiteJob["office"]>>("select * from public.job_office_contact($1)", [jobId]),
      tx.query<SiteDocument>(
        `select d.id, d.kind, d.doc_number, d.title, r.id as revision_id, r.revision, r.approved_at, r.change_note, r.file_size,
                coalesce((select json_agg(json_build_object('id', ar.id, 'name', ar.name, 'kind', ar.kind) order by ar.sort_order)
                          from document_areas da join job_areas ar on ar.id = da.area_id
                          where da.document_id = d.id), '[]'::json) as areas
         from documents d
         join document_revisions r on r.document_id = d.id and r.status = 'approved'
         where d.job_id = $1
         order by d.kind, d.doc_number`,
        [jobId],
      ),
      tx.query<SiteReportSummary>(`${reportSummarySql} where r.job_id = $1 order by r.created_at desc limit 50`, [jobId]),
      tx.query<SitePhoto>(
        `select p.id, p.caption, p.report_id, r.title as report_title, p.created_at, ar.name as area_name
         from report_photos p join reports r on r.id = p.report_id left join job_areas ar on ar.id = r.area_id
         where r.job_id = $1 order by p.created_at desc limit 60`,
        [jobId],
      ),
    ]);
    return {
      job,
      assignment: assignment.rows[0] ?? null,
      areas: areas.rows,
      office: office.rows[0] ?? null,
      documents: documents.rows,
      reports: reports.rows,
      photos: photos.rows,
    };
  });
}

export interface SiteDocumentView {
  document: { id: string; job_id: string; kind: "drawing" | "rams"; doc_number: string; title: string; description: string | null };
  job: { id: string; job_number: string; name: string };
  current: { id: string; revision: string; approved_at: string; change_note: string | null; file_name: string; file_size: number } | null;
  areas: SiteArea[];
}

export async function getSiteDocument(viewer: Viewer, jobId: string, documentId: string): Promise<SiteDocumentView | null> {
  return withUser(viewer.id, async (tx) => {
    const document = (
      await tx.query<SiteDocumentView["document"]>(
        "select id, job_id, kind, doc_number, title, description from documents where id = $1 and job_id = $2",
        [documentId, jobId],
      )
    ).rows[0];
    if (!document) return null;
    const [job, current, areas] = await Promise.all([
      tx.query<SiteDocumentView["job"]>("select id, job_number, name from jobs where id = $1", [jobId]),
      tx.query<NonNullable<SiteDocumentView["current"]>>(
        `select id, revision, approved_at, change_note, file_name, file_size
         from document_revisions where document_id = $1 and status = 'approved'`,
        [documentId],
      ),
      tx.query<SiteArea>(
        `select ar.id, ar.name, ar.kind from document_areas da join job_areas ar on ar.id = da.area_id
         where da.document_id = $1 order by ar.sort_order`,
        [documentId],
      ),
    ]);
    return { document, job: job.rows[0], current: current.rows[0] ?? null, areas: areas.rows };
  });
}

export interface ReportDetail {
  report: SiteReportSummary & { job_id: string; description: string | null; area_id: string | null; resolved_at: string | null; updated_at: string };
  job: { id: string; job_number: string; name: string };
  photos: { id: string; caption: string | null; width: number | null; height: number | null }[];
  responses: { id: string; author_name: string; from_office: boolean; body: string | null; status_from: string | null; status_to: string | null; created_at: string }[];
}

export async function getReportDetail(viewer: Viewer, reportId: string): Promise<ReportDetail | null> {
  return withUser(viewer.id, async (tx) => {
    const report = (
      await tx.query<ReportDetail["report"]>(
        `select r.id, r.job_id, r.kind, r.category, r.priority, r.title, r.description, r.status, r.author_id, r.author_name,
                r.author_company_name, r.area_id, ar.name as area_name, r.created_at, r.updated_at, r.resolved_at,
                r.shared_with_team, 0 as photo_count, 0 as response_count, null as last_office_reply_at
         from reports r left join job_areas ar on ar.id = r.area_id where r.id = $1`,
        [reportId],
      )
    ).rows[0];
    if (!report) return null;
    const [job, photos, responses] = await Promise.all([
      tx.query<ReportDetail["job"]>("select id, job_number, name from jobs where id = $1", [report.job_id]),
      tx.query<ReportDetail["photos"][number]>(
        "select id, caption, width, height from report_photos where report_id = $1 order by created_at, id",
        [reportId],
      ),
      tx.query<ReportDetail["responses"][number]>(
        `select id, author_name, from_office, body, status_from, status_to, created_at
         from report_responses where report_id = $1 order by created_at, id`,
        [reportId],
      ),
    ]);
    return { report, job: job.rows[0], photos: photos.rows, responses: responses.rows };
  });
}

export interface NotificationRow {
  id: string; kind: string; title: string; body: string | null; href: string | null; job_id: string | null;
  created_at: string; read_at: string | null; job_number: string | null;
}

export async function listNotifications(viewer: Viewer, limit = 60): Promise<NotificationRow[]> {
  return withUser(viewer.id, async (tx) => {
    const { rows } = await tx.query<NotificationRow>(
      `select n.id, n.kind, n.title, n.body, n.href, n.job_id, n.created_at, n.read_at, j.job_number
       from notifications n left join jobs j on j.id = n.job_id
       where n.user_id = auth.uid()
       order by n.created_at desc limit $1`,
      [limit],
    );
    return rows;
  });
}

export interface RevisionView {
  id: string; revision: string; status: "draft" | "approved" | "superseded" | "withdrawn"; change_note: string | null;
  uploaded_at: string; approved_at: string | null; document_id: string; doc_number: string; title: string;
  kind: "drawing" | "rams"; job_id: string; job_number: string; job_name: string; current_revision_id: string | null;
}

/** Any revision the viewer may see (office: all; others: approved only — enforced by RLS). */
export async function getRevisionView(viewer: Viewer, revisionId: string): Promise<RevisionView | null> {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<RevisionView>(
      `select r.id, r.revision, r.status, r.change_note, r.uploaded_at, r.approved_at, d.id as document_id, d.doc_number, d.title,
              d.kind, j.id as job_id, j.job_number, j.name as job_name,
              (select c.id from document_revisions c where c.document_id = d.id and c.status = 'approved') as current_revision_id
       from document_revisions r join documents d on d.id = r.document_id join jobs j on j.id = d.job_id
       where r.id = $1`,
      [revisionId],
    )).rows[0] ?? null,
  );
}
