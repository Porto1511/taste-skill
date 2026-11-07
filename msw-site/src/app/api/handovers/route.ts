import { getViewer } from "@/server/auth/viewer";
import { createHandover, handoverInput } from "@/server/files/handovers";
import { fieldErrors } from "@/server/validation";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  let checklist: unknown = [];
  try { checklist = JSON.parse(String(form.get("checklist") ?? "[]")); } catch { /* validated below */ }
  const parsed = handoverInput.safeParse({
    scopes: form.getAll("scopes").map(String),
    jobId: form.get("jobId"), areaId: form.get("areaId") || undefined, title: form.get("title"), scope: form.get("scope") || undefined,
    checklist, signerName: form.get("signerName"), signerCompany: form.get("signerCompany"),
    signerPosition: form.get("signerPosition") || undefined, signerEmail: form.get("signerEmail") || undefined,
  });
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, { status: 422 });
  if (form.get("confirmed") !== "1") return Response.json({ error: "The person signing must tick the confirmation." }, { status: 422 });
  const signature = await fileFrom(form.get("signature"));
  if (!signature) return Response.json({ error: "The contractor needs to sign in the box." }, { status: 422 });
  const files = form.getAll("photos");
  const captions = form.getAll("captions").map((c) => (typeof c === "string" && c.trim() ? c.trim().slice(0, 300) : null));
  try {
    const photos = [];
    for (let i = 0; i < files.length; i++) {
      const file = await fileFrom(files[i]);
      if (file) photos.push({ file, caption: captions[i] ?? null });
    }
    const res = await createHandover(viewer, parsed.data, signature, photos);
    return Response.json({ id: res.id, href: `/jobs/${res.jobId}/handovers/${res.id}` }, { status: 201 });
  } catch (err) {
    return jsonError(err, "api.handovers.create");
  }
}
