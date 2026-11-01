import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { ReportDetail } from "@/server/queries/site";
import { PhotoGrid } from "@/components/site/photo-grid";
import { Card } from "@/components/ui/card";
import { PriorityBadge, ReportStatusBadge } from "@/components/ui/badge";
import { ReportIcon } from "@/components/site/report-row";
import { formatDateTime, initials, labels } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ReportThread({ data, children }: { data: ReportDetail; children?: React.ReactNode }) {
  const { report, photos, responses } = data;
  return (
    <div className="grid gap-5">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ReportIcon kind={report.kind} urgent={report.priority === "urgent" || report.category === "safety"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <ReportStatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} category={report.category} />
              <span className="text-[13px] font-medium text-muted">
                {report.kind === "issue" ? labels.category[report.category ?? "other"] : labels.kind[report.kind]}
                {report.area_name ? ` · ${report.area_name}` : " · Whole job"}
              </span>
            </div>
            <h1 className="mt-1.5 text-[22px] font-semibold leading-snug tracking-tight">{report.title}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {report.author_name} · {report.author_company_name} · <time dateTime={report.created_at}>{formatDateTime(report.created_at)}</time>
            </p>
          </div>
        </div>
        {report.description && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{report.description}</p>}
        {photos.length > 0 && (
          <div className="mt-4">
            <PhotoGrid photos={photos.map((p) => ({ id: p.id, caption: p.caption }))} columns={photos.length === 1 ? 2 : 3} />
          </div>
        )}
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-subtle">Submitted by an authenticated user; the time was recorded by the server.</p>
      </Card>

      {responses.length > 0 && (
        <ol className="grid gap-3" aria-label="Responses">
          {responses.map((r) => (
            <li key={r.id} className={cn("flex gap-3", r.from_office ? "" : "flex-row-reverse text-right")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold", r.from_office ? "bg-ink text-signal" : "bg-signal text-ink")}>
                {initials(r.author_name)}
              </span>
              <div className={cn("min-w-0 max-w-[85%] rounded-2xl px-4 py-3", r.from_office ? "rounded-tl-sm bg-card shadow-[var(--shadow-card)] ring-1 ring-line" : "rounded-tr-sm bg-signal-soft")}>
                <p className="text-[13px] font-semibold">
                  {r.author_name}{r.from_office ? " · MSW office" : ""}
                  <span className="ml-1.5 font-normal text-muted">{formatDateTime(r.created_at)}</span>
                </p>
                {r.status_to && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium">
                    <ReportStatusBadge status={r.status_from} /> <ArrowRight className="size-3.5" /> <ReportStatusBadge status={r.status_to} />
                  </p>
                )}
                {r.body && <p className="mt-1 whitespace-pre-line text-left text-[15px] leading-relaxed">{r.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {children}
    </div>
  );
}
