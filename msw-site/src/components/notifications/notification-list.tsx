import { Bell, FileText, WarningOctagon, ChatCircleText, Key, Buildings, Checks } from "@phosphor-icons/react/dist/ssr";
import type { NotificationRow } from "@/server/queries/site";
import { markAllReadAction, openNotificationAction } from "@/server/actions/notifications";
import { EmptyState } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

function iconFor(kind: string) {
  if (kind.startsWith("document")) return FileText;
  if (kind === "report.created") return WarningOctagon;
  if (kind.startsWith("report")) return ChatCircleText;
  if (kind.startsWith("access")) return Key;
  if (kind.startsWith("job")) return Buildings;
  return Bell;
}

export function NotificationList({ items, now }: { items: NotificationRow[]; now: number }) {
  const unread = items.filter((n) => !n.read_at).length;
  if (items.length === 0) {
    return <EmptyState icon={<Bell />} title="No notifications yet">You&apos;ll be told here when drawings change, when you&apos;re added to a job and when the office replies.</EmptyState>;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <button className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-ink/5"><Checks className="size-4" /> Mark all read</button>
          </form>
        )}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]">
        {items.map((n) => {
          const Icon = iconFor(n.kind);
          const urgent = n.title.startsWith("URGENT") || n.kind === "document.withdrawn";
          return (
            <li key={n.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className={cn("flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper", !n.read_at && "bg-brand-soft/60/40")}>
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", urgent ? "bg-danger text-white" : n.read_at ? "bg-ink/[0.05] text-muted" : "bg-ink text-signal")}>
                    <Icon className="size-5" weight="fill" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block leading-snug", n.read_at ? "font-medium text-ink/80" : "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-[14px] leading-snug text-muted">{n.body}</span>}
                    <span className="mt-1 block text-[12px] text-subtle">{n.job_number ? `${n.job_number} · ` : ""}{relativeTime(n.created_at, now)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
