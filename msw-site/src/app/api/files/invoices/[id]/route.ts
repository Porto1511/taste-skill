import { getViewer } from "@/server/auth/viewer";
import { notFound, serveInvoice } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !(viewer.isStaff || viewer.isBoss)) return notFound();
  const download = new URL(request.url).searchParams.get("download") === "1";
  return serveInvoice(viewer.id, (await params).id, download);
}
