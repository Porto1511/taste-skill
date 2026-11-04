import Link from "next/link";
import { Signature } from "@phosphor-icons/react/dist/ssr";
import type { HandoverSummary } from "@/server/queries/handovers";
import { formatDateTime } from "@/lib/format";

export function HandoverTable({ items, showJob = true }: { items: HandoverSummary[]; showJob?: boolean }) {
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-muted">No handovers signed yet. Operatives start them from the job screen on their phone.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((h) => (
        <li key={h.id}>
          <Link href={`/office/handovers/${h.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok"><Signature className="size-5" weight="bold" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{h.title}</span>
              <span className="block text-[12.5px] text-muted">
                {showJob && <><span className="font-mono">{h.job_number}</span> · </>}{h.area_name ?? "Whole job"} · signed by {h.signer_name} ({h.signer_company}) · captured by {h.captured_by_name}
              </span>
            </span>
            <span className="shrink-0 text-[12.5px] text-muted">{formatDateTime(h.signed_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
