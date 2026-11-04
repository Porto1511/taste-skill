import { getViewer } from "@/server/auth/viewer";
import { notFound, serveHandoverFile } from "@/server/files/serve";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  return serveHandoverFile(viewer.id, (await params).id, "signature");
}
