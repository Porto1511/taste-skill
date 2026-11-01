import Link from "next/link";
import { CalendarBlank, MapPin, StackSimple, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { MyJob } from "@/server/queries/site";
import { Badge, JobStatusBadge } from "@/components/ui/badge";
import { dateRange } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LinkPending } from "@/components/ui/link-pending";

export function JobCard({ job, staffView }: { job: MyJob; staffView?: boolean }) {
  const attendance = dateRange(job.attendance_from, job.attendance_to);
  const areas = job.all_areas || staffView ? "All areas" : job.area_names.length ? job.area_names.join(" · ") : "Job information only";
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={cn(
        "group block rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-card)] transition-[border-color,transform] duration-150 hover:border-ink/25 active:scale-[0.99] sm:p-5",
        job.status === "complete" && "opacity-75",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] font-medium text-muted">{job.job_number}</span>
        <JobStatusBadge status={job.status} />
      </div>
      <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight">{job.name}</h3>
      <p className="mt-1 flex items-start gap-1.5 text-[15px] text-muted">
        <MapPin className="mt-0.5 size-4 shrink-0" />
        <span>{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</span>
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5">
        <StackSimple className="size-5 shrink-0 text-ink" weight="duotone" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle">Your area</p>
          <p className="truncate text-[15px] font-semibold">{areas}</p>
        </div>
        <LinkPending />
        <CaretRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5" weight="bold" />
      </div>

      {(attendance || job.recent_updates > 0 || job.unread > 0 || job.open_reports > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {attendance && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <CalendarBlank className="size-4" /> {attendance}
            </span>
          )}
          {job.recent_updates > 0 && <Badge tone="signal">{job.recent_updates} document{job.recent_updates > 1 ? "s" : ""} updated this week</Badge>}
          {job.unread > 0 && <Badge tone="dark">{job.unread} new</Badge>}
          {job.open_reports > 0 && <Badge tone="warn">{job.open_reports} open report{job.open_reports > 1 ? "s" : ""}</Badge>}
        </div>
      )}
    </Link>
  );
}
