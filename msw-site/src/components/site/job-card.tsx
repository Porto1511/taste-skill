import Link from "next/link";
import { CalendarBlank, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { MyJob } from "@/server/queries/site";
import { dateRange } from "@/lib/format";
import { LinkPending } from "@/components/ui/link-pending";

export function JobCard({ job, staffView }: { job: MyJob; staffView?: boolean }) {
  const attendance = dateRange(job.attendance_from, job.attendance_to);
  const areas = job.all_areas || staffView ? ["All areas"] : job.area_names.length ? job.area_names : ["Job info only"];
  return (
    <Link href={`/jobs/${job.id}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] transition-transform active:scale-[0.99]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] font-semibold text-muted">{job.job_number}</span>
          {job.recent_updates > 0 && (
            <span className="rounded-md bg-signal px-1.5 py-px text-[12px] font-bold uppercase tracking-wide text-ink">
              {job.recent_updates} new drawing{job.recent_updates > 1 ? "s" : ""}
            </span>
          )}
          {job.unread > 0 && <span className="size-2 rounded-full bg-danger" aria-label={`${job.unread} unread`} />}
        </div>
        <h2 className="mt-0.5 text-[17px] font-semibold leading-snug">{job.name}</h2>
        <p className="mt-0.5 truncate text-[13px] text-muted">{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {areas.map((a) => (
            <span key={a} className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-white">{a}</span>
          ))}
          {attendance && (
            <span className="ml-1 inline-flex items-center gap-1 text-[12px] font-medium text-muted"><CalendarBlank className="size-3.5" />{attendance}</span>
          )}
        </div>
      </div>
      <LinkPending />
      <CaretRight className="size-5 shrink-0 text-subtle" weight="bold" />
    </Link>
  );
}
