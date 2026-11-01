import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getReportDetail } from "@/server/queries/site";
import { PageHeader } from "@/components/layout/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { ReportThread } from "@/components/reports/report-thread";
import { ResponseForm } from "@/components/reports/response-form";
import { ReportControls } from "@/components/office/report-controls";

export const metadata: Metadata = { title: "Report" };

export default async function OfficeReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const viewer = await requireStaff();
  const { reportId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) notFound();
  const data = await getReportDetail(viewer, reportId);
  if (!data) notFound();
  return (
    <div>
      <PageHeader back={{ href: "/office/reports", label: "Site reports" }}
        eyebrow={<Link href={`/office/jobs/${data.job.id}/reports`} className="hover:underline"><span className="font-mono">{data.job.job_number}</span> · {data.job.name}</Link>}
        title={<span className="sr-only">{data.report.title}</span>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <ReportThread data={data}>
          <Card className="p-4">
            <ResponseForm reportId={reportId} canSetStatus currentStatus={data.report.status} isIssue={data.report.kind === "issue"} />
          </Card>
        </ReportThread>
        <aside>
          <SectionTitle>Manage</SectionTitle>
          <Card className="p-4"><ReportControls reportId={reportId} shared={data.report.shared_with_team} priority={data.report.priority} areaName={data.report.area_name} /></Card>
        </aside>
      </div>
    </div>
  );
}
