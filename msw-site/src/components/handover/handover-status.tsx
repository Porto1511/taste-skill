import { Check } from "@phosphor-icons/react/dist/ssr";
import { HANDOVER_TRADES } from "@/lib/handover";
import { cn } from "@/lib/cn";

/** Which trades have been handed over on each area: Nets · Deck · Studs. */
export function HandoverStatus({ areas, handovers }: {
  areas: { id: string; name: string }[];
  handovers: { area_id: string | null; scopes: string[] }[];
}) {
  const rows = [...areas.map((a) => ({ id: a.id as string | null, name: a.name })),
    ...(handovers.some((h) => !h.area_id) ? [{ id: null, name: "Whole job" }] : [])];
  if (!rows.length) return null;
  const done = (area: string | null, trade: string) =>
    handovers.some((h) => (h.area_id === area || h.area_id === null) && h.scopes.includes(trade));
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="grid grid-cols-[1fr_repeat(3,4rem)] border-b border-line bg-paper/60 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
        <span>Handed over</span>
        {HANDOVER_TRADES.map((t) => <span key={t.id} className="text-center">{t.label}</span>)}
      </div>
      {rows.map((r) => (
        <div key={r.id ?? "job"} className="grid grid-cols-[1fr_repeat(3,4rem)] items-center border-b border-line px-4 py-2.5 last:border-0">
          <span className="text-[14px] font-semibold">{r.name}</span>
          {HANDOVER_TRADES.map((t) => {
            const ok = done(r.id, t.id);
            return (
              <span key={t.id} className="grid place-items-center" aria-label={`${t.label} ${ok ? "handed over" : "not handed over"}`}>
                <span className={cn("grid size-7 place-items-center rounded-full", ok ? "bg-ok text-white" : "border-2 border-dashed border-line-strong")}>
                  {ok && <Check className="size-4" weight="bold" />}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function TradeChips({ scopes, className }: { scopes: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {scopes.length === 3
        ? <span className="rounded-md bg-signal px-1.5 py-px text-[12px] font-bold text-ink">Full handover</span>
        : HANDOVER_TRADES.filter((t) => scopes.includes(t.id)).map((t) => (
            <span key={t.id} className="rounded-md bg-ink px-1.5 py-px text-[12px] font-bold text-white">{t.label}</span>
          ))}
    </span>
  );
}
