import { getViewer } from "@/server/auth/viewer";
import { addDays, londonToday, officeTimesheetWeek, weekStart } from "@/server/queries/timesheets";
import { notFound } from "@/server/files/serve";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const hours = (m: number) => (m / 60).toFixed(2);

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return notFound();
  const week = new URL(request.url).searchParams.get("week");
  const monday = weekStart(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : londonToday());
  const people = await officeTimesheetWeek(viewer, monday);
  const lines = [["Date", "Operative", "Job", "Location", "Travel", "Vehicle", "Travel out", "On site", "Break mins", "Travel back",
    "Site hours", "Driving hours", "Travel hours", "Miles", "Status", "Office note", "Notes"].join(",")];
  for (const p of people) for (const t of p.days) {
    lines.push([t.work_date, p.full_name, t.job_number ?? "", t.location_note ?? "", t.travel_mode, t.vehicle_reg ?? "",
      t.travel_out_start ? `${t.travel_out_start}-${t.travel_out_end}` : "", t.site_start ? `${t.site_start}-${t.site_finish}` : "",
      t.break_minutes, t.travel_back_start ? `${t.travel_back_start}-${t.travel_back_end}` : "",
      hours(t.site_minutes), hours(t.driving_minutes), hours(t.travel_minutes), t.mileage ?? "", t.status, t.office_note ?? "", t.notes ?? ""].map(csv).join(","));
  }
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="MSW-timesheets-${monday}-to-${addDays(monday, 6)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
