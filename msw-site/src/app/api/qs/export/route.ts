import { getViewer } from "@/server/auth/viewer";
import { notFound } from "@/server/files/serve";
import { qsSummary } from "@/server/queries/qs";
import { londonToday } from "@/server/queries/timesheets";
import { parseQsParams } from "@/lib/qs";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One CSV for the QS: a line per person per day of daywork, then deliveries, then MSW travel. */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return notFound();
  const f = parseQsParams(Object.fromEntries(new URL(request.url).searchParams), londonToday());
  const d = await qsSummary(viewer, f);
  const lines = [["Record", "Date", "Job", "Company", "Type", "Name / item", "Trade / quantity", "Hours", "Signed / received by", "Sheet W/C"].join(",")];
  for (const l of d.daywork) {
    lines.push(["Daywork", l.day, l.job_number, l.company, l.kind === "standing" ? "Standing time" : "Extra work", l.person, l.trade, l.hours, l.client_name, l.week_commencing].map(csv).join(","));
  }
  for (const v of d.deliveries) for (const i of v.items) {
    lines.push(["Delivery", v.signed_at.slice(0, 10), v.job_number, v.company, `Delivered by ${v.delivered_by}`, i.description, i.quantity, "", v.receiver_name, ""].map(csv).join(","));
  }
  for (const t of d.travel) {
    lines.push(["MSW travel", `${f.from} to ${f.to}`, "", "MSW", "Driving", t.full_name, `${t.days} days, ${t.miles} miles`, (t.driving_minutes / 60).toFixed(2), "", ""].map(csv).join(","));
  }
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="MSW-QS-check-${f.from}-to-${f.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
