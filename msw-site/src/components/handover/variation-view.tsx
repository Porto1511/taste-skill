import type { VariationDetail } from "@/server/queries/variations";
import { formatDateTime } from "@/lib/format";
import { ShareCopy } from "./share-copy";

export function VariationView({ v }: { v: VariationDetail }) {
  const pdf = `/api/variations/${v.id}/sheet`;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">Variation · signed by the client</p>
        <h1 className="mt-1 text-[20px] font-semibold leading-snug">{v.description}</h1>
        <p className="mt-1 text-[13px] text-muted"><span className="font-mono">{v.job_number}</span>{v.area_name ? ` · ${v.area_name}` : ""} · asked for by <span className="font-semibold text-ink">{v.requested_by}</span></p>
        <p className="mt-1 text-[13px] text-muted">Operatives: <span className="text-ink">{v.operatives.join(", ")}</span> · {v.captured_by_company}</p>
        <div className="mt-4">
          <ShareCopy url={pdf} fileName={`Variation_${v.job_number}_${v.signed_at.slice(0, 10)}.pdf`} title={`Variation — ${v.job_number}`} email={v.client_email} />
        </div>
      </div>
      {v.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {v.photos.map((p, i) => (
            <a key={p.id} href={`/api/files/variation-photos/${p.id}`} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/variation-photos/${p.id}?thumb=1`} alt={p.caption ?? `Variation photo ${i + 1}`} className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-line" loading="lazy" />
              {p.caption && <p className="mt-1 text-[13px] text-muted">{p.caption}</p>}
            </a>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed operative</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${v.id}?who=variation-operative`} alt={`Signature of ${v.operative_signer_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold uppercase">{v.operative_signer_name}</p><p className="text-[13px] text-muted">{v.captured_by_company}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Signed client</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/signatures/${v.id}?who=variation-client`} alt={`Signature of ${v.client_name}`} className="mt-2 h-20 max-w-full object-contain" />
          <p className="mt-1 font-semibold">{v.client_name}{v.client_position ? `, ${v.client_position}` : ""}</p>
          <p className="text-[13px] text-muted">{v.client_company} · {formatDateTime(v.signed_at)}</p>
        </div>
      </div>
    </div>
  );
}
