import { requireStaff } from "@/server/auth/viewer";
import { listDayworks, listDeliveries, listHandovers } from "@/server/queries/handovers";
import { DeliveryTable } from "@/components/office/delivery-table";
import { DayworkTable } from "@/components/office/daywork-table";
import { SectionTitle } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { HandoverTable } from "@/components/office/handover-table";
import { HandoverStatus } from "@/components/handover/handover-status";
import { getOfficeJob } from "@/server/queries/office";

export default async function JobHandoversPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const [items, job, dayworks, deliveries] = await Promise.all([listHandovers(viewer, jobId), getOfficeJob(viewer, jobId), listDayworks(viewer, jobId), listDeliveries(viewer, jobId)]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-6">
        <section><SectionTitle>Completion certificates</SectionTitle><Card className="overflow-hidden"><HandoverTable items={items} showJob={false} /></Card></section>
        <section><SectionTitle>Daywork sheets</SectionTitle><Card className="overflow-hidden"><DayworkTable items={dayworks} showJob={false} /></Card></section>
        <section><SectionTitle>Delivery notes</SectionTitle><Card className="overflow-hidden"><DeliveryTable items={deliveries} showJob={false} /></Card></section>
      </div>
      <HandoverStatus areas={job?.areas ?? []} handovers={items} />
    </div>
  );
}
