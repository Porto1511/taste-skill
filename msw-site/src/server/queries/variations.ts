import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface VariationSummary {
  id: string; job_id: string; job_number: string; job_name: string; area_name: string | null; description: string; requested_by: string;
  client_name: string; client_company: string; captured_by_name: string; captured_by_company: string; signed_at: string; photo_count: number;
}
export interface VariationDetail extends VariationSummary {
  operatives: string[]; operative_signer_name: string; operative_signature_path: string;
  client_position: string | null; client_email: string | null; client_signature_path: string;
  main_contractor: string | null; site_address: string;
  photos: { id: string; caption: string | null }[];
}

const summary = `select v.id, v.job_id, j.job_number, j.name as job_name, a.name as area_name, v.description, v.requested_by,
  v.client_name, v.client_company, v.captured_by_name, v.captured_by_company, v.signed_at,
  (select count(*)::int from variation_photos ph where ph.variation_id = v.id) as photo_count
  from variations v join jobs j on j.id = v.job_id left join job_areas a on a.id = v.area_id`;

/** RLS decides: the office sees all; the person who raised it; their company's manager. */
export async function listVariations(viewer: Viewer, jobId?: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<VariationSummary>(`${summary} ${jobId ? "where v.job_id = $1" : ""} order by v.signed_at desc limit 200`, jobId ? [jobId] : [])).rows,
  );
}

export async function getVariation(viewer: Viewer, id: string): Promise<VariationDetail | null> {
  return withUser(viewer.id, async (tx) => {
    const v = (await tx.query<Omit<VariationDetail, "photos">>(
      `select s.*, v.operatives, v.operative_signer_name, v.operative_signature_path, v.client_position, v.client_email, v.client_signature_path,
              j.main_contractor, j.site_address
       from (${summary} where v.id = $1) s join variations v on v.id = s.id join jobs j on j.id = s.job_id`, [id],
    )).rows[0];
    if (!v) return null;
    const photos = (await tx.query<{ id: string; caption: string | null }>(
      "select id, caption from variation_photos where variation_id = $1 order by created_at", [id])).rows;
    return { ...v, photos };
  });
}
