import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { getSiteJob } from "@/server/queries/site";
import { listDeliveries } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { DeliveryForm } from "@/components/handover/delivery-form";

export const metadata: Metadata = { title: "Delivery note" };

export default async function DeliveryPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const data = await getSiteJob(viewer, jobId);
  if (!data) notFound();
  const [last] = await listDeliveries(viewer, jobId);
  const contractor = (data.job.main_contractor ?? "").replace(/ \(fictional\)$/, "");
  return (
    <div>
      <PageHeader back={{ href: `/jobs/${jobId}#reports`, label: data.job.name }} title="Delivery note" description="Record a delivery to site and get it signed for." />
      <DeliveryForm jobId={jobId} me={{ name: viewer.fullName }}
        job={{ number: data.job.job_number, name: data.job.name, address: `${data.job.site_address}${data.job.postcode ? `, ${data.job.postcode}` : ""}` }}
        defaultReceiver={{
          name: last?.receiver_name ?? data.job.site_contact_name ?? "", position: last?.receiver_position ?? data.job.site_contact_role?.split(",")[0] ?? "",
          company: last?.receiver_company ?? contractor, email: last?.receiver_email ?? "",
        }} />
    </div>
  );
}
