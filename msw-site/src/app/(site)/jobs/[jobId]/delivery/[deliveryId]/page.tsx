import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getDelivery } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { DeliveryView } from "@/components/handover/delivery-view";

export const metadata: Metadata = { title: "Delivery note" };

export default async function SiteDeliveryPage({ params, searchParams }: {
  params: Promise<{ jobId: string; deliveryId: string }>; searchParams: Promise<{ signed?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId, deliveryId } = await params;
  const { signed } = await searchParams;
  if (![jobId, deliveryId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const d = await getDelivery(viewer, deliveryId);
  if (!d || d.job_id !== jobId) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: d.job_name }} title={<span className="sr-only">Delivery note</span>} />
      {signed && <Alert tone="ok" className="mb-4" title="Signed — the MSW copy is saved and the office has been notified">Now send the receiver their copy below.</Alert>}
      <DeliveryView d={d} />
    </div>
  );
}
