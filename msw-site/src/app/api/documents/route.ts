import { getViewer } from "@/server/auth/viewer";
import { createDocument } from "@/server/files/uploads";
import { documentInput, fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!viewer.isStaff) return Response.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const parsed = documentInput.safeParse({
    jobId: form.get("jobId"),
    kind: form.get("kind"),
    docNumber: form.get("docNumber"),
    title: form.get("title"),
    description: form.get("description") || undefined,
    areaIds: form.getAll("areaIds").map(String),
    revision: form.get("revision"),
    changeNote: form.get("changeNote") || undefined,
    approve: form.get("approve") === "1",
  });
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  const file = await fileFrom(form.get("file"));
  if (!file) return Response.json({ error: "Choose a PDF to upload.", fieldErrors: { file: "Choose a PDF to upload" } }, { status: 422 });
  try {
    const result = await createDocument(viewer, parsed.data, file);
    return Response.json({ ...result, href: `/office/jobs/${parsed.data.jobId}/documents/${result.documentId}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.documents.create");
  }
}
