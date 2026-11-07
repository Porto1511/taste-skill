/* Shared handover / completion certificate definitions (client + server).
   Wording follows MSW's paper certificates. */

export interface CertField { key: string; label: string; required?: boolean; multiline?: boolean; numeric?: boolean; placeholder?: string }
export interface TradeDef { id: "netting" | "deck" | "studs"; label: string; long: string; title: string; statement: string; fields: CertField[] }

export const HANDOVER_TRADES: TradeDef[] = [
  {
    id: "netting", label: "Nets", long: "Safety netting", title: "NETTING COMPLETION CERTIFICATE",
    statement: "The safety nets have been inspected and installed to FASET guidelines and European Standard BS EN 1263/2.",
    fields: [
      { key: "gridlines", label: "Gridlines / Level", required: true, multiline: true, placeholder: "e.g. Level 3, grids A–H / 1–6" },
      { key: "serials", label: "Serial numbers of nets used", multiline: true, placeholder: "e.g. N1 4471, N2 4472…" },
    ],
  },
  {
    id: "deck", label: "Deck", long: "Decking", title: "DECKING COMPLETION CERTIFICATE",
    statement: "This certificate is to confirm that we have installed the decking/trims in accordance with the manufacturer's recommendations and our working drawings.",
    fields: [
      { key: "area", label: "Area fixed (deck & edge trim)", required: true, multiline: true, placeholder: "e.g. Level 2, grids A–H / 1–6 incl. edge trims" },
    ],
  },
  {
    id: "studs", label: "Studs", long: "Stud welding", title: "STUD WELDING COMPLETION CERTIFICATE",
    statement: "This certificate is to confirm that we have installed the studs in accordance with our working drawings and method statement. All studs have been tested in accordance with the BCSA best practice: 100% ring test and 5% bend test.",
    fields: [
      { key: "floorLevel", label: "Floor level", required: true, placeholder: "e.g. Level 2" },
      { key: "totalStuds", label: "Total studs welded", numeric: true, placeholder: "e.g. 1240" },
      { key: "studSize", label: "Stud size", placeholder: "e.g. 19 × 100" },
    ],
  },
];

export const NOTES_FIELD = { key: "notes", label: "Notes / anything not finished", placeholder: "e.g. Decked over void at D3 as instructed by site manager" };

export const DAYS = [
  { id: "mon", label: "Monday", short: "Mon" }, { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" }, { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" }, { id: "sat", label: "Saturday", short: "Sat" },
  { id: "sun", label: "Sunday", short: "Sun" },
] as const;

export type HandoverDetails = Partial<Record<TradeDef["id"], Record<string, string>>>;

export const tradeDef = (id: string) => HANDOVER_TRADES.find((t) => t.id === id);
export const tradeLabel = (id: string) => tradeDef(id)?.label ?? id;
export const tradeLong = (id: string) => tradeDef(id)?.long ?? id;

/** "Nets", "Deck & studs", "Full handover" */
export function scopeSummary(scopes: string[]) {
  if (scopes.length === 3) return "Full handover";
  const names = HANDOVER_TRADES.filter((t) => scopes.includes(t.id)).map((t) => t.label);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)!.toLowerCase()}` : names[0] ?? "";
}

export const CLIENT_DECLARATION =
  "I confirm the work described on the certificate(s) above has been completed as stated, subject to any notes recorded.";

// ---------------------------------------------------------------------------
// Daywork sheets
// ---------------------------------------------------------------------------
export interface DayworkWorker { name: string; trade: string; hours: Record<(typeof DAYS)[number]["id"], number> }
export const DAYWORK_DECLARATION = "I confirm the hours and materials recorded on this daywork sheet.";

/** Town from an address line: the last part, e.g. "Great Russell Street, Bloomsbury, London" -> "London". */
export function townFrom(address: string) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.at(-1) ?? address;
}
