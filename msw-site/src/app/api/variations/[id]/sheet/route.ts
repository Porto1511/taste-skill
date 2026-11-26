import { getViewer } from "@/server/auth/viewer";
import { getVariation } from "@/server/queries/variations";
import { getFileStore } from "@/server/storage";
import { buildVariationSheet } from "@/server/files/certificate";
import { notFound } from "@/server/files/serve";
import { withUser } from "@/server/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer || !/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const v = await getVariation(viewer, id);
  if (!v) return notFound();
  const store = getFileStore();
  const paths = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ storage_path: string }>("select storage_path from variation_photos where variation_id = $1 order by created_at", [id])).rows.map((r) => r.storage_path));
  const [client, operative, ...photos] = await Promise.all([store.get(v.client_signature_path), store.get(v.operative_signature_path), ...paths.map((p) => store.get(p))]);
  if (!client || !operative) return notFound();
  const pdf = await buildVariationSheet(v, { client, operative }, photos.filter((b): b is Buffer => Boolean(b)));
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Variation_${v.job_number}_${v.signed_at.slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
