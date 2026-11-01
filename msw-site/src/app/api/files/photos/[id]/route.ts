import { getViewer } from "@/server/auth/viewer";
import { notFound, servePhoto } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const { id } = await params;
  return servePhoto(viewer.id, id, new URL(request.url).searchParams.get("thumb") === "1");
}
