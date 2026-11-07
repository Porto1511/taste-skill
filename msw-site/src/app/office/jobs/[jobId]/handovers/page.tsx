import { requireStaff } from "@/server/auth/viewer";
import { listHandovers } from "@/server/queries/handovers";
import { Card } from "@/components/ui/card";
import { HandoverTable } from "@/components/office/handover-table";
import { HandoverStatus } from "@/components/handover/handover-status";
import { getOfficeJob } from "@/server/queries/office";

export default async function JobHandoversPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const [items, job] = await Promise.all([listHandovers(viewer, jobId), getOfficeJob(viewer, jobId)]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden"><HandoverTable items={items} showJob={false} /></Card>
      <HandoverStatus areas={job?.areas ?? []} handovers={items} />
    </div>
  );
}
