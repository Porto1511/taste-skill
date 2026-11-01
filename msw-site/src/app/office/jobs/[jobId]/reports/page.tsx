import { requireStaff } from "@/server/auth/viewer";
import { listOfficeReports } from "@/server/queries/office";
import { Card } from "@/components/ui/card";
import { ReportTable } from "@/components/office/report-table";
import { requestNow } from "@/lib/now";

export default async function JobReportsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  const reports = await listOfficeReports(viewer, { jobId });
  return <Card className="overflow-hidden"><ReportTable reports={reports} now={requestNow()} showJob={false} /></Card>;
}
