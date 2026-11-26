import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getVariation } from "@/server/queries/variations";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { VariationView } from "@/components/handover/variation-view";

export const metadata: Metadata = { title: "Variation" };

export default async function SiteVariationPage({ params, searchParams }: {
  params: Promise<{ jobId: string; variationId: string }>; searchParams: Promise<{ signed?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId, variationId } = await params;
  const { signed } = await searchParams;
  if (![jobId, variationId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const v = await getVariation(viewer, variationId);
  if (!v || v.job_id !== jobId) notFound();
  return (
    <div>
      <PageHeader back={{ href: viewer.isBoss ? `/company/jobs/${jobId}` : `/jobs/${jobId}#reports`, label: v.job_name }} title={<span className="sr-only">Variation</span>} />
      {signed && <Alert tone="ok" className="mb-4" title="Signed — the copy is saved and the MSW office has been told">Now send the client their copy below.</Alert>}
      <VariationView v={v} />
    </div>
  );
}
