import "server-only";
import { randomUUID } from "node:crypto";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import { config } from "../config";
import { UserError } from "../errors";
import type { Viewer } from "../auth/viewer";
import type { z } from "zod";
import type { documentInput, reportInput, revisionInput } from "../validation";
import { assertPdf, processPhoto, safeFileName } from "./validate";

export interface IncomingFile {
  name: string;
  bytes: Buffer;
}

async function withFileCleanup<T>(fn: (track: (path: string) => void) => Promise<T>): Promise<T> {
  const written: string[] = [];
  try {
    return await fn((p) => written.push(p));
  } catch (err) {
    if (written.length) await getFileStore().remove(written).catch((e) => log.error("file.cleanup_failed", { err: e }));
    throw err;
  }
}

/** Submit a site report with photos.  The database decides (RLS) whether the user may report on this job/area. */
export async function createReport(
  viewer: Viewer,
  input: z.infer<typeof reportInput>,
  photos: { file: IncomingFile; caption: string | null }[],
) {
  if (photos.length > config.maxPhotosPerReport) throw new UserError(`Attach up to ${config.maxPhotosPerReport} photos.`);
  if (input.kind === "photo" && photos.length === 0) throw new UserError("Add at least one photo.");
  // Decode/sanitise every image before touching the database.
  const processed = await Promise.all(photos.map(async (p, i) => ({ ...(await processPhoto(p.file.bytes, `Photo ${i + 1}`)), caption: p.caption })));

  const title =
    input.title ??
    (input.kind === "progress"
      ? (input.description ?? "Progress update").split("\n")[0].slice(0, 120)
      : `Site photos (${processed.length})`);

  return withFileCleanup(async (track) =>
    withUser(viewer.id, async (tx) => {
      const { rows } = await tx.query<{ id: string; job_id: string }>(
        `insert into reports (job_id, area_id, kind, category, priority, title, description,
                              author_id, author_name, author_company_id, author_company_name)
         values ($1, $2, $3, $4, $5, $6, $7, auth.uid(), '-', $8, '-')
         returning id, job_id`,
        [input.jobId, input.areaId, input.kind, input.kind === "issue" ? input.category : null,
         input.kind === "issue" ? input.priority : "normal", title.length >= 3 ? title : `${title} update`,
         input.description, viewer.companyId],
      );
      const report = rows[0];
      for (const p of processed) {
        const photoId = randomUUID();
        const path = storagePaths.photo(report.job_id, photoId);
        await getFileStore().put(path, p.data, "image/jpeg");
        track(path);
        await tx.query(
          `insert into report_photos (id, report_id, storage_path, caption, mime_type, file_size, width, height, uploaded_by)
           values ($1, $2, $3, $4, 'image/jpeg', $5, $6, $7, auth.uid())`,
          [photoId, report.id, path, p.caption, p.data.length, p.width, p.height],
        );
      }
      log.info("report.created", { reportId: report.id, jobId: report.job_id, kind: input.kind, photos: processed.length, userId: viewer.id });
      return report;
    }),
  );
}

/** Create a drawing/RAMS record with its first revision (MSW office only — enforced by RLS). */
export async function createDocument(viewer: Viewer, input: z.infer<typeof documentInput>, file: IncomingFile) {
  assertPdf(file.bytes, "The file");
  return withFileCleanup(async (track) =>
    withUser(viewer.id, async (tx) => {
      const doc = (
        await tx.query<{ id: string }>(
          `insert into documents (job_id, kind, doc_number, title, description, created_by)
           values ($1, $2, $3, $4, $5, auth.uid()) returning id`,
          [input.jobId, input.kind, input.docNumber, input.title, input.description],
        )
      ).rows[0];
      if (input.areaIds.length) await tx.query("select public.set_document_areas($1, $2::uuid[])", [doc.id, input.areaIds]);
      const revisionId = await insertRevision(tx, viewer, input.jobId, doc.id, input, file, track);
      return { documentId: doc.id, revisionId };
    }),
  );
}

export async function addRevision(viewer: Viewer, input: z.infer<typeof revisionInput>, file: IncomingFile) {
  assertPdf(file.bytes, "The file");
  return withFileCleanup(async (track) =>
    withUser(viewer.id, async (tx) => {
      const doc = (await tx.query<{ job_id: string }>("select job_id from documents where id = $1", [input.documentId])).rows[0];
      if (!doc) throw new UserError("Document not found.", 404);
      const revisionId = await insertRevision(tx, viewer, doc.job_id, input.documentId, input, file, track);
      return { documentId: input.documentId, revisionId, jobId: doc.job_id };
    }),
  );
}

async function insertRevision(
  tx: Parameters<Parameters<typeof withUser>[1]>[0],
  viewer: Viewer,
  jobId: string,
  documentId: string,
  input: { revision: string; changeNote: string | null; approve: boolean },
  file: IncomingFile,
  track: (p: string) => void,
) {
  const revisionId = randomUUID();
  const path = storagePaths.revision(jobId, revisionId);
  await tx.query(
    `insert into document_revisions (id, document_id, revision, status, change_note, storage_path, file_name, file_size, mime_type, uploaded_by)
     values ($1, $2, $3, 'draft', $4, $5, $6, $7, 'application/pdf', auth.uid())`,
    [revisionId, documentId, input.revision, input.changeNote, path, safeFileName(file.name, `${input.revision}.pdf`), file.bytes.length],
  );
  await getFileStore().put(path, file.bytes, "application/pdf");
  track(path);
  if (input.approve) await tx.query("select public.approve_revision($1)", [revisionId]);
  log.info("revision.uploaded", { documentId, revisionId, approved: input.approve, userId: viewer.id });
  return revisionId;
}
