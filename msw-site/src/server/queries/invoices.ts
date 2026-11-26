import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface InvoiceRow {
  id: string; company_id: string; company_name: string; job_id: string; job_number: string; job_name: string;
  invoice_number: string; invoice_date: string; amount: string; notes: string | null; file_name: string;
  status: "submitted" | "checked" | "query"; office_note: string | null; checked_by_name: string | null; checked_at: string | null;
  uploaded_by_name: string | null; created_at: string;
}

const cols = `select i.id, i.company_id, c.name as company_name, i.job_id, j.job_number, j.name as job_name, i.invoice_number,
  i.invoice_date::text, i.amount::text, i.notes, i.file_name, i.status::text, i.office_note, cb.full_name as checked_by_name, i.checked_at,
  i.uploaded_by_name, i.created_at
  from subcontractor_invoices i join companies c on c.id = i.company_id join jobs j on j.id = i.job_id
  left join profiles cb on cb.id = i.checked_by`;

/** RLS: the office sees all; a boss sees their own company's; everyone else sees none. */
export async function listInvoices(viewer: Viewer, f: { jobId?: string; companyId?: string; status?: string } = {}) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<InvoiceRow>(
      `${cols} where ($1::uuid is null or i.job_id = $1) and ($2::uuid is null or i.company_id = $2) and ($3::text is null or i.status::text = $3)
       order by i.created_at desc limit 300`,
      [f.jobId ?? null, f.companyId ?? null, f.status ?? null],
    )).rows,
  );
}

export async function getInvoice(viewer: Viewer, id: string) {
  return withUser(viewer.id, async (tx) => (await tx.query<InvoiceRow>(`${cols} where i.id = $1`, [id])).rows[0] ?? null);
}
