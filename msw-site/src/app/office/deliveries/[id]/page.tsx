import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getDelivery } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { DeliveryView } from "@/components/handover/delivery-view";

export default async function OfficeDeliveryDetail({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getDelivery(viewer, id);
  if (!d) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/office/deliveries", label: "Delivery notes" }} title={<span className="sr-only">Delivery note</span>} />
      <DeliveryView d={d} />
    </div>
  );
}
