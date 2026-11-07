import { getViewer } from "@/server/auth/viewer";
import { getDaywork } from "@/server/queries/handovers";
import { getFileStore } from "@/server/storage";
import { buildDayworkSheet } from "@/server/files/certificate";
import { notFound } from "@/server/files/serve";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer || !/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const d = await getDaywork(viewer, id);
  if (!d) return notFound();
  const store = getFileStore();
  const [client, msw] = await Promise.all([store.get(d.client_signature_path), store.get(d.msw_signature_path)]);
  if (!client || !msw) return notFound();
  const pdf = await buildDayworkSheet(d, { client, msw });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Daywork_${d.job_number}_wc_${d.week_commencing}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
