import Link from "next/link";
import { ArrowRight, UsersThree, WarningCircle, FileDashed } from "@phosphor-icons/react/dist/ssr";
import type { JobSummary } from "@/server/queries/office";
import { JobStatusBadge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Live jobs as big clickable cards: the quickest way into a job. */
export function JobTiles({ jobs, now }: { jobs: JobSummary[]; now: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {jobs.map((j) => (
        <Link key={j.id} href={`/office/jobs/${j.id}`}
          className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-card p-1.5 shadow-[var(--shadow-card)] ring-1 ring-line transition-[box-shadow,transform] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
            <div className="min-w-0">
              <p className="font-mono text-[12px] font-semibold text-muted">{j.job_number}</p>
              <p className="mt-0.5 text-[17px] font-semibold leading-snug tracking-tight">{j.name}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted">{(j.main_contractor ?? "—").replace(/ \(fictional\)$/, "")}{j.postcode ? ` · ${j.postcode}` : ""}</p>
            </div>
            <JobStatusBadge status={j.status} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5 text-[13px]">
            <Metric icon={<UsersThree />} value={j.people} label="on site list" />
            <Metric icon={<WarningCircle />} value={j.open_issues} label="open issues" tone={j.urgent_issues ? "danger" : j.open_issues ? "warn" : undefined} />
            <Metric icon={<FileDashed />} value={j.drafts} label="drafts" tone={j.drafts ? "info" : undefined} />
          </div>
          <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[12px] text-muted">
            <span>{j.contracts_manager_name ? `CM: ${j.contracts_manager_name}` : "No contracts manager"}</span>
            <span className="flex items-center gap-1.5">{j.last_activity_at ? `Active ${relativeTime(j.last_activity_at, now)}` : "No activity yet"} <span className="grid size-7 place-items-center rounded-full bg-ink text-white transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5"><ArrowRight className="size-3.5" weight="bold" /></span></span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone?: "danger" | "warn" | "info" }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-paper px-3 py-2.5">
      <span className={cn("[&_svg]:size-[18px]", tone === "danger" ? "text-brand" : tone === "warn" ? "text-warn" : tone === "info" ? "text-info" : "text-subtle")}>{icon}</span>
      <span className="tabular text-[18px] font-bold">{value}</span>
      <span className="hidden truncate text-muted sm:inline">{label}</span>
    </div>
  );
}
