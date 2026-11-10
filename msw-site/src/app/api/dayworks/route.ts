import { getViewer } from "@/server/auth/viewer";
import { createDaywork, dayworkInput } from "@/server/files/handovers";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  let workers: unknown = [];
  try { workers = JSON.parse(String(form.get("workers") ?? "[]")); } catch { /* validated below */ }
  const parsed = dayworkInput.safeParse({
    jobId: form.get("jobId"), weekCommencing: form.get("weekCommencing"), workers,
    kind: form.get("kind"), mswName: form.get("mswName"), description: form.get("description"), materials: form.get("materials") || undefined, workComplete: form.get("workComplete") === "yes",
    clientName: form.get("clientName"), clientCompany: form.get("clientCompany"),
    clientPosition: form.get("clientPosition") || undefined, clientEmail: form.get("clientEmail") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  if (form.get("confirmed") !== "1") return Response.json({ error: "The client must tick the confirmation." }, { status: 422 });
  const client = await fileFrom(form.get("signature"));
  const msw = await fileFrom(form.get("mswSignature"));
  if (!client || !msw) return Response.json({ error: "Both signatures are needed: MSW and the client." }, { status: 422 });
  try {
    const res = await createDaywork(viewer, parsed.data, { client, msw });
    return Response.json({ id: res.id, href: `/jobs/${res.jobId}/daywork/${res.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.dayworks.create");
  }
}
