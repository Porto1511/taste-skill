import { getViewer } from "@/server/auth/viewer";
import { invoiceInput, uploadInvoice } from "@/server/files/invoices";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

/** A subcontractor boss sends an invoice for one of their jobs. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!viewer.isBoss) return Response.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData();
  const parsed = invoiceInput.safeParse({
    jobId: form.get("jobId"), invoiceNumber: form.get("invoiceNumber"), invoiceDate: form.get("invoiceDate"),
    amount: form.get("amount"), notes: form.get("notes") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  const file = await fileFrom(form.get("file"));
  if (!file) return Response.json({ error: "Choose the invoice PDF." }, { status: 422 });
  try {
    return Response.json(await uploadInvoice(viewer, parsed.data, file), { status: 201 });
  } catch (err) {
    return jsonError(err, "api.invoices.upload");
  }
}
