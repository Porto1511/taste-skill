import { getViewer } from "@/server/auth/viewer";
import { notFound, serveCard } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const download = new URL(request.url).searchParams.get("download") === "1";
  return serveCard(viewer.id, (await params).id, download);
}
