import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, Plus, Truck } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { listDeliveries } from "@/server/queries/handovers";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const viewer = await requireViewer();
  if (!viewer.isMswEmployee) notFound();
  const items = await listDeliveries(viewer);
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">MSW deliveries</p>
          <h1 className="text-[28px] font-bold tracking-tight">Deliveries</h1>
        </div>
        <ButtonLink href="/deliveries/new" variant="primary"><Plus className="size-5" weight="bold" /> New delivery</ButtonLink>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Truck />} title="No delivery notes yet">Tap New delivery when you drop materials on a site.</EmptyState>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((d) => (
            <li key={d.id}>
              <Link href={`/deliveries/${d.id}`} className="flex items-center gap-3 rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-info-soft text-info"><Truck className="size-5" weight="bold" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px] text-muted">{d.job_number}</span>
                  <span className="block truncate font-semibold">{d.job_name}</span>
                  <span className="block truncate text-[13px] text-muted">{d.first_item}{d.item_count > 1 ? ` + ${d.item_count - 1} more` : ""} · {formatDateTime(d.signed_at)}</span>
                </span>
                <CaretRight className="size-4 text-muted" weight="bold" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
