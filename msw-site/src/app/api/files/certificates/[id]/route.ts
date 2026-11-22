import { getViewer } from "@/server/auth/viewer";
import { notFound, serveCertificate } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const { id } = await params;
  return serveCertificate(viewer.id, id, new URL(request.url).searchParams.get("download") === "1");
}
