import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withUser } from "../db";
import { getFileStore, storagePaths } from "../storage";
import { log } from "../log";
import type { Viewer } from "../auth/viewer";
import { assertPdf, safeFileName } from "./validate";

export const invoiceInput = z.object({
  jobId: z.string().uuid("Choose the job"),
  invoiceNumber: z.string().trim().min(1, "Enter the invoice number").max(60),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the invoice date"),
  amount: z.string().trim().transform((v) => v.replace(/[£,\s]/g, ""))
    .pipe(z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter the amount, e.g. 4250.00"))
    .transform(Number).pipe(z.number().positive("Enter the amount")),
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
});

/**
 * A subcontractor's boss sends an invoice (PDF) for one of their jobs.  Only
 * the MSW office and that boss can ever see it — enforced by RLS.
 */
export async function uploadInvoice(viewer: Viewer, input: z.infer<typeof invoiceInput>, file: { name: string; bytes: Buffer }) {
  assertPdf(file.bytes, file.name || "The invoice");
  const id = randomUUID();
  const path = storagePaths.invoice(viewer.companyId, id);
  const store = getFileStore();
  await store.put(path, file.bytes, "application/pdf");
  try {
    await withUser(viewer.id, (tx) =>
      tx.query(
        `insert into subcontractor_invoices (id, company_id, job_id, invoice_number, invoice_date, amount, notes, file_name, file_size, storage_path)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, viewer.companyId, input.jobId, input.invoiceNumber, input.invoiceDate, input.amount.toFixed(2), input.notes,
          safeFileName(file.name, "invoice.pdf"), file.bytes.length, path],
      ),
    );
  } catch (err) {
    await store.remove([path]).catch(() => {});
    throw err;
  }
  log.info("invoice.uploaded", { invoiceId: id, companyId: viewer.companyId, by: viewer.id });
  return { id };
}
