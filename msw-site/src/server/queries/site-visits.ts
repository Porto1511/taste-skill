import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";
import type { Answer, VisitAction, VisitArea, VisitBlocker } from "@/lib/site-visit";

export interface SiteVisitSummary {
  id: string; job_id: string | null; job_number: string; job_name: string | null; site_address: string; visit_date: string;
  visit_type: string; ready: "yes" | "conditional" | "no"; visited_by_name: string; open_blockers: number; photo_count: number; proposed_start: string | null;
}
export interface SiteVisitDetail extends SiteVisitSummary {
  met_name: string | null; met_phone: string | null; areas: VisitArea[]; checklist: Record<string, { answer: Answer | null; note: string }>;
  blockers: VisitBlocker[]; conditions: string | null; men_needed: string | null; plant_needed: string | null; actions: VisitAction[];
  notes: string | null; created_at: string; photos: { id: string; storage_path: string; caption: string | null; width: number; height: number }[];
}

const summary = `select v.id, v.job_id, v.job_number, v.job_name, v.site_address, v.visit_date::text, v.visit_type, v.ready, v.visited_by_name,
  v.proposed_start::text,
  (select count(*)::int from jsonb_array_elements(v.blockers) b where b->>'cleared_at' is null) as open_blockers,
  (select count(*)::int from site_visit_photos p where p.visit_id = v.id) as photo_count
  from site_visits v`;

export async function listSiteVisits(viewer: Viewer, jobId?: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<SiteVisitSummary>(`${summary} ${jobId ? "where v.job_id = $1" : ""} order by v.visit_date desc, v.created_at desc limit 200`, jobId ? [jobId] : [])).rows);
}

export async function getSiteVisit(viewer: Viewer, id: string): Promise<SiteVisitDetail | null> {
  return withUser(viewer.id, async (tx) => {
    const v = (await tx.query<SiteVisitDetail>(
      `select s.*, v.met_name, v.met_phone, v.areas, v.checklist, v.blockers, v.conditions, v.men_needed, v.plant_needed, v.actions, v.notes, v.created_at
         from (${summary} where v.id = $1) s join site_visits v on v.id = s.id`, [id])).rows[0];
    if (!v) return null;
    v.photos = (await tx.query<SiteVisitDetail["photos"][number]>("select id, storage_path, caption, width, height from site_visit_photos where visit_id = $1 order by created_at", [id])).rows;
    return v;
  });
}
