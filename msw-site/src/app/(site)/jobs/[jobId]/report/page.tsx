import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { ReportForm } from "@/components/site/report-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ jobId: string }>; searchParams: Promise<{ kind?: string; area?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  const { kind, area } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  const initialKind = kind === "progress" || kind === "photo" ? kind : "issue";
  return (
    <div>
      <PageHeader
        back={{ href: `/jobs/${jobId}`, label: data.job.name }}
        eyebrow={<span className="font-mono">{data.job.job_number}</span>}
        title={initialKind === "issue" ? "Report an issue" : initialKind === "progress" ? "Progress update" : "Upload photos"}
        description="Goes straight to the MSW office. You'll be notified when they respond."
      />
      <ReportForm
        jobId={jobId}
        jobName={data.job.name}
        initialKind={initialKind}
        areas={data.areas.map((a) => ({ id: a.id, name: a.name }))}
        defaultAreaId={data.areas.find((a) => a.id === area)?.id}
        sitePhone={data.job.site_contact_phone}
        siteContact={data.job.site_contact_name}
      />
    </div>
  );
}
