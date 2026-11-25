import { getViewer } from "@/server/auth/viewer";
import { addVisitPhoto } from "@/server/files/site-visits";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

/** One photo per request: keeps every upload well under the host's size limit. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!viewer.canSiteVisit) return Response.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData();
  const file = await fileFrom(form.get("photo"));
  if (!file) return Response.json({ error: "Choose a photo." }, { status: 422 });
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300) || null;
  try {
    return Response.json(await addVisitPhoto(viewer, id, file.bytes, caption), { status: 201 });
  } catch (err) {
    return jsonError(err, "api.site_visits.photo");
  }
}
