import type { HandoverDetail } from "@/server/queries/handovers";
import { PhotoGrid } from "@/components/site/photo-grid";
import { formatDate, formatDateTime } from "@/lib/format";
import { DAYS, HANDOVER_TRADES } from "@/lib/handover";
import { TradeChips } from "./handover-status";
import { ShareCopy } from "./share-copy";

export function HandoverView({ h }: { h: HandoverDetail }) {
  const trades = HANDOVER_TRADES.filter((t) => h.scopes.includes(t.id));
  const pdf = `/api/handovers/${h.id}/certificate`;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">Signed by the client</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{h.title}</h1>
        <TradeChips scopes={h.scopes} className="mt-2" />
        <p className="mt-1.5 text-[13px] text-muted"><span className="font-mono">{h.job_number}</span> · {h.job_name}{h.area_name ? ` · ${h.area_name}` : ""}</p>
        <div className="mt-4">
          <ShareCopy url={pdf} fileName={`MSW_${h.job_number}_${h.title.replace(/[^\w]+/g, "_")}.pdf`} title={`MSW completion certificate — ${h.job_number} ${h.title}`} email={h.signer_email} />
        </div>
      </div>

      {trades.map((t) => {
        const d = h.details?.[t.id] ?? {};
        return (
          <div key={t.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{t.title}</p>
            <dl className="mt-2 grid gap-1.5 text-[14px]">
              {t.fields.map((f) => <div key={f.key}><dt className="text-[12px] text-muted">{f.label}</dt><dd className="font-medium whitespace-pre-line">{d[f.key] || "—"}</dd></div>)}
            </dl>
            {d.notes && <p className="mt-2 rounded-lg bg-warn-soft p-2.5 text-[13px] text-[#6b3300]"><span className="font-semibold">Notes / not finished: </span>{d.notes}</p>}
            <p className="mt-2 text-[12.5px] leading-snug text-muted">{t.statement}</p>
          </div>
        );
      })}
      {!Object.keys(h.details ?? {}).length && h.scope && <p className="rounded-2xl border border-line bg-card p-4 text-[14px]">{h.scope}</p>}

      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
          {DAYS.map((d) => (
            <div key={d.id} className={h.days_worked?.includes(d.id) ? "rounded-lg bg-ink py-1.5 text-white" : "rounded-lg bg-paper py-1.5 text-subtle"}>
              {d.short}<span className="block text-[13px]">{h.days_worked?.includes(d.id) ? "✓" : " "}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">W/C {formatDate(h.week_commencing ?? h.signed_at)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {h.msw_signature_path && (
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed MSW</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image */}
            <img src={`/api/files/signatures/${h.id}?who=msw`} alt={`Signature of ${h.captured_by_name}`} className="mt-2 h-20 max-w-full object-contain" />
            <p className="mt-1 font-semibold">{h.captured_by_name}</p>
            <p className="text-[13px] text-muted">{h.captured_by_company}</p>
          </div>
        )}
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed client</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image */}
          <img src={`/api/files/signatures/${h.id}?who=client`} alt={`Signature of ${h.signer_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold">{h.signer_name}{h.signer_position ? `, ${h.signer_position}` : ""}</p>
          <p className="text-[13px] text-muted">{h.signer_company} · {formatDateTime(h.signed_at)}</p>
        </div>
      </div>

      {h.photos.length > 0 && <PhotoGrid base="/api/files/handover-photos" photos={h.photos.map((p) => ({ id: p.id, caption: p.caption }))} />}
    </div>
  );
}
