import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { listDeliveries, listDeliveryJobs } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { DeliveryForm } from "@/components/handover/delivery-form";

export const metadata: Metadata = { title: "New delivery" };

export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.isMswEmployee) notFound();
  const { job: jobId } = await searchParams;
  const jobs = await listDeliveryJobs(viewer);
  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const [last] = job ? await listDeliveries(viewer, job.id) : [];
  const address = (j: { site_address: string; postcode: string | null }) => `${j.site_address}${j.postcode ? `, ${j.postcode}` : ""}`;
  return (
    <div>
      <PageHeader back={{ href: "/deliveries", label: "Deliveries" }} title="New delivery" description="Type the job number and address, list what you've dropped, then get it signed for." />
      <DeliveryForm me={{ name: viewer.fullName }}
        defaultJob={job ? { jobId: job.id, number: job.job_number, name: job.name, address: address(job) } : { jobId: null, number: "", name: "", address: "" }}
        knownJobs={jobs.map((j) => ({ id: j.id, job_number: j.job_number, name: j.name, address: address(j), main_contractor: j.main_contractor, site_contact_name: j.site_contact_name }))}
        defaultReceiver={{
          name: last?.receiver_name ?? job?.site_contact_name ?? "", position: last?.receiver_position ?? "",
          company: last?.receiver_company ?? (job?.main_contractor ?? "").replace(/ \(fictional\)$/, ""), email: last?.receiver_email ?? "",
        }} />
    </div>
  );
}
