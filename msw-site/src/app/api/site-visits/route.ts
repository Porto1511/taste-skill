import { getViewer } from "@/server/auth/viewer";
import { createSiteVisit, siteVisitInput } from "@/server/files/site-visits";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!viewer.canSiteVisit) return Response.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData();
  let raw: unknown = {};
  try { raw = JSON.parse(String(form.get("visit") ?? "{}")); } catch { /* validated below */ }
  const parsed = siteVisitInput.safeParse(raw);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const captions = form.getAll("captions").map((c) => (typeof c === "string" && c.trim() ? c.trim().slice(0, 300) : null));
  const photos: { bytes: Buffer; caption: string | null }[] = [];
  for (const [i, f] of form.getAll("photos").entries()) {
    const file = await fileFrom(f);
    if (file) photos.push({ bytes: file.bytes, caption: captions[i] ?? null });
  }
  try {
    const { id } = await createSiteVisit(viewer, parsed.data, photos);
    return Response.json({ id, href: `${viewer.isStaff ? "/office" : ""}/site-visits/${id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.site_visits.create");
  }
}
