/* Site visit checklist (office only). Shared by the form, the report page and the PDF. */

export const VISIT_TYPES = [
  { id: "pre_start", label: "Pre-start" },
  { id: "progress", label: "Progress check" },
  { id: "snagging", label: "Snagging" },
] as const;

export const ANSWERS = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "partial", label: "Partial" },
  { id: "na", label: "N/A" },
] as const;

export const AREA_STATUS = [
  { id: "ready", label: "Ready" },
  { id: "part", label: "Part ready" },
  { id: "not_ready", label: "Not ready" },
] as const;

export const CHECKLIST: { title: string; items: { key: string; label: string; hint?: string }[] }[] = [
  { title: "What's ready", items: [
    { key: "steel_signed_off", label: "Steel erected and signed off" },
    { key: "previous_trades", label: "Previous trades finished" },
    { key: "drawings_match", label: "Drawings match what's on site" },
  ] },
  { title: "Access & safety", items: [
    { key: "handrails", label: "Handrails / edge protection on", hint: "Note where they aren't" },
    { key: "mewp", label: "MEWP needed", hint: "Type (scissor/boom), size, who supplies it" },
    { key: "ground", label: "Ground OK for a MEWP", hint: "Hardstanding, slopes" },
    { key: "crane", label: "Crane / hoist available", hint: "Does it need booking?" },
    { key: "laydown", label: "Lay-down / storage area" },
    { key: "voids", label: "Voids and openings protected (by the client)" },
    { key: "welfare", label: "Lighting and welfare (toilets, canteen)" },
  ] },
  { title: "Getting in & working", items: [
    { key: "parking", label: "Parking", hint: "On site, nearby, cost" },
    { key: "gateman", label: "Gateman / delivery booking", hint: "Slots, hours, vehicle size limits" },
    { key: "site_hours", label: "Site hours / noise restrictions" },
    { key: "induction", label: "Induction", hint: "Online link, or in person" },
    { key: "cards", label: "Cards needed", hint: "CSCS, IPAF, PASMA" },
    { key: "permits", label: "Permits", hint: "Hot works for stud welding" },
    { key: "power", label: "Power for stud welding", hint: "On site, or bring a generator" },
  ] },
];
export const CHECKLIST_KEYS = CHECKLIST.flatMap((g) => g.items.map((i) => i.key));

export const READY_OUTCOMES = [
  { id: "yes", label: "Ready to start" },
  { id: "conditional", label: "Yes, if…" },
  { id: "no", label: "Not yet" },
] as const;

export const BLOCKER_OWNERS = [{ id: "client", label: "Client" }, { id: "msw", label: "MSW" }] as const;
export const BLOCKER_SEVERITY = [{ id: "stops", label: "Stops the start" }, { id: "slows", label: "Slows us down" }] as const;

export const labelOf = (list: readonly { id: string; label: string }[], id: string | null | undefined) => list.find((x) => x.id === id)?.label ?? "—";

export type Answer = (typeof ANSWERS)[number]["id"];
export interface VisitArea { name: string; status: (typeof AREA_STATUS)[number]["id"]; note: string; expected: string }
export interface VisitBlocker { text: string; owner: "client" | "msw"; severity: "stops" | "slows"; cleared_at?: string | null }
export interface VisitAction { what: string; who: string; by: string }
