import { getViewer } from "@/server/auth/viewer";
import { getDelivery } from "@/server/queries/handovers";
import { getFileStore } from "@/server/storage";
import { buildDeliveryNote } from "@/server/files/certificate";
import { notFound } from "@/server/files/serve";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id } = await params;
  if (!viewer || !/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const d = await getDelivery(viewer, id);
  if (!d) return notFound();
  const store = getFileStore();
  const [receiver, driver] = await Promise.all([store.get(d.receiver_signature_path), store.get(d.driver_signature_path)]);
  if (!receiver || !driver) return notFound();
  const pdf = await buildDeliveryNote(d, { receiver, driver });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Delivery_note_${d.job_number}_${d.signed_at.slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
