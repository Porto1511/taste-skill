import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getHandover } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { HandoverView } from "@/components/handover/handover-view";

export const metadata: Metadata = { title: "Handover" };

export default async function SiteHandoverPage({ params, searchParams }: {
  params: Promise<{ jobId: string; handoverId: string }>; searchParams: Promise<{ signed?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId, handoverId } = await params;
  const { signed } = await searchParams;
  if (![jobId, handoverId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const h = await getHandover(viewer, handoverId);
  if (!h || h.job_id !== jobId) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: h.job_name }} title={<span className="sr-only">Handover</span>} />
      {signed && <Alert tone="ok" className="mb-4" title="Signed — the MSW copy is saved and the office has been notified">Now send the client their copy below.</Alert>}
      <HandoverView h={h} />
    </div>
  );
}
