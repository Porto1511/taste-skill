import { z } from "zod";
import { getViewer } from "@/server/auth/viewer";
import { uploadCertificate } from "@/server/files/certificates";
import { fileFrom, jsonError, sameOrigin } from "@/server/http";

const input = z.object({
  companyId: z.string().uuid(),
  title: z.string().trim().min(2, "Give it a name, e.g. Net certificates 2026").max(160),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  const form = await request.formData();
  const parsed = input.safeParse({ companyId: form.get("companyId"), title: form.get("title") });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const file = await fileFrom(form.get("file"));
  if (!file) return Response.json({ error: "Choose the PDF to upload." }, { status: 422 });
  try {
    return Response.json(await uploadCertificate(viewer, parsed.data.companyId, parsed.data.title, file), { status: 201 });
  } catch (err) {
    return jsonError(err, "api.certificates.upload");
  }
}
