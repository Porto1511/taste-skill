import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { UserError } from "../errors";
import { log } from "../log";
import type { Viewer } from "../auth/viewer";
import { processPhoto } from "./validate";
import type { IncomingFile } from "./uploads";

export const DECLARATION =
  "I confirm that the works described above have been inspected and are accepted as complete, and that the area is handed over from MSW UK Ltd in the condition shown.";

export const handoverInput = z.object({
  jobId: z.string().uuid(),
  areaId: z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable()),
  title: z.string().trim().min(3, "Say what is being handed over").max(160),
  scope: z.string().trim().max(4000).optional().transform((v) => v || null),
  checklist: z.array(z.object({ label: z.string().trim().min(1).max(200), checked: z.boolean() })).max(30),
  signerName: z.string().trim().min(2, "Enter the name of the person signing").max(120),
  signerCompany: z.string().trim().min(2, "Enter their company").max(160),
  signerPosition: z.string().trim().max(120).optional().transform((v) => v || null),
  signerEmail: z.string().trim().max(200).optional().transform((v) => v || null)
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email or leave it blank"),
});

/** Validate the drawn signature: a real PNG that actually contains ink. */
async function processSignature(bytes: Buffer): Promise<Buffer> {
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) throw new UserError("The signature could not be read. Please sign again.");
  try {
    const img = sharp(bytes, { failOn: "error" }).ensureAlpha();
    const { channels } = await img.stats();
    const alpha = channels[3];
    if (!alpha || alpha.max === 0) throw new UserError("The signature box is empty. Ask the contractor to sign.");
    const meta = await img.metadata();
    if ((meta.width ?? 0) > 3000 || (meta.height ?? 0) > 2000) throw new UserError("The signature image is too large.");
    return await sharp(bytes).ensureAlpha().trim({ threshold: 1 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  } catch (err) {
    if (err instanceof UserError) throw err;
    throw new UserError("The signature could not be read. Please sign again.");
  }
}

export async function createHandover(
  viewer: Viewer,
  input: z.infer<typeof handoverInput>,
  signature: IncomingFile,
  photos: { file: IncomingFile; caption: string | null }[],
) {
  if (photos.length > 8) throw new UserError("Attach up to 8 photos.");
  const sig = await processSignature(signature.bytes);
  const processed = await Promise.all(photos.map(async (p, i) => ({ ...(await processPhoto(p.file.bytes, `Photo ${i + 1}`)), caption: p.caption })));
  const written: string[] = [];
  const store = getFileStore();
  try {
    return await withUser(viewer.id, async (tx) => {
      const id = randomUUID();
      const sigPath = storagePaths.signature(input.jobId, id);
      await tx.query(
        `insert into handovers (id, job_id, area_id, title, scope, checklist, signer_name, signer_company, signer_position, signer_email,
           declaration, signature_path, captured_by, captured_by_name, captured_by_company)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, auth.uid(), '-', '-')`,
        [id, input.jobId, input.areaId, input.title, input.scope, JSON.stringify(input.checklist), input.signerName, input.signerCompany,
          input.signerPosition, input.signerEmail, DECLARATION, sigPath],
      );
      await store.put(sigPath, sig, "image/png");
      written.push(sigPath);
      for (const p of processed) {
        const photoId = randomUUID();
        const path = storagePaths.photo(input.jobId, photoId);
        await store.put(path, p.data, "image/jpeg");
        written.push(path);
        await tx.query(
          "insert into handover_photos (id, handover_id, storage_path, caption, file_size, width, height) values ($1,$2,$3,$4,$5,$6,$7)",
          [photoId, id, path, p.caption, p.data.length, p.width, p.height],
        );
      }
      log.info("handover.signed", { handoverId: id, jobId: input.jobId, userId: viewer.id, photos: processed.length });
      return { id, jobId: input.jobId };
    });
  } catch (err) {
    if (written.length) await store.remove(written).catch(() => {});
    throw err;
  }
}
