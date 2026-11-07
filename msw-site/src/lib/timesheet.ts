/* Shared (client + server) timesheet helpers. */
export interface DayEntry {
  status: "submitted" | "approved" | "query";
  site_minutes: number; driving_minutes: number; travel_minutes: number;
  job_number: string | null; location_note: string | null;
}

/** Summarise a day's entries (several jobs in one day). */
export function summariseDay(entries: DayEntry[]) {
  const status: DayEntry["status"] | null = !entries.length ? null
    : entries.some((e) => e.status === "query") ? "query"
    : entries.every((e) => e.status === "approved") ? "approved" : "submitted";
  return {
    site: entries.reduce((s, e) => s + e.site_minutes, 0),
    driving: entries.reduce((s, e) => s + e.driving_minutes, 0),
    travel: entries.reduce((s, e) => s + e.travel_minutes, 0),
    status,
    jobs: entries.map((e) => e.job_number ?? (e.location_note ? e.location_note.split(" —")[0] : "Other")),
  };
}

export const WORK_TYPES: { id: string; label: string }[] = [
  { id: "deck", label: "Deck" },
  { id: "studs", label: "Studs" },
  { id: "netting", label: "Netting" },
  { id: "edge_trims", label: "Edge trims" },
  { id: "edge_protection", label: "Edge protection" },
  { id: "concrete", label: "Concrete" },
  { id: "other", label: "Other" },
];
export const workLabel = (id: string) => WORK_TYPES.find((w) => w.id === id)?.label ?? id;
