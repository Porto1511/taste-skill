import Link from "next/link";
import { CalendarBlank, CaretRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { MyJob } from "@/server/queries/site";
import { dateRange } from "@/lib/format";
import { LinkPending } from "@/components/ui/link-pending";
import { cn } from "@/lib/cn";

export function JobCard({ job, staffView }: { job: MyJob; staffView?: boolean }) {
  const attendance = dateRange(job.attendance_from, job.attendance_to);
  const areas = job.all_areas || staffView ? ["All areas"] : job.area_names.length ? job.area_names : ["Job info only"];
  const fresh = job.recent_updates > 0;
  return (
    <Link href={`/jobs/${job.id}`}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)] transition-transform active:scale-[0.99]">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", fresh ? "bg-signal" : "bg-brand")} aria-hidden />
      <div className="flex items-center gap-3 py-4 pl-5 pr-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-muted">{job.job_number}</span>
            {fresh && (
              <span className="rounded-md bg-signal px-1.5 py-px text-[12px] font-bold uppercase tracking-wide text-ink">
                {job.recent_updates} new drawing{job.recent_updates > 1 ? "s" : ""}
              </span>
            )}
            {job.unread > 0 && <span className="size-2 rounded-full bg-brand" aria-label={`${job.unread} unread`} />}
          </div>
          <h2 className="mt-1 text-[19px] font-bold leading-snug tracking-tight">{job.name}</h2>
          <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-muted"><MapPin className="size-4 shrink-0" />{job.site_address}{job.postcode ? `, ${job.postcode}` : ""}</p>
        </div>
        <LinkPending />
        <CaretRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" weight="bold" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-paper/70 py-2.5 pl-5 pr-4">
        {areas.map((a) => (
          <span key={a} className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-white">{a}</span>
        ))}
        {attendance && (
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-muted"><CalendarBlank className="size-3.5" />{attendance}</span>
        )}
      </div>
    </Link>
  );
}
