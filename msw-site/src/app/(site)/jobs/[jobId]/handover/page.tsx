import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { DECLARATION } from "@/server/files/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { HandoverForm } from "@/components/handover/handover-form";

export const metadata: Metadata = { title: "Handover" };

export default async function HandoverPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: data.job.name }} title="Handover sign-off"
        description="Record the finished works, then the main contractor signs on this phone." />
      <HandoverForm jobId={jobId} jobName={data.job.name} areas={data.areas.map((a) => ({ id: a.id, name: a.name }))}
        mainContractor={data.job.main_contractor} siteContact={{ name: data.job.site_contact_name, role: data.job.site_contact_role }}
        declaration={DECLARATION} />
    </div>
  );
}
