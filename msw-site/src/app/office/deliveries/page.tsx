import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listDeliveries } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DeliveryTable } from "@/components/office/delivery-table";

export const metadata: Metadata = { title: "Deliveries" };

export default async function OfficeDeliveriesPage() {
  const viewer = await requireStaff();
  return (
    <div>
      <PageHeader title="Delivery notes" description="Deliveries to site, signed for by the receiver." />
      <Card className="overflow-hidden"><DeliveryTable items={await listDeliveries(viewer)} /></Card>
    </div>
  );
}
