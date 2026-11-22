import Link from "next/link";
import { ClockClockwise } from "@phosphor-icons/react/dist/ssr";
import type { DayworkSummary } from "@/server/queries/handovers";
import { formatDate } from "@/lib/format";

export function DayworkTable({ items, showJob = true, hrefBase = "/office/daywork" }: { items: DayworkSummary[]; showJob?: boolean; hrefBase?: string }) {
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">No daywork sheets yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`${hrefBase}/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"><ClockClockwise className="size-5" weight="bold" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{d.description}</span>
              <span className="block text-[12.5px] text-muted">
                {showJob && <><span className="font-mono">{d.job_number}</span> · </>}W/C {formatDate(d.week_commencing)} · {d.people} {d.people === 1 ? "person" : "people"} · {d.total_hours}h · {d.captured_by_name} ({d.captured_by_company}) · signed by {d.client_name}
              </span>
            </span>
            <span className={d.work_complete ? "text-[12px] font-semibold text-ok" : "text-[12px] font-semibold text-warn"}>{d.work_complete ? "Complete" : "Not complete"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
