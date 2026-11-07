import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { listHandovers } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { HandoverForm } from "@/components/handover/handover-form";

export const metadata: Metadata = { title: "Handover" };

export default async function HandoverPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  const last = (await listHandovers(viewer, jobId))[0];
  const contractor = (data.job.main_contractor ?? "").replace(/ \(fictional\)$/, "");
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: data.job.name }} title="Handover"
        description="Completion certificate for nets, deck or studs — signed by you and the client." />
      <HandoverForm jobId={jobId} jobName={data.job.name} areas={data.areas.map((a) => ({ id: a.id, name: a.name }))}
        mswName={viewer.fullName}
        defaultClient={{
          name: last?.signer_name ?? data.job.site_contact_name ?? "",
          position: last?.signer_position ?? data.job.site_contact_role?.split(",")[0] ?? "",
          company: last?.signer_company ?? contractor,
          email: last?.signer_email ?? "",
        }} />
    </div>
  );
}
