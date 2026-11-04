import type { Metadata } from "next";
import { HardHat, Phone } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { listMyJobs } from "@/server/queries/site";
import { JobCard } from "@/components/site/job-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { telHref } from "@/lib/format";

export const metadata: Metadata = { title: "Your jobs" };

const OFFICE_PHONE = process.env.NEXT_PUBLIC_MSW_OFFICE_PHONE ?? "07700 900100";

export default async function MyJobsPage() {
  const viewer = await requireViewer();
  const jobs = await listMyJobs(viewer);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date());
  return (
    <div>
      <p className="text-[13px] font-medium text-muted">{today}</p>
      <h1 className="mb-4 text-[26px] font-semibold tracking-tight">Your jobs</h1>
      {viewer.isStaff && (
        <p className="mb-3 rounded-xl bg-info-soft px-3 py-2 text-[13px] text-[#123f8f]">Office view: every live job is listed. Operatives see only the jobs they&apos;re allocated to.</p>
      )}
      {jobs.length === 0 ? (
        <EmptyState icon={<HardHat />} title="No live jobs for you right now"
          action={<ButtonLink href={telHref(OFFICE_PHONE)} variant="dark" size="lg"><Phone className="size-5" weight="fill" /> Call the MSW office</ButtonLink>}>
          Jobs appear here when MSW allocates you and the job goes live.
        </EmptyState>
      ) : (
        <div className="stagger grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {jobs.map((j) => <JobCard key={j.id} job={j} staffView={viewer.isStaff} />)}
        </div>
      )}
    </div>
  );
}
