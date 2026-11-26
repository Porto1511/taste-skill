import { getViewer } from "@/server/auth/viewer";
import { notFound, serveHandoverFile } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const thumb = new URL(request.url).searchParams.get("thumb") === "1";
  return serveHandoverFile(viewer.id, (await params).id, "variation-photo", thumb);
}
