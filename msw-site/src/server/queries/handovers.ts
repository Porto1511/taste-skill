import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface HandoverSummary {
  id: string; job_id: string; job_number: string; job_name: string; area_name: string | null; title: string;
  signer_name: string; signer_company: string; captured_by_name: string; signed_at: string; photo_count: number;
}
export interface HandoverDetail extends HandoverSummary {
  scope: string | null; checklist: { label: string; checked: boolean }[];
  drawing_refs: { doc_number: string; title: string; revision: string }[];
  signer_position: string | null; signer_email: string | null; declaration: string; captured_by_company: string;
  signature_path: string; main_contractor: string | null; site_address: string;
  photos: { id: string; caption: string | null; storage_path: string }[];
}

const summary = `select h.id, h.job_id, j.job_number, j.name as job_name, ar.name as area_name, h.title, h.signer_name, h.signer_company,
  h.captured_by_name, h.signed_at, (select count(*)::int from handover_photos hp where hp.handover_id = h.id) as photo_count
  from handovers h join jobs j on j.id = h.job_id left join job_areas ar on ar.id = h.area_id`;

export async function listHandovers(viewer: Viewer, jobId?: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<HandoverSummary>(`${summary} ${jobId ? "where h.job_id = $1" : ""} order by h.signed_at desc limit 200`, jobId ? [jobId] : [])).rows,
  );
}

export async function getHandover(viewer: Viewer, id: string): Promise<HandoverDetail | null> {
  return withUser(viewer.id, async (tx) => {
    const h = (await tx.query<Omit<HandoverDetail, "photos">>(
      `select h.id, h.job_id, j.job_number, j.name as job_name, ar.name as area_name, h.title, h.signer_name, h.signer_company,
              h.captured_by_name, h.signed_at, 0 as photo_count, h.scope, h.checklist, h.drawing_refs, h.signer_position, h.signer_email,
              h.declaration, h.captured_by_company, h.signature_path, j.main_contractor, j.site_address
       from handovers h join jobs j on j.id = h.job_id left join job_areas ar on ar.id = h.area_id where h.id = $1`, [id],
    )).rows[0];
    if (!h) return null;
    const photos = (await tx.query<HandoverDetail["photos"][number]>(
      "select id, caption, storage_path from handover_photos where handover_id = $1 order by created_at, id", [id],
    )).rows;
    return { ...h, photos };
  });
}
