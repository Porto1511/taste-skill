/* Formatting shared by server and client.  UK conventions, London time. */
const TZ = "Europe/London";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ,
});

/** Parse "YYYY-MM-DD" as a calendar date (no timezone shifting). */
function parseDay(value: string) {
  return value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

export const formatDate = (v: string | null | undefined) => (v ? dateFmt.format(parseDay(v)) : "—");
export const formatDay = (v: string | null | undefined) => (v ? dayFmt.format(parseDay(v)) : "—");
export const formatShortDate = (v: string | null | undefined) => (v ? shortFmt.format(parseDay(v)) : "—");
export const formatDateTime = (v: string | null | undefined) => (v ? dateTimeFmt.format(new Date(v)) : "—");
export const formatTime = (v: string) => timeFmt.format(new Date(v));

export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.round((now - t) / 1000);
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 6 * 3600) {
    const h = Math.floor(diff / 3600);
    return `${h} hr${h > 1 ? "s" : ""} ago`;
  }
  const today = shortFmt.format(new Date(now));
  const yesterday = shortFmt.format(new Date(now - 86400_000));
  const day = shortFmt.format(new Date(t));
  if (day === today) return `Today ${formatTime(iso)}`;
  if (day === yesterday) return `Yesterday ${formatTime(iso)}`;
  if (now - t < 6 * 86400_000) return `${dayFmt.format(new Date(t)).split(" ")[0]} ${formatTime(iso)}`;
  return formatDate(iso);
}

export function dateRange(from: string | null, to: string | null) {
  if (!from && !to) return null;
  if (from && to) return `${formatShortDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  return `Until ${formatDate(to)}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** "07700 900201" -> "tel:+447700900201" */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) return `tel:+44${digits.slice(1)}`;
  return `tel:${digits}`;
}

export function mapsHref(address: string, postcode?: string | null) {
  const q = [address, postcode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export const labels = {
  category: {
    delay: "Delay", access: "Access problem", edge_protection: "Missing edge protection", materials: "Materials problem",
    drawing_query: "Drawing query", safety: "Safety concern", other: "Other",
  } as Record<string, string>,
  kind: { issue: "Issue", progress: "Progress update", photo: "Photos" } as Record<string, string>,
  reportStatus: { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" } as Record<string, string>,
  revisionStatus: { draft: "Draft", approved: "Approved for use", superseded: "Superseded", withdrawn: "Withdrawn" } as Record<string, string>,
  jobStatus: { planned: "Planned", live: "Live", on_hold: "On hold", complete: "Complete" } as Record<string, string>,
  role: { admin: "MSW administrator", office: "MSW office", operative: "Operative", manager: "Subcontractor manager" } as Record<string, string>,
  priority: { normal: "Normal", high: "High", urgent: "Urgent" } as Record<string, string>,
  areaKind: { floor: "Floor", phase: "Phase", zone: "Zone", area: "Area" } as Record<string, string>,
};

/** 450 -> "7h 30m", 0 -> "–" */
export function fmtMinutes(m: number | null | undefined) {
  if (!m) return "–";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}
