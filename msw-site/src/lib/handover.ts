/* Shared handover definitions (client + server). */
export interface TradeDef { id: string; label: string; long: string; checks: string[] }

const CLEAR = "Area clear of MSW materials, offcuts and waste";

export const HANDOVER_TRADES: TradeDef[] = [
  {
    id: "netting", label: "Nets", long: "Safety netting",
    checks: ["Nets installed to the current netting layout", "Nets tied off and inspected", CLEAR],
  },
  {
    id: "deck", label: "Deck", long: "Metal decking",
    checks: ["Metal deck laid and fixed to current drawings", "Edge trims installed and restrained", CLEAR],
  },
  {
    id: "studs", label: "Studs", long: "Shear studs",
    checks: ["Shear studs complete to the current stud layout", CLEAR],
  },
];

export type HandoverTrade = "netting" | "deck" | "studs";
export const tradeLabel = (id: string) => HANDOVER_TRADES.find((t) => t.id === id)?.label ?? id;
export const tradeLong = (id: string) => HANDOVER_TRADES.find((t) => t.id === id)?.long ?? id;

/** "Nets", "Deck & studs", "Full handover" */
export function scopeSummary(scopes: string[]) {
  if (scopes.length === 3) return "Full handover";
  const names = HANDOVER_TRADES.filter((t) => scopes.includes(t.id)).map((t) => t.label);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)!.toLowerCase()}` : names[0] ?? "";
}
