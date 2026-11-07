import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getDaywork } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { DayworkView } from "@/components/handover/daywork-view";

export const metadata: Metadata = { title: "Daywork sheet" };

export default async function SiteDayworkPage({ params, searchParams }: {
  params: Promise<{ jobId: string; dayworkId: string }>; searchParams: Promise<{ signed?: string }>;
}) {
  const viewer = await requireViewer();
  const { jobId, dayworkId } = await params;
  const { signed } = await searchParams;
  if (![jobId, dayworkId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound();
  const d = await getDaywork(viewer, dayworkId);
  if (!d || d.job_id !== jobId) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: d.job_name }} title={<span className="sr-only">Daywork sheet</span>} />
      {signed && <Alert tone="ok" className="mb-4" title="Signed — the MSW copy is saved and the office has been notified">Now send the client their copy below.</Alert>}
      <DayworkView d={d} />
    </div>
  );
}
