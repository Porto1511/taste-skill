import "server-only";
import { randomUUID } from "node:crypto";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import { UserError } from "../errors";
import type { Viewer } from "../auth/viewer";
import { assertPdf, safeFileName } from "./validate";

/**
 * Company certificate library (e.g. net certs). MSW office can file certs for
 * any company; anyone else only for their own company — enforced by RLS.
 */
export async function uploadCertificate(viewer: Viewer, companyId: string, title: string, file: { name: string; bytes: Buffer }) {
  assertPdf(file.bytes, file.name || "The file");
  const id = randomUUID();
  const path = storagePaths.certificate(companyId, id);
  const store = getFileStore();
  await store.put(path, file.bytes, "application/pdf");
  try {
    await withUser(viewer.id, (tx) =>
      tx.query(
        "insert into company_certificates (id, company_id, title, file_name, file_size, storage_path) values ($1, $2, $3, $4, $5, $6)",
        [id, companyId, title, safeFileName(file.name, "certificates.pdf"), file.bytes.length, path],
      ),
    );
  } catch (err) {
    await store.remove([path]).catch(() => {});
    throw err;
  }
  log.info("certificate.uploaded", { certificateId: id, companyId, userId: viewer.id });
  return { id };
}

export async function deleteCertificate(viewer: Viewer, id: string) {
  const path = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ storage_path: string }>("delete from company_certificates where id = $1 returning storage_path", [id])).rows[0]?.storage_path,
  );
  if (!path) throw new UserError("Certificate not found.", 404);
  await getFileStore().remove([path]).catch(() => {});
}
