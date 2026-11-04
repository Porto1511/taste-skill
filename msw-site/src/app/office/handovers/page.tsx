import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/viewer";
import { listHandovers } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { HandoverTable } from "@/components/office/handover-table";

export const metadata: Metadata = { title: "Handovers" };

export default async function OfficeHandoversPage() {
  const viewer = await requireStaff();
  const items = await listHandovers(viewer);
  return (
    <div>
      <PageHeader title="Handovers" description="Completed works signed off by the main contractor on site, with photos, checklist and certificate." />
      <Card className="overflow-hidden"><HandoverTable items={items} /></Card>
    </div>
  );
}
