import { getViewer } from "@/server/auth/viewer";
import { notFound, serveRevision } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const { id } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  return serveRevision(viewer.id, id, download);
}
