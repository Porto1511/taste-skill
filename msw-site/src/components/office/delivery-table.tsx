import Link from "next/link";
import { Truck } from "@phosphor-icons/react/dist/ssr";
import type { DeliverySummary } from "@/server/queries/handovers";
import { formatDateTime } from "@/lib/format";

export function DeliveryTable({ items, showJob = true }: { items: DeliverySummary[]; showJob?: boolean }) {
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">No delivery notes yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/office/deliveries/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info"><Truck className="size-5" weight="bold" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{d.first_item}{d.item_count > 1 ? ` + ${d.item_count - 1} more` : ""}</span>
              <span className="block text-[12.5px] text-muted">{showJob && <><span className="font-mono">{d.job_number}</span> · </>}delivered by {d.delivered_by} · received by {d.receiver_name} ({d.receiver_company})</span>
            </span>
            <span className="shrink-0 text-[12.5px] text-muted">{formatDateTime(d.signed_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
