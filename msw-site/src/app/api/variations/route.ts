import { getViewer } from "@/server/auth/viewer";
import { createVariation, MAX_VARIATION_PHOTOS, variationInput } from "@/server/files/variations";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  let operatives: unknown = [];
  try { operatives = JSON.parse(String(form.get("operatives") ?? "[]")); } catch { /* validated below */ }
  const parsed = variationInput.safeParse({
    jobId: form.get("jobId"), areaId: form.get("areaId") || undefined, description: form.get("description"), requestedBy: form.get("requestedBy"),
    operatives, operativeName: form.get("operativeName"),
    clientName: form.get("clientName"), clientCompany: form.get("clientCompany"),
    clientPosition: form.get("clientPosition") || undefined, clientEmail: form.get("clientEmail") || undefined,
  });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  if (form.get("confirmed") !== "1") return Response.json({ error: "The client must tick the confirmation." }, { status: 422 });
  const client = await fileFrom(form.get("signature"));
  const operative = await fileFrom(form.get("operativeSignature"));
  if (!client || !operative) return Response.json({ error: "Both signatures are needed: the operative and the client." }, { status: 422 });
  const files = form.getAll("photos");
  if (files.length > MAX_VARIATION_PHOTOS) return Response.json({ error: `Up to ${MAX_VARIATION_PHOTOS} photos.` }, { status: 422 });
  const captions = form.getAll("captions").map((c) => String(c).trim().slice(0, 300) || null);
  const photos: { bytes: Buffer; caption: string | null }[] = [];
  for (const [i, f] of files.entries()) {
    const file = await fileFrom(f);
    if (file) photos.push({ bytes: file.bytes, caption: captions[i] ?? null });
  }
  try {
    const res = await createVariation(viewer, parsed.data, { client, operative }, photos);
    return Response.json({ id: res.id, href: `/jobs/${res.jobId}/variation/${res.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.variations.create");
  }
}
