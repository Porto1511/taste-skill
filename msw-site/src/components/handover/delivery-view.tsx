import type { DeliveryDetail } from "@/server/queries/handovers";
import { formatDateTime } from "@/lib/format";
import { ShareCopy } from "./share-copy";

export function DeliveryView({ d }: { d: DeliveryDetail }) {
  const pdf = `/api/deliveries/${d.id}/note`;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">Delivery note · signed by the receiver</p>
        <h1 className="mt-1 text-[20px] font-semibold leading-snug">{d.item_count} item{d.item_count === 1 ? "" : "s"} delivered to {d.job_number}</h1>
        <p className="mt-1 text-[13px] text-muted">{d.job_name} · {d.site_address}{d.postcode ? `, ${d.postcode}` : ""}</p>
        <div className="mt-4"><ShareCopy url={pdf} fileName={`MSW_delivery_${d.job_number}_${d.signed_at.slice(0, 10)}.pdf`} title={`MSW delivery note — ${d.job_number}`} email={d.receiver_email} who="receiver" /></div>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {d.items.map((it, i) => <li key={i} className="flex justify-between gap-3 px-4 py-3 text-[14px]"><span>{it.description}</span><span className="tabular font-semibold">{it.quantity}</span></li>)}
      </ul>
      <p className="rounded-2xl border border-line bg-card p-4 text-[14px]">Delivered by <span className="font-semibold">{d.delivered_by}</span>{d.vehicle_reg ? ` · ${d.vehicle_reg}` : ""}</p>
      {d.notes && <p className="rounded-2xl bg-warn-soft p-4 text-[14px] text-[#6b3300]"><span className="font-semibold">Notes: </span>{d.notes}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Driver</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${d.id}?who=delivery-driver`} alt={`Signature of ${d.delivered_by}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold">{d.delivered_by}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Received by</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${d.id}?who=delivery-receiver`} alt={`Signature of ${d.receiver_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold">{d.receiver_name}{d.receiver_position ? `, ${d.receiver_position}` : ""}</p>
          <p className="text-[13px] text-muted">{d.receiver_company} · {formatDateTime(d.signed_at)}</p>
        </div>
      </div>
    </div>
  );
}
