import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { officeTimesheetDay, weekStart } from "@/server/queries/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimesheetReview } from "@/components/office/timesheet-review";
import { fmtMinutes, formatDateTime } from "@/lib/format";
import { summariseDay, workLabel } from "@/lib/timesheet";

function app(a: string, b: string) {
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  const d = m(b) - m(a);
  return d >= 0 ? d : d + 1440;
}

export default async function OfficeTimesheetDayPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await officeTimesheetDay(viewer, id);
  if (!data) notFound();
  const { entries, full_name, work_date } = data;
  const day = summariseDay(entries);
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${work_date}T12:00:00Z`));
  const reviewed = entries.find((e) => e.reviewed_at);
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: `/office/timesheets?week=${weekStart(work_date)}`, label: "Timesheets" }} title={full_name} description={label} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[["On site", day.site], ["Driving", day.driving], ["Travel", day.travel]].map(([l, m]) => (
          <Card key={l as string} className="p-3"><p className="text-[12px] text-muted">{l}</p><p className="tabular text-2xl font-semibold">{fmtMinutes(m as number)}</p></Card>
        ))}
      </div>
      <div className="grid gap-3">
        {entries.map((t, i) => {
          const rows: [string, string][] = [
            ["Work done", [t.work_done.map(workLabel).join(", "), t.work_description].filter(Boolean).join(" — ") || "—"],
            ["Premium time", t.premium ? "Yes" : "No"],
            ["Travel", t.travel_mode === "passenger" ? `Passenger${t.driven_by ? ` — driven by ${t.driven_by}` : ""}${t.vehicle_reg ? ` (${t.vehicle_reg})` : ""}` : `Driving ${t.vehicle_reg ?? ""}`],
            ["Set off / arrived", t.travel_out_start ? `${t.travel_out_start} → ${t.travel_out_end} (${fmtMinutes(app(t.travel_out_start, t.travel_out_end ?? t.travel_out_start))})` : "—"],
            ["On site", t.travel_out_end && t.travel_back_start ? `${t.travel_out_end} → ${t.travel_back_start} (${fmtMinutes(t.site_minutes)})` : "—"],
            ["Left site / back", t.travel_back_start ? (t.travel_back_end ? `${t.travel_back_start} → ${t.travel_back_end} (${fmtMinutes(app(t.travel_back_start, t.travel_back_end))})` : `${t.travel_back_start} → on to next job`) : "—"],
            ...(t.mileage ? [["Miles", String(t.mileage)] as [string, string]] : []),
            ...(t.notes ? [["Notes", t.notes] as [string, string]] : []),
          ];
          return (
            <Card key={t.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
                <p className="font-semibold">{i + 1}. {t.job_number ? `${t.job_number} · ${t.job_name}` : t.location_note ?? "Other"}</p>
                <span className="tabular text-[13px] text-muted">Site {fmtMinutes(t.site_minutes)} · Drv {fmtMinutes(t.driving_minutes)}</span>
              </div>
              <div className="divide-y divide-line">
                {rows.map(([k, v]) => <div key={k} className="flex gap-4 px-4 py-2 text-[14px]"><span className="w-28 shrink-0 text-muted">{k}</span><span className="font-medium">{v}</span></div>)}
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone={day.status === "approved" ? "ok" : day.status === "query" ? "danger" : "neutral"} dot>{day.status === "submitted" ? "Waiting for approval" : day.status === "approved" ? "Approved" : "Queried"}</Badge>
          {reviewed && <span className="text-[12px] text-muted">by {reviewed.reviewed_by_name} · {formatDateTime(reviewed.reviewed_at)}</span>}
        </div>
        {reviewed?.office_note && <p className="mb-3 rounded-lg bg-paper p-3 text-[14px]">“{reviewed.office_note}”</p>}
        <TimesheetReview ids={entries.map((e) => e.id)} label="Approve day" />
      </Card>
    </div>
  );
}
