import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/viewer";
import { officeTimesheet, weekStart } from "@/server/queries/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimesheetReview } from "@/components/office/timesheet-review";
import { fmtMinutes, formatDateTime } from "@/lib/format";

export default async function OfficeTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await officeTimesheet(viewer, id);
  if (!t) notFound();
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${t.work_date}T12:00:00Z`));
  const rows: [string, string][] = [
    ["Job", t.job_number ? `${t.job_number} · ${t.job_name}` : t.location_note ?? "Other"],
    ["Travel", t.travel_mode === "driver" ? `Driving ${t.vehicle_reg ?? ""}` : t.travel_mode === "passenger" ? `Passenger ${t.vehicle_reg ?? ""}` : "No travel"],
    ["Travel to site", t.travel_out_start ? `${t.travel_out_start} – ${t.travel_out_end}` : "—"],
    ["On site", t.site_start ? `${t.site_start} – ${t.site_finish} (break ${t.break_minutes} min)` : "—"],
    ["Travel home", t.travel_back_start ? `${t.travel_back_start} – ${t.travel_back_end}` : "—"],
    ["Miles", t.mileage ? String(t.mileage) : "—"],
    ["Notes", t.notes ?? "—"],
  ];
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: `/office/timesheets?week=${weekStart(t.work_date)}`, label: "Timesheets" }} title={t.full_name} description={day} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[["On site", t.site_minutes], ["Driving", t.driving_minutes], ["Travel", t.travel_minutes]].map(([l, m]) => (
          <Card key={l as string} className="p-3"><p className="text-[12px] text-muted">{l}</p><p className={`tabular text-2xl font-semibold ${l === "Driving" && (m as number) > 600 ? "text-danger" : ""}`}>{fmtMinutes(m as number)}</p></Card>
        ))}
      </div>
      <Card className="divide-y divide-line">
        {rows.map(([k, v]) => <div key={k} className="flex gap-4 px-4 py-2.5 text-[14px]"><span className="w-32 shrink-0 text-muted">{k}</span><span className="font-medium">{v}</span></div>)}
      </Card>
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone={t.status === "approved" ? "ok" : t.status === "query" ? "danger" : "neutral"} dot>{t.status === "submitted" ? "Waiting for approval" : t.status === "approved" ? "Approved" : "Queried"}</Badge>
          {t.reviewed_at && <span className="text-[12px] text-muted">by {t.reviewed_by_name} · {formatDateTime(t.reviewed_at)}</span>}
        </div>
        {t.office_note && <p className="mb-3 rounded-lg bg-paper p-3 text-[14px]">“{t.office_note}”</p>}
        <TimesheetReview ids={[t.id]} />
      </Card>
    </div>
  );
}
