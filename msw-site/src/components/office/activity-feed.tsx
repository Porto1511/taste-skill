import Link from "next/link";
import { Key, FileText, WarningOctagon, User, Buildings, Eye, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import type { ActivityRow } from "@/server/queries/office";
import { relativeTime, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

function style(action: string) {
  if (action.startsWith("access.revoked")) return { Icon: Key, cls: "bg-danger-soft text-danger" };
  if (action.startsWith("access")) return { Icon: Key, cls: "bg-signal-soft text-signal-ink" };
  if (action === "document.viewed" || action === "document.downloaded") return { Icon: Eye, cls: "bg-ink/[0.05] text-muted" };
  if (action === "revision.approved") return { Icon: FileText, cls: "bg-ok-soft text-ok" };
  if (action.startsWith("revision") || action.startsWith("document")) return { Icon: FileText, cls: "bg-info-soft text-info" };
  if (action.startsWith("report")) return { Icon: WarningOctagon, cls: "bg-warn-soft text-warn" };
  if (action.startsWith("user") || action.startsWith("company")) return { Icon: User, cls: "bg-ink/[0.06] text-ink" };
  if (action.startsWith("job") || action.startsWith("area")) return { Icon: Buildings, cls: "bg-ink/[0.06] text-ink" };
  return { Icon: ClockCounterClockwise, cls: "bg-ink/[0.05] text-muted" };
}

export function ActivityFeed({ items, now, showJob = true, dense }: { items: ActivityRow[]; now: number; showJob?: boolean; dense?: boolean }) {
  if (!items.length) return <p className="px-4 py-6 text-center text-sm text-muted">No activity recorded yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {items.map((a) => {
        const { Icon, cls } = style(a.action);
        return (
          <li key={a.id} className={cn("flex gap-3 px-4", dense ? "py-2.5" : "py-3")}>
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", cls)}><Icon className="size-4" weight="bold" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug">{a.summary}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {a.actor_name ?? "System"}
                {showJob && a.job_number && a.job_id && (<> · <Link href={`/office/jobs/${a.job_id}`} className="font-mono hover:text-ink hover:underline">{a.job_number}</Link></>)}
                {" · "}<time dateTime={a.created_at} title={formatDateTime(a.created_at)}>{relativeTime(a.created_at, now)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
