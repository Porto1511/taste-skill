import Link from "next/link";
import type { OfficeReportRow } from "@/server/queries/office";
import { ReportIcon } from "@/components/site/report-row";
import { PriorityBadge, ReportStatusBadge } from "@/components/ui/badge";
import { labels, relativeTime } from "@/lib/format";
import { Camera } from "@phosphor-icons/react/dist/ssr";

export function ReportTable({ reports, now, showJob = true }: { reports: OfficeReportRow[]; now: number; showJob?: boolean }) {
  if (!reports.length) return <p className="px-4 py-8 text-center text-sm text-muted">No reports match.</p>;
  return (
    <ul className="divide-y divide-line">
      {reports.map((r) => (
        <li key={r.id}>
          <Link href={`/office/reports/${r.id}`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-paper">
            <ReportIcon kind={r.kind} urgent={r.priority === "urgent" || r.category === "safety"} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <ReportStatusBadge status={r.status} />
                <PriorityBadge priority={r.priority} category={r.category} />
                <span className="text-[12px] font-medium text-muted">
                  {r.kind === "issue" ? labels.category[r.category ?? "other"] : labels.kind[r.kind]}
                  {showJob && <> · <span className="font-mono">{r.job_number}</span></>}
                  {r.area_name ? ` · ${r.area_name}` : ""}
                </span>
              </div>
              <p className="mt-0.5 font-semibold leading-snug">{r.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-muted">
                <span>{r.author_name} · {r.author_company_name}</span>
                <span>{relativeTime(r.created_at, now)}</span>
                {r.photo_count > 0 && <span className="inline-flex items-center gap-1"><Camera className="size-3.5" />{r.photo_count}</span>}
                {r.status === "open" && !r.last_office_reply_at && <span className="font-semibold text-danger">Awaiting response</span>}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
