import { getViewer } from "@/server/auth/viewer";
import { notFound, serveHandoverFile } from "@/server/files/serve";

const kinds = { client: "signature", msw: "msw-signature", "daywork-client": "daywork-client", "daywork-msw": "daywork-msw",
  "delivery-receiver": "delivery-receiver", "delivery-driver": "delivery-driver" } as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const who = (new URL(request.url).searchParams.get("who") ?? "client") as keyof typeof kinds;
  if (!(who in kinds)) return notFound();
  return serveHandoverFile(viewer.id, (await params).id, kinds[who]);
}
