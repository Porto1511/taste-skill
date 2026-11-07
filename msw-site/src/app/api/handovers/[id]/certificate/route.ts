import { getViewer } from "@/server/auth/viewer";
import { getHandover } from "@/server/queries/handovers";
import { getFileStore } from "@/server/storage";
import { buildHandoverCertificate } from "@/server/files/certificate";
import { notFound } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer || !/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const h = await getHandover(viewer, id);
  if (!h) return notFound();
  const store = getFileStore();
  const signature = await store.get(h.signature_path);
  if (!signature) return notFound();
  const msw = h.msw_signature_path ? await store.get(h.msw_signature_path) : null;
  const photos = (await Promise.all(h.photos.map((p) => store.get(p.storage_path)))).filter((b): b is Buffer => Boolean(b));
  const pdf = await buildHandoverCertificate(h, { client: signature, msw }, photos);
  const name = `Completion_certificate_${h.job_number}_${h.title.replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`;
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
