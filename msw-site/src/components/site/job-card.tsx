import Link from "next/link";
import { CalendarBlank, CaretRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { MyJob } from "@/server/queries/site";
import { dateRange } from "@/lib/format";
import { LinkPending } from "@/components/ui/link-pending";

export function JobCard({ job, staffView }: { job: MyJob; staffView?: boolean }) {
  const attendance = dateRange(job.attendance_from, job.attendance_to);
  const areas = job.all_areas || staffView ? ["All areas"] : job.area_names.length ? job.area_names : ["Job info only"];
  const fresh = job.recent_updates > 0;
  return (
    <Link href={`/jobs/${job.id}`}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] bg-card p-1.5 shadow-[var(--shadow-card)] ring-1 ring-line transition-transform duration-300 ease-[var(--ease-out-soft)] active:scale-[0.985]">
      <div className="flex items-center gap-3 px-4 pb-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-muted">{job.job_number}</span>
            {fresh && (
              <span className="rounded-full bg-signal px-2 py-px text-[12px] font-bold uppercase tracking-wide text-ink">
                {job.recent_updates} new drawing{job.recent_updates > 1 ? "s" : ""}
              </span>
            )}
            {job.unread > 0 && <span className="size-2 rounded-full bg-brand" aria-label={`${job.unread} unread`} />}
          </div>
          <h2 className="mt-1 text-[19px] font-semibold leading-snug tracking-[-0.02em]">{job.name}</h2>
          <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-muted"><MapPin className="size-4 shrink-0" />{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</p>
        </div>
        <LinkPending />
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5"><CaretRight className="size-4" weight="bold" /></span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[1.375rem] bg-paper px-3.5 py-2.5">
        {areas.map((a) => (
          <span key={a} className="rounded-full bg-ink px-2.5 py-0.5 text-[12px] font-semibold text-white">{a}</span>
        ))}
        {attendance && (
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-muted"><CalendarBlank className="size-3.5" />{attendance}</span>
        )}
      </div>
    </Link>
  );
}
