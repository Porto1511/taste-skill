/** Cards and tickets a lad carries on site. Free text is allowed for anything else. */
export const CARD_TYPES = [
  "CSCS card",
  "FASET netting ticket",
  "IPAF (MEWP)",
  "PASMA (towers)",
  "Working at height",
  "Harness inspection",
  "First aid",
  "SSSTS",
  "SMSTS",
  "Asbestos awareness",
  "Stud welding",
] as const;

export type ExpiryState = "expired" | "soon" | "ok" | "none";

/** Expired, due within 60 days, fine, or no expiry date. `today` is YYYY-MM-DD. */
export function expiryState(expiresOn: string | null, today: string): ExpiryState {
  if (!expiresOn) return "none";
  if (expiresOn < today) return "expired";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 60);
  return expiresOn <= soon.toISOString().slice(0, 10) ? "soon" : "ok";
}
