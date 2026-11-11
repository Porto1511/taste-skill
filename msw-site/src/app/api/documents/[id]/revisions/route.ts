import { getViewer } from "@/server/auth/viewer";
import { addRevision } from "@/server/files/uploads";
import { fieldErrors, revisionInput } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!viewer.isStaff) return Response.json({ error: "Not found" }, { status: 404 });
  if (!viewer.isAdmin) return Response.json({ error: "Only an MSW administrator can upload drawings and RAMS." }, { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const parsed = revisionInput.safeParse({
    documentId: id,
    revision: form.get("revision"),
    changeNote: form.get("changeNote") || undefined,
    approve: form.get("approve") === "1",
  });
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  const file = await fileFrom(form.get("file"));
  if (!file) return Response.json({ error: "Choose a PDF to upload.", fieldErrors: { file: "Choose a PDF to upload" } }, { status: 422 });
  try {
    const result = await addRevision(viewer, parsed.data, file);
    return Response.json({ ...result, href: `/office/jobs/${result.jobId}/documents/${id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.revisions.create");
  }
}
