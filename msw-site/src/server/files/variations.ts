import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import { UserError } from "../errors";
import type { Viewer } from "../auth/viewer";
import { processPhoto } from "./validate";
import type { IncomingFile } from "./uploads";
import { processSignature } from "./handovers";

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const variationInput = z.object({
  jobId: z.string().uuid(),
  areaId: z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable()),
  description: z.string().trim().min(3, "Say what the client has asked for").max(4000),
  requestedBy: z.string().trim().min(2, "Who asked for it?").max(120),
  operatives: z.array(z.string().trim().min(2).max(120)).min(1, "Put the names of the lads doing it").max(20),
  operativeName: z.string().trim().min(2, "Print the name of the person signing").max(120),
  clientName: z.string().trim().min(2, "The client needs to print their name").max(120),
  clientCompany: z.string().trim().min(2, "Enter the client's company").max(160),
  clientPosition: optText(120),
  clientEmail: z.string().trim().max(200).optional().transform((v) => v || null)
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email or leave it blank"),
});

export const MAX_VARIATION_PHOTOS = 8;

/** Save a signed variation with its photos. Anyone on the job can raise one (RLS). */
export async function createVariation(
  viewer: Viewer, input: z.infer<typeof variationInput>,
  signatures: { client: IncomingFile; operative: IncomingFile }, photos: { bytes: Buffer; caption: string | null }[],
) {
  if (photos.length > MAX_VARIATION_PHOTOS) throw new UserError(`Up to ${MAX_VARIATION_PHOTOS} photos.`);
  const clientSig = await processSignature(signatures.client.bytes, "client");
  const opSig = await processSignature(signatures.operative.bytes, "operative's");
  const processed = await Promise.all(photos.map(async (p, i) => ({ ...(await processPhoto(p.bytes, `Photo ${i + 1}`)), caption: p.caption })));
  const store = getFileStore();
  const written: string[] = [];
  try {
    return await withUser(viewer.id, async (tx) => {
      const id = randomUUID();
      const clientPath = storagePaths.signature(input.jobId, randomUUID());
      const opPath = storagePaths.signature(input.jobId, randomUUID());
      await tx.query(
        `insert into variations (id, job_id, area_id, description, requested_by, operatives, operative_signer_name, operative_signature_path,
           client_name, client_position, client_company, client_email, client_signature_path,
           captured_by, captured_by_name, captured_by_company, captured_by_company_id)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13, auth.uid(), '-', '-', (select company_id from profiles where id = auth.uid()))`,
        [id, input.jobId, input.areaId, input.description, input.requestedBy, JSON.stringify(input.operatives), input.operativeName, opPath,
          input.clientName, input.clientPosition, input.clientCompany, input.clientEmail, clientPath],
      );
      await store.put(clientPath, clientSig, "image/png"); written.push(clientPath);
      await store.put(opPath, opSig, "image/png"); written.push(opPath);
      for (const ph of processed) {
        const photoId = randomUUID();
        const path = storagePaths.photo(input.jobId, photoId);
        await store.put(path, ph.data, "image/jpeg"); written.push(path);
        await tx.query("insert into variation_photos (id, variation_id, storage_path, caption, file_size, width, height) values ($1,$2,$3,$4,$5,$6,$7)",
          [photoId, id, path, ph.caption, ph.data.length, ph.width, ph.height]);
      }
      log.info("variation.signed", { variationId: id, jobId: input.jobId, userId: viewer.id, photos: processed.length });
      return { id, jobId: input.jobId };
    });
  } catch (err) {
    if (written.length) await store.remove(written).catch(() => {});
    throw err;
  }
}
