import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import { UserError } from "../errors";
import type { Viewer } from "../auth/viewer";
import { processPhoto } from "./validate";
import { ANSWERS, AREA_STATUS, BLOCKER_OWNERS, BLOCKER_SEVERITY, CHECKLIST_KEYS, READY_OUTCOMES, VISIT_TYPES } from "@/lib/site-visit";

const ids = <T extends readonly { id: string }[]>(l: T) => l.map((x) => x.id) as [T[number]["id"], ...T[number]["id"][]];
const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const siteVisitInput = z.object({
  jobId: z.string().uuid().optional().nullable().transform((v) => v || null),
  jobNumber: z.string().trim().min(1, "Enter the job number").max(40),
  jobName: opt(160),
  siteAddress: z.string().trim().min(3, "Enter the site address").max(300),
  visitDate: date,
  visitType: z.enum(ids(VISIT_TYPES)),
  metName: opt(120),
  metPhone: opt(40),
  areas: z.array(z.object({
    name: z.string().trim().min(1).max(80), status: z.enum(ids(AREA_STATUS)),
    note: z.string().trim().max(500).default(""), expected: z.string().trim().max(60).default(""),
  })).max(40),
  checklist: z.record(z.string(), z.object({ answer: z.enum(ids(ANSWERS)).nullable(), note: z.string().trim().max(500).default("") }))
    .transform((c) => Object.fromEntries(Object.entries(c).filter(([k]) => CHECKLIST_KEYS.includes(k)))),
  blockers: z.array(z.object({
    text: z.string().trim().min(2).max(500), owner: z.enum(ids(BLOCKER_OWNERS)), severity: z.enum(ids(BLOCKER_SEVERITY)),
  })).max(40),
  ready: z.enum(ids(READY_OUTCOMES), { message: "Ready to start? Choose one." }),
  conditions: opt(2000),
  proposedStart: date.optional().nullable().or(z.literal("")).transform((v) => v || null),
  menNeeded: opt(200),
  plantNeeded: opt(500),
  actions: z.array(z.object({ what: z.string().trim().min(2).max(300), who: z.string().trim().max(80).default(""), by: z.string().trim().max(40).default("") })).max(40),
  notes: opt(4000),
});
export type SiteVisitInput = z.infer<typeof siteVisitInput>;

export async function createSiteVisit(viewer: Viewer, input: SiteVisitInput, photos: { bytes: Buffer; caption: string | null }[]) {
  if (!viewer.canSiteVisit) throw new UserError("Site visits are for the MSW office.", 403);
  if (photos.length > 30) throw new UserError("Attach up to 30 photos.");
  const processed: (Awaited<ReturnType<typeof processPhoto>> & { caption: string | null })[] = [];
  for (const [i, p] of photos.entries()) processed.push({ ...(await processPhoto(p.bytes, `Photo ${i + 1}`)), caption: p.caption });
  const store = getFileStore();
  const id = randomUUID();
  const written: string[] = [];
  try {
    await withUser(viewer.id, async (tx) => {
      await tx.query(
        `insert into site_visits (id, job_id, job_number, job_name, site_address, visit_date, visit_type, met_name, met_phone, areas, checklist,
           blockers, ready, conditions, proposed_start, men_needed, plant_needed, actions, notes, visited_by, visited_by_name)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18::jsonb,$19, auth.uid(), '-')`,
        [id, input.jobId, input.jobNumber, input.jobName, input.siteAddress, input.visitDate, input.visitType, input.metName, input.metPhone,
          JSON.stringify(input.areas), JSON.stringify(input.checklist), JSON.stringify(input.blockers.map((b) => ({ ...b, cleared_at: null }))),
          input.ready, input.conditions, input.proposedStart, input.menNeeded, input.plantNeeded, JSON.stringify(input.actions), input.notes],
      );
      for (const p of processed) {
        const photoId = randomUUID();
        const path = storagePaths.visitPhoto(id, photoId);
        await store.put(path, p.data, "image/jpeg");
        written.push(path);
        await tx.query("insert into site_visit_photos (id, visit_id, storage_path, caption, file_size, width, height) values ($1,$2,$3,$4,$5,$6,$7)",
          [photoId, id, path, p.caption, p.data.length, p.width, p.height]);
      }
    });
  } catch (err) {
    await store.remove(written).catch(() => {});
    throw err;
  }
  log.info("site_visit.recorded", { visitId: id, userId: viewer.id, photos: processed.length });
  return { id };
}

/** Add one photo to a visit (photos go up one at a time so no single upload is too big). */
export async function addVisitPhoto(viewer: Viewer, visitId: string, bytes: Buffer, caption: string | null) {
  if (!viewer.canSiteVisit) throw new UserError("Site visits are for the MSW office.", 403);
  const photo = await processPhoto(bytes, "The photo");
  const store = getFileStore();
  const photoId = randomUUID();
  const path = storagePaths.visitPhoto(visitId, photoId);
  await store.put(path, photo.data, "image/jpeg");
  try {
    await withUser(viewer.id, async (tx) => {
      const { rowCount } = await tx.query("select 1 from site_visits where id = $1", [visitId]);
      if (!rowCount) throw new UserError("Site visit not found.", 404);
      const { rows: [{ n }] } = await tx.query<{ n: number }>("select count(*)::int n from site_visit_photos where visit_id = $1", [visitId]);
      if (n >= 30) throw new UserError("A site visit can have up to 30 photos.");
      await tx.query("insert into site_visit_photos (id, visit_id, storage_path, caption, file_size, width, height) values ($1,$2,$3,$4,$5,$6,$7)",
        [photoId, visitId, path, caption, photo.data.length, photo.width, photo.height]);
    });
  } catch (err) {
    await store.remove([path]).catch(() => {});
    throw err;
  }
  return { id: photoId };
}

/** Mark a blocker cleared (or put it back). */
export async function setBlockerCleared(viewer: Viewer, visitId: string, index: number, cleared: boolean) {
  const { rowCount } = await withUser(viewer.id, (tx) =>
    tx.query(
      `update site_visits set blockers = jsonb_set(blockers, array[$2::text, 'cleared_at'], $3::jsonb)
        where id = $1 and $2::int < jsonb_array_length(blockers)`,
      [visitId, index, cleared ? JSON.stringify(new Date().toISOString()) : "null"],
    ),
  );
  if (!rowCount) throw new UserError("Site visit not found.", 404);
}

export async function deleteSiteVisit(viewer: Viewer, visitId: string) {
  const paths = await withUser(viewer.id, async (tx) => {
    const p = (await tx.query<{ storage_path: string }>("select storage_path from site_visit_photos where visit_id = $1", [visitId])).rows.map((r) => r.storage_path);
    const { rowCount } = await tx.query("delete from site_visits where id = $1", [visitId]);
    return rowCount ? p : null;
  });
  if (!paths) throw new UserError("Site visit not found.", 404);
  await getFileStore().remove(paths).catch(() => {});
}
