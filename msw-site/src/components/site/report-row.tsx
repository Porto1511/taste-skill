import Link from "next/link";
import { Camera, ChatCircleText, TrendUp, WarningOctagon, Images } from "@phosphor-icons/react/dist/ssr";
import type { SiteReportSummary } from "@/server/queries/site";
import { PriorityBadge, ReportStatusBadge } from "@/components/ui/badge";
import { labels, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ReportIcon({ kind, urgent }: { kind: string; urgent?: boolean }) {
  const Icon = kind === "issue" ? WarningOctagon : kind === "progress" ? TrendUp : Images;
  return (
    <span className={cn(
      "grid size-10 shrink-0 place-items-center rounded-xl",
      kind === "issue" ? (urgent ? "bg-danger text-white" : "bg-danger-soft text-danger") : kind === "progress" ? "bg-ok-soft text-ok" : "bg-info-soft text-info",
    )}>
      <Icon className="size-5" weight="fill" />
    </span>
  );
}

export function ReportRow({ report, href, showAuthor, now }: { report: SiteReportSummary; href: string; showAuthor?: boolean; now: number }) {
  const urgent = report.priority === "urgent" || report.category === "safety";
  return (
    <Link href={href} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-paper">
      <ReportIcon kind={report.kind} urgent={urgent} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportStatusBadge status={report.status} />
          <PriorityBadge priority={report.priority} category={report.category} />
          <span className="text-[12px] font-medium text-muted">
            {report.kind === "issue" ? labels.category[report.category ?? "other"] : labels.kind[report.kind]}
            {report.area_name ? ` · ${report.area_name}` : ""}
          </span>
        </div>
        <p className="mt-1 font-semibold leading-snug">{report.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          <span>{showAuthor ? `${report.author_name} · ` : ""}{relativeTime(report.created_at, now)}</span>
          {report.photo_count > 0 && <span className="inline-flex items-center gap-1"><Camera className="size-3.5" />{report.photo_count}</span>}
          {report.response_count > 0 && <span className="inline-flex items-center gap-1"><ChatCircleText className="size-3.5" />{report.response_count}</span>}
          {report.last_office_reply_at && <span className="font-semibold text-signal-ink">MSW replied</span>}
        </p>
      </div>
    </Link>
  );
}
