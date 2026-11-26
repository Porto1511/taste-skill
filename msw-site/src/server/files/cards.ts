import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import { UserError } from "../errors";
import type { Viewer } from "../auth/viewer";
import { assertPdf, processPhoto, safeFileName } from "./validate";

export const cardInput = z.object({
  userId: z.string().uuid(),
  cardType: z.string().trim().min(2, "Say what the card is, e.g. CSCS card").max(80),
  cardNumber: z.string().trim().max(80).optional().transform((v) => v || null),
  expiresOn: z.string().optional().transform((v) => v || null)
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the expiry date or leave it blank").nullable()),
});

const isPdf = (b: Buffer) => b.subarray(0, 1024).toString("latin1").includes("%PDF-");

/**
 * File a card or ticket (a photo of it, or a PDF) on someone's profile.
 * Their boss or the MSW office can; RLS refuses everyone else.
 */
export async function uploadCard(viewer: Viewer, input: z.infer<typeof cardInput>, file: { name: string; bytes: Buffer }) {
  let data: Buffer;
  let mime: "application/pdf" | "image/jpeg";
  let ext: "pdf" | "jpg";
  if (isPdf(file.bytes)) {
    assertPdf(file.bytes, file.name || "The file");
    data = file.bytes; mime = "application/pdf"; ext = "pdf";
  } else {
    data = (await processPhoto(file.bytes, "The card photo")).data; mime = "image/jpeg"; ext = "jpg";
  }
  const companyId = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ company_id: string }>("select company_id from profiles where id = $1", [input.userId])).rows[0]?.company_id,
  );
  if (!companyId) throw new UserError("Person not found.", 404);
  const id = randomUUID();
  const path = storagePaths.card(companyId, id, ext);
  const store = getFileStore();
  await store.put(path, data, mime);
  try {
    await withUser(viewer.id, (tx) =>
      tx.query(
        `insert into operative_cards (id, user_id, company_id, card_type, card_number, expires_on, file_name, file_size, mime_type, storage_path)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, input.userId, companyId, input.cardType, input.cardNumber, input.expiresOn,
          safeFileName(file.name, `card.${ext}`).replace(/\.[^.]+$/, `.${ext}`), data.length, mime, path],
      ),
    );
  } catch (err) {
    await store.remove([path]).catch(() => {});
    throw err;
  }
  log.info("card.uploaded", { cardId: id, userId: input.userId, by: viewer.id });
  return { id };
}

export async function deleteCard(viewer: Viewer, id: string) {
  const path = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ storage_path: string }>("delete from operative_cards where id = $1 returning storage_path", [id])).rows[0]?.storage_path,
  );
  if (!path) throw new UserError("Card not found.", 404);
  await getFileStore().remove([path]).catch(() => {});
}
