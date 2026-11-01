import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getReportDetail } from "@/server/queries/site";
import { ReportThread } from "@/components/reports/report-thread";
import { ResponseForm } from "@/components/reports/response-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";

export const metadata: Metadata = { title: "Report" };

export default async function SiteReportPage({ params, searchParams }: {
  params: Promise<{ jobId: string; reportId: string }>; searchParams: Promise<{ sent?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId, reportId } = await params;
  const { sent } = await searchParams;
  if (![jobId, reportId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const data = await getReportDetail(viewer, reportId);
  if (!data || data.report.job_id !== jobId) notFound();
  const isAuthor = data.report.author_id === viewer.id;
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}`, label: data.job.name }} title={<span className="sr-only">Report</span>} />
      {sent && <Alert tone="ok" className="mb-4" title="Sent to the MSW office">You&apos;ll get a notification when they respond.</Alert>}
      <ReportThread data={data}>
        {(isAuthor || viewer.isStaff) && (
          <Card className="p-4">
            <ResponseForm reportId={reportId} canSetStatus={viewer.isStaff} currentStatus={data.report.status} isIssue={data.report.kind === "issue"} />
          </Card>
        )}
      </ReportThread>
    </div>
  );
}
