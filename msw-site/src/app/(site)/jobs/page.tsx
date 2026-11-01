import type { Metadata } from "next";
import { HardHat, Phone } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { listMyJobs } from "@/server/queries/site";
import { JobCard } from "@/components/site/job-card";
import { EmptyState, SectionTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";
import { telHref } from "@/lib/format";

export const metadata: Metadata = { title: "My jobs" };

const OFFICE_PHONE = process.env.NEXT_PUBLIC_MSW_OFFICE_PHONE ?? "07700 900100";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

export default async function MyJobsPage() {
  const viewer = await requireViewer();
  const jobs = await listMyJobs(viewer);
  const current = jobs.filter((j) => j.status !== "complete");
  const done = jobs.filter((j) => j.status === "complete");

  return (
    <div>
      <div className="mb-6">
        <p className="text-[15px] text-muted">{greeting()}, {viewer.fullName.split(" ")[0]}</p>
        <h1 className="text-[30px] font-semibold tracking-tight">My jobs</h1>
      </div>

      {viewer.isStaff && (
        <Alert tone="info" className="mb-5">
          You are viewing the site app as MSW office staff, so every job is listed. Operatives only see jobs they are individually allocated to.
        </Alert>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<HardHat />}
          title="No jobs allocated to you yet"
          action={<ButtonLink href={telHref(OFFICE_PHONE)} variant="dark" size="lg"><Phone className="size-5" weight="fill" /> Call the MSW office</ButtonLink>}
        >
          MSW gives access to each job individually. If you are due on a site and can&apos;t see it here, contact the MSW office.
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          {current.length > 0 && (
            <section aria-labelledby="current-jobs">
              <SectionTitle id="current-jobs">Current · {current.length}</SectionTitle>
              <div className="stagger grid gap-3">
                {current.map((j) => <JobCard key={j.id} job={j} staffView={viewer.isStaff} />)}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[13px] font-bold uppercase tracking-[0.08em] text-muted [&::-webkit-details-marker]:hidden">
                Completed · {done.length} <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="mt-3 grid gap-3">
                {done.map((j) => <JobCard key={j.id} job={j} staffView={viewer.isStaff} />)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
