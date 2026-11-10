import type { DayworkDetail } from "@/server/queries/handovers";
import { formatDate, formatDateTime } from "@/lib/format";
import { DAYS } from "@/lib/handover";
import { ShareCopy } from "./share-copy";

export function DayworkView({ d }: { d: DayworkDetail }) {
  const pdf = `/api/dayworks/${d.id}/sheet`;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">Daywork sheet · {d.kind === "standing" ? "Standing time" : "Extra work"} · signed by the client</p>
        <h1 className="mt-1 text-[20px] font-semibold leading-snug">{d.description}</h1>
        <p className="mt-1 text-[13px] text-muted"><span className="font-mono">{d.job_number}</span> · W/C {formatDate(d.week_commencing)} · Work complete: <span className="font-semibold text-ink">{d.work_complete ? "Yes" : "No"}</span></p>
        <div className="mt-4">
          <ShareCopy url={pdf} fileName={`MSW_daywork_${d.job_number}_${d.week_commencing}.pdf`} title={`MSW daywork sheet — ${d.job_number} w/c ${formatDate(d.week_commencing)}`} email={d.client_email} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead className="border-b border-line text-[11px] font-bold uppercase text-muted">
            <tr><th className="px-3 py-2 text-left">Name</th>{DAYS.map((x) => <th key={x.id} className="px-1 py-2">{x.short}</th>)}<th className="px-3 py-2 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {d.workers.map((w, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><span className="font-semibold">{w.name}</span><span className="block text-[12px] text-muted">{w.trade}</span></td>
                {DAYS.map((x) => <td key={x.id} className="tabular px-1 py-2 text-center">{Number(w.hours[x.id]) || ""}</td>)}
                <td className="tabular px-3 py-2 text-right font-bold">{DAYS.reduce((s, x) => s + (Number(w.hours[x.id]) || 0), 0)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.materials && <p className="rounded-2xl border border-line bg-card p-4 text-[14px]"><span className="text-muted">Materials used: </span>{d.materials}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed MSW</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${d.id}?who=daywork-msw`} alt={`Signature of ${d.msw_signer_name ?? d.captured_by_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold uppercase">{d.msw_signer_name ?? d.captured_by_name}</p><p className="text-[13px] text-muted">{d.captured_by_company}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed client</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${d.id}?who=daywork-client`} alt={`Signature of ${d.client_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold">{d.client_name}{d.client_position ? `, ${d.client_position}` : ""}</p>
          <p className="text-[13px] text-muted">{d.client_company} · {formatDateTime(d.signed_at)}</p>
        </div>
      </div>
    </div>
  );
}
