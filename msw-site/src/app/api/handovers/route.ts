import { getViewer } from "@/server/auth/viewer";
import { createHandover, handoverInput } from "@/server/files/handovers";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  let details: unknown = {};
  try { details = JSON.parse(String(form.get("details") ?? "{}")); } catch { /* validated below */ }
  const parsed = handoverInput.safeParse({
    jobId: form.get("jobId"), areaId: form.get("areaId") || undefined, title: form.get("title"),
    scopes: form.getAll("scopes").map(String), details, daysWorked: form.getAll("daysWorked").map(String),
    weekCommencing: form.get("weekCommencing"), mswName: form.get("mswName"), signerName: form.get("signerName"), signerCompany: form.get("signerCompany"),
    signerPosition: form.get("signerPosition") || undefined, signerEmail: form.get("signerEmail") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  if (form.get("confirmed") !== "1") return Response.json({ error: "The client must tick the confirmation." }, { status: 422 });
  const client = await fileFrom(form.get("signature"));
  const msw = await fileFrom(form.get("mswSignature"));
  if (!client || !msw) return Response.json({ error: "Both signatures are needed: MSW and the client." }, { status: 422 });
  const files = form.getAll("photos");
  const captions = form.getAll("captions").map((c) => (typeof c === "string" && c.trim() ? c.trim().slice(0, 300) : null));
  try {
    const photos = [];
    for (let i = 0; i < files.length; i++) {
      const file = await fileFrom(files[i]);
      if (file) photos.push({ file, caption: captions[i] ?? null });
    }
    const res = await createHandover(viewer, parsed.data, { client, msw }, photos);
    return Response.json({ id: res.id, href: `/jobs/${res.jobId}/handovers/${res.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.handovers.create");
  }
}
