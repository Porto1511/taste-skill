import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { listHandovers } from "@/server/queries/handovers";
import { listVariations } from "@/server/queries/variations";
import { PageHeader } from "@/components/layout/page-header";
import { VariationForm } from "@/components/handover/variation-form";

export const metadata: Metadata = { title: "Variation" };

export default async function NewVariationPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  const [[lastVar], [lastHo]] = await Promise.all([listVariations(viewer, jobId), listHandovers(viewer, jobId)]);
  const contractor = (data.job.main_contractor ?? "").replace(/ \(fictional\)$/, "");
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: data.job.name }} title="Variation"
        description="When the client asks for something different: say what, add photos, you sign, then the client signs." />
      <VariationForm jobId={jobId} areas={data.areas.map((a) => ({ id: a.id, name: a.name }))} me={viewer.fullName}
        defaultClient={{
          name: lastVar?.client_name ?? lastHo?.signer_name ?? data.job.site_contact_name ?? "",
          position: lastHo?.signer_position ?? data.job.site_contact_role?.split(",")[0] ?? "",
          company: lastVar?.client_company ?? lastHo?.signer_company ?? contractor,
          email: lastHo?.signer_email ?? "",
        }} />
    </div>
  );
}
