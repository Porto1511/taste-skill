import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface HandoverSummary {
  id: string; job_id: string; job_number: string; job_name: string; area_name: string | null; title: string;
  signer_name: string; signer_company: string; captured_by_name: string; signed_at: string; photo_count: number;
  scopes: string[]; area_id: string | null; signer_email: string | null; signer_position: string | null;
}
export interface HandoverDetail extends HandoverSummary {
  scope: string | null; checklist: { label: string; checked: boolean; section?: string }[];
  drawing_refs: { doc_number: string; title: string; revision: string }[];
  signer_position: string | null; signer_email: string | null; declaration: string; captured_by_company: string;
  signature_path: string; msw_signature_path: string | null; main_contractor: string | null; site_address: string;
  details: Record<string, Record<string, string>>; days_worked: string[]; week_commencing: string | null;
  photos: { id: string; caption: string | null; storage_path: string }[];
}

const summary = `select h.id, h.job_id, j.job_number, j.name as job_name, ar.name as area_name, h.area_id, h.scopes, h.title,
  h.signer_email, h.signer_position, h.signer_name, h.signer_company,
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
      `select h.id, h.job_id, j.job_number, j.name as job_name, ar.name as area_name, h.area_id, h.scopes, h.title, h.signer_name, h.signer_company,
              h.captured_by_name, h.signed_at, 0 as photo_count, h.scope, h.checklist, h.drawing_refs, h.signer_position, h.signer_email,
              h.declaration, h.captured_by_company, h.signature_path, h.msw_signature_path, j.main_contractor, j.site_address,
              h.details, h.days_worked, h.week_commencing
       from handovers h join jobs j on j.id = h.job_id left join job_areas ar on ar.id = h.area_id where h.id = $1`, [id],
    )).rows[0];
    if (!h) return null;
    const photos = (await tx.query<HandoverDetail["photos"][number]>(
      "select id, caption, storage_path from handover_photos where handover_id = $1 order by created_at, id", [id],
    )).rows;
    return { ...h, photos };
  });
}

// ---------------------------------------------------------------------------
// Daywork sheets
// ---------------------------------------------------------------------------
export interface DayworkSummary {
  id: string; job_id: string; job_number: string; job_name: string; week_commencing: string; description: string;
  work_complete: boolean; client_name: string; client_company: string; captured_by_name: string; captured_by_company: string;
  signed_at: string; total_hours: number; people: number;
}
export interface DayworkDetail extends DayworkSummary {
  workers: { name: string; trade: string; hours: Record<string, number> }[];
  materials: string | null; client_position: string | null; client_email: string | null;
  client_signature_path: string; msw_signature_path: string; main_contractor: string | null; site_address: string;
}

const dwSummary = `select d.id, d.job_id, j.job_number, j.name as job_name, d.week_commencing, d.description, d.work_complete,
  d.client_name, d.client_company, d.captured_by_name, d.captured_by_company, d.signed_at,
  coalesce((select sum((h.value)::numeric) from jsonb_array_elements(d.workers) w, jsonb_each_text(w->'hours') h), 0)::float as total_hours,
  jsonb_array_length(d.workers) as people
  from dayworks d join jobs j on j.id = d.job_id`;

export async function listDayworks(viewer: Viewer, jobId?: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<DayworkSummary>(`${dwSummary} ${jobId ? "where d.job_id = $1" : ""} order by d.signed_at desc limit 200`, jobId ? [jobId] : [])).rows,
  );
}

export async function getDaywork(viewer: Viewer, id: string): Promise<DayworkDetail | null> {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<DayworkDetail>(
      `select s.*, d.workers, d.materials, d.client_position, d.client_email, d.client_signature_path, d.msw_signature_path,
              j.main_contractor, j.site_address
       from (${dwSummary} where d.id = $1) s join dayworks d on d.id = s.id join jobs j on j.id = s.job_id`, [id],
    )).rows[0] ?? null,
  );
}

// ---------------------------------------------------------------------------
// Delivery notes
// ---------------------------------------------------------------------------
export interface DeliverySummary {
  id: string; job_id: string; job_number: string; job_name: string; delivered_by: string; vehicle_reg: string | null;
  receiver_name: string; receiver_company: string; captured_by_name: string; captured_by_company: string; signed_at: string;
  item_count: number; first_item: string | null; receiver_email: string | null; receiver_position: string | null;
}
export interface DeliveryDetail extends DeliverySummary {
  items: { description: string; quantity: string }[]; notes: string | null;
  receiver_signature_path: string; driver_signature_path: string; site_address: string; postcode: string | null; main_contractor: string | null;
}

const dlSummary = `select d.id, d.job_id, j.job_number, j.name as job_name, d.delivered_by, d.vehicle_reg, d.receiver_name, d.receiver_company,
  d.captured_by_name, d.captured_by_company, d.signed_at, jsonb_array_length(d.items) as item_count, d.items->0->>'description' as first_item,
  d.receiver_email, d.receiver_position
  from deliveries d join jobs j on j.id = d.job_id`;

export async function listDeliveries(viewer: Viewer, jobId?: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<DeliverySummary>(`${dlSummary} ${jobId ? "where d.job_id = $1" : ""} order by d.signed_at desc limit 200`, jobId ? [jobId] : [])).rows,
  );
}

export async function getDelivery(viewer: Viewer, id: string): Promise<DeliveryDetail | null> {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<DeliveryDetail>(
      `select s.*, d.items, d.notes, d.receiver_signature_path, d.driver_signature_path, j.site_address, j.postcode, j.main_contractor
       from (${dlSummary} where d.id = $1) s join deliveries d on d.id = s.id join jobs j on j.id = s.job_id`, [id],
    )).rows[0] ?? null,
  );
}
