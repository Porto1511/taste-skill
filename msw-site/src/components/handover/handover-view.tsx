import { CheckCircle, Circle, FilePdf } from "@phosphor-icons/react/dist/ssr";
import type { HandoverDetail } from "@/server/queries/handovers";
import { PhotoGrid } from "@/components/site/photo-grid";
import { formatDateTime } from "@/lib/format";

export function HandoverView({ h }: { h: HandoverDetail }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">Handover signed</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{h.title}</h1>
        <p className="mt-0.5 text-[13px] text-muted"><span className="font-mono">{h.job_number}</span> · {h.job_name}{h.area_name ? ` · ${h.area_name}` : ""}</p>
        {h.scope && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{h.scope}</p>}
        <a href={`/api/handovers/${h.id}/certificate`} target="_blank" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white">
          <FilePdf className="size-5" weight="fill" /> Handover certificate (PDF)
        </a>
      </div>

      {h.checklist.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {h.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-3 px-4 py-3 text-[14px]">
              {c.checked ? <CheckCircle className="size-5 shrink-0 text-ok" weight="fill" /> : <Circle className="size-5 shrink-0 text-subtle" />}
              <span className={c.checked ? "" : "text-muted"}>{c.label}{!c.checked && " — not confirmed"}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed by</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image */}
        <img src={`/api/files/signatures/${h.id}`} alt={`Signature of ${h.signer_name}`} className="mt-2 h-24 max-w-full object-contain" />
        <p className="mt-2 font-semibold">{h.signer_name}{h.signer_position ? `, ${h.signer_position}` : ""}</p>
        <p className="text-[13px] text-muted">{h.signer_company} · {formatDateTime(h.signed_at)}</p>
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-snug text-muted">“{h.declaration}”</p>
        <p className="mt-2 text-[12px] text-subtle">Captured by {h.captured_by_name} ({h.captured_by_company}). Time recorded by the server.</p>
      </div>

      {h.drawing_refs.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Drawings current at handover</p>
          <ul className="grid gap-1 text-[13px]">
            {h.drawing_refs.map((d) => <li key={d.doc_number}><span className="font-mono font-semibold">{d.doc_number}</span> rev {d.revision} — {d.title}</li>)}
          </ul>
        </div>
      )}

      {h.photos.length > 0 && <PhotoGrid base="/api/files/handover-photos" photos={h.photos.map((p) => ({ id: p.id, caption: p.caption }))} />}
    </div>
  );
}
