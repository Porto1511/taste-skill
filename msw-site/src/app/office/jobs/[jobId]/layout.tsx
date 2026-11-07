import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { getOfficeJob } from "@/server/queries/office";
import { PageHeader } from "@/components/layout/page-header";
import { JobStatusBadge } from "@/components/ui/badge";
import { JobTabs } from "@/components/office/job-tabs";

export default async function JobLayout({ children, params }: { children: React.ReactNode; params: Promise<{ jobId: string }> }) {
  const viewer = await requireStaff();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getOfficeJob(viewer, jobId);
  if (!data) notFound();
  const { job, summary } = data;
  return (
    <div>
      <PageHeader
        back={{ href: "/office/jobs", label: "Jobs" }}
        eyebrow={<span className="flex items-center gap-2"><span className="font-mono">{job.job_number}</span><JobStatusBadge status={job.status} /></span>}
        title={job.name}
        description={`${job.site_address}${job.postcode ? `, ${job.postcode}` : ""}${job.main_contractor ? ` · ${job.main_contractor}` : ""}`}
      />
      <JobTabs jobId={job.id} counts={{ documents: summary.current_docs, people: summary.people, issues: summary.open_issues }} />
      {children}
    </div>
  );
}
