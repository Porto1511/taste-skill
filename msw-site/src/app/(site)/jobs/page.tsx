import type { Metadata } from "next";
import { HardHat, Phone } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { listMyJobs } from "@/server/queries/site";
import { JobCard } from "@/components/site/job-card";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { telHref } from "@/lib/format";
import { requestNow } from "@/lib/now";

export const metadata: Metadata = { title: "Your jobs" };

const OFFICE_PHONE = process.env.NEXT_PUBLIC_MSW_OFFICE_PHONE ?? "07700 900100";

export default async function MyJobsPage() {
  const viewer = await requireViewer();
  const jobs = await listMyJobs(viewer);
  const now = new Date(requestNow());
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(now));
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">{greeting}, {viewer.fullName.split(" ")[0]} · {today}</p>
      <h1 className="text-[28px] font-bold tracking-tight">Your jobs</h1>
      <p className="mb-4 text-[15px] text-muted">{jobs.length ? `You're on ${jobs.length} live job${jobs.length === 1 ? "" : "s"}. Tap one for drawings, RAMS and sign-offs.` : "Nothing allocated to you yet."}</p>
      {viewer.isStaff && (
        <p className="mb-3 rounded-xl bg-info-soft px-3 py-2 text-[13px] text-[#123f8f]">Office view: every live job is listed. Operatives see only the jobs they&apos;re allocated to.</p>
      )}
      {jobs.length === 0 ? (
        <EmptyState icon={<HardHat />} title="No live jobs for you right now"
          action={<ButtonLink href={telHref(OFFICE_PHONE)} variant="dark" size="lg"><Phone className="size-5" weight="fill" /> Call the MSW office</ButtonLink>}>
          Jobs appear here when MSW allocates you and the job goes live.
        </EmptyState>
      ) : (
        <div className="stagger grid grid-cols-[minmax(0,1fr)] gap-3">
          {jobs.map((j) => <JobCard key={j.id} job={j} staffView={viewer.isStaff} />)}
        </div>
      )}
    </div>
  );
}
