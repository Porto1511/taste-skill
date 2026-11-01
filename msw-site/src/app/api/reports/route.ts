import { getViewer } from "@/server/auth/viewer";
import { createReport } from "@/server/files/uploads";
import { fieldErrors, reportInput } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The upload could not be read. Check your connection and try again." }, { status: 400 });
  }
  const parsed = reportInput.safeParse({
    jobId: form.get("jobId"),
    kind: form.get("kind"),
    category: form.get("category") || undefined,
    priority: form.get("priority") || undefined,
    areaId: form.get("areaId") || undefined,
    title: form.get("title") || undefined,
    description: form.get("description") || undefined,
  });
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });

  const files = form.getAll("photos");
  const captions = form.getAll("captions").map((c) => (typeof c === "string" && c.trim() ? c.trim().slice(0, 300) : null));
  try {
    const photos = [];
    for (let i = 0; i < files.length; i++) {
      const file = await fileFrom(files[i]);
      if (file) photos.push({ file, caption: captions[i] ?? null });
    }
    const report = await createReport(viewer, parsed.data, photos);
    return Response.json({ id: report.id, href: `/jobs/${report.job_id}/reports/${report.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.reports.create");
  }
}
