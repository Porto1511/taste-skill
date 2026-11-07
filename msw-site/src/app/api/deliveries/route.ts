import { getViewer } from "@/server/auth/viewer";
import { createDelivery, deliveryInput } from "@/server/files/handovers";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  let items: unknown = [];
  try { items = JSON.parse(String(form.get("items") ?? "[]")); } catch { /* validated below */ }
  const parsed = deliveryInput.safeParse({
    jobId: form.get("jobId"), items, deliveredBy: form.get("deliveredBy"), vehicleReg: form.get("vehicleReg") || undefined,
    notes: form.get("notes") || undefined, receiverName: form.get("receiverName"), receiverCompany: form.get("receiverCompany"),
    receiverPosition: form.get("receiverPosition") || undefined, receiverEmail: form.get("receiverEmail") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  if (form.get("confirmed") !== "1") return Response.json({ error: "The receiver must tick the confirmation." }, { status: 422 });
  const receiver = await fileFrom(form.get("signature"));
  const driver = await fileFrom(form.get("driverSignature"));
  if (!receiver || !driver) return Response.json({ error: "Both signatures are needed: driver and receiver." }, { status: 422 });
  try {
    const res = await createDelivery(viewer, parsed.data, { receiver, driver });
    return Response.json({ id: res.id, href: `/jobs/${res.jobId}/delivery/${res.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.deliveries.create");
  }
}
