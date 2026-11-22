import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getDelivery } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { DeliveryView } from "@/components/handover/delivery-view";

export const metadata: Metadata = { title: "Delivery note" };

export default async function DeliveryPage({ params, searchParams }: { params: Promise<{ deliveryId: string }>; searchParams: Promise<{ signed?: string }> }) {
  const viewer = await requireViewer();
  const { deliveryId } = await params;
  const { signed } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) notFound();
  const d = await getDelivery(viewer, deliveryId);
  if (!d) notFound();
  return (
    <div>
      <PageHeader back={{ href: "/deliveries", label: "Deliveries" }} title={<span className="sr-only">Delivery note</span>} />
      {signed && <Alert tone="ok" className="mb-4" title="Signed — the MSW copy is saved and the office has been notified">Now send the receiver their copy below.</Alert>}
      <DeliveryView d={d} />
    </div>
  );
}
