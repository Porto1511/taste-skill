import { requireStaff } from "@/server/auth/viewer";
import { listHandovers } from "@/server/queries/handovers";
import { Card } from "@/components/ui/card";
import { HandoverTable } from "@/components/office/handover-table";

export default async function JobHandoversPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  return <Card className="overflow-hidden"><HandoverTable items={await listHandovers(viewer, jobId)} showJob={false} /></Card>;
}
