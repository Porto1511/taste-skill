import { getViewer } from "@/server/auth/viewer";
import { withUser } from "@/server/db";
import { notFound } from "@/server/files/serve";
import { getFileStore } from "@/server/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.canSiteVisit) return notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const row = await withUser(viewer.id, async (tx) =>
    (await tx.query<{ storage_path: string }>("select storage_path from site_visit_photos where id = $1", [id])).rows[0]);
  if (!row) return notFound();
  const data = await getFileStore().get(row.storage_path);
  if (!data) return notFound();
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
