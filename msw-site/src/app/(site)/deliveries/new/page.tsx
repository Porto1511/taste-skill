import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { listDeliveries, listDeliveryJobs } from "@/server/queries/handovers";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/card";
import { DeliveryForm } from "@/components/handover/delivery-form";

export const metadata: Metadata = { title: "New delivery" };

export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.isMswEmployee) notFound();
  const { job: jobId } = await searchParams;
  const jobs = await listDeliveryJobs(viewer);
  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;

  if (!job) {
    return (
      <div>
        <PageHeader back={{ href: "/deliveries", label: "Deliveries" }} title="Which job?" description="Pick the job you're delivering to." />
        {jobs.length === 0 ? <EmptyState title="No live jobs">There are no live jobs to deliver to.</EmptyState> : (
          <ul className="grid gap-2.5">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/deliveries/new?job=${j.id}`} className="flex items-center gap-3 rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[12px] text-muted">{j.job_number}</span>
                    <span className="block font-semibold leading-snug">{j.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted"><MapPin className="size-4 shrink-0" />{j.site_address}{j.postcode ? `, ${j.postcode}` : ""}</span>
                  </span>
                  <CaretRight className="size-4 text-muted" weight="bold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [last] = (await listDeliveries(viewer, job.id));
  return (
    <div>
      <PageHeader back={{ href: "/deliveries/new", label: "Choose a different job" }} title="Delivery note" description="Record what you've dropped and get it signed for." />
      <DeliveryForm jobId={job.id} me={{ name: viewer.fullName }}
        job={{ number: job.job_number, name: job.name, address: `${job.site_address}${job.postcode ? `, ${job.postcode}` : ""}` }}
        defaultReceiver={{
          name: last?.receiver_name ?? job.site_contact_name ?? "", position: last?.receiver_position ?? "",
          company: last?.receiver_company ?? (job.main_contractor ?? "").replace(/ \(fictional\)$/, ""), email: last?.receiver_email ?? "",
        }} />
    </div>
  );
}
