import type { Metadata } from "next";
import Link from "next/link";
import { CaretLeft, CaretRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { requireStaff } from "@/server/auth/viewer";
import { addDays, londonToday, officeTimesheetWeek, weekStart } from "@/server/queries/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { TimesheetReview } from "@/components/office/timesheet-review";
import { fmtMinutes, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Timesheets" };

export default async function OfficeTimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const viewer = await requireStaff();
  const { week } = await searchParams;
  const monday = weekStart(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : londonToday());
  const people = await officeTimesheetWeek(viewer, monday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const pending = people.flatMap((p) => p.days.filter((d) => d.status === "submitted").map((d) => d.id));
  return (
    <div>
      <PageHeader title="Timesheets" description="Daily hours from MSW's own operatives: time on site, driving and travel. Hours only — no rates or pay."
        actions={<ButtonLink href={`/api/timesheets/export?week=${monday}`} external><DownloadSimple className="size-5" /> Export CSV</ButtonLink>} />
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/office/timesheets?week=${addDays(monday, -7)}`} className="grid size-10 place-items-center rounded-xl border border-line bg-card" aria-label="Previous week"><CaretLeft className="size-5" /></Link>
        <p className="font-semibold">Week of {formatShortDate(monday)} – {formatShortDate(addDays(monday, 6))}</p>
        <Link href={`/office/timesheets?week=${addDays(monday, 7)}`} className="grid size-10 place-items-center rounded-xl border border-line bg-card" aria-label="Next week"><CaretRight className="size-5" /></Link>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left">Operative</th>
              {days.map((d) => <th key={d} className="px-2 py-2.5 text-center">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))}</th>)}
              <th className="px-4 py-2.5 text-right">Week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {people.map((p) => {
              const site = p.days.reduce((s, d) => s + d.site_minutes, 0);
              const drive = p.days.reduce((s, d) => s + d.driving_minutes, 0);
              return (
                <tr key={p.user_id}>
                  <td className="px-4 py-2.5"><span className="font-semibold">{p.full_name}</span><span className="block text-[12px] text-muted">{p.job_title}</span></td>
                  {days.map((d) => {
                    const r = p.days.find((x) => x.work_date === d);
                    return (
                      <td key={d} className="px-1.5 py-1.5 text-center">
                        {r ? (
                          <Link href={`/office/timesheets/${r.id}`} className={cn("block rounded-lg px-1.5 py-1.5 ring-1",
                            r.status === "approved" ? "bg-ok-soft ring-ok/20" : r.status === "query" ? "bg-danger-soft ring-danger/30" : "bg-card ring-line hover:ring-ink/30")}>
                            <span className="tabular block font-semibold">{fmtMinutes(r.site_minutes)}</span>
                            <span className={cn("tabular block text-[11px]", r.driving_minutes > 600 ? "font-bold text-danger" : "text-muted")}>{r.driving_minutes ? `${fmtMinutes(r.driving_minutes)} drv` : r.job_number ?? "—"}</span>
                          </Link>
                        ) : <span className="text-subtle">·</span>}
                      </td>
                    );
                  })}
                  <td className="tabular px-4 py-2.5 text-right"><span className="font-semibold">{fmtMinutes(site)}</span><span className="block text-[11px] text-muted">{fmtMinutes(drive)} driving</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-muted">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-ok-soft ring-1 ring-ok/30" />Approved</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-card ring-1 ring-line" />Waiting for approval</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-danger-soft ring-1 ring-danger/30" />Queried</span>
        <span className="font-semibold text-danger">Red driving = over 10h in a day</span>
      </div>
      {pending.length > 0 && (
        <Card className="mt-6 max-w-xl p-4">
          <p className="mb-2 font-semibold">{pending.length} day{pending.length === 1 ? "" : "s"} waiting for approval this week</p>
          <TimesheetReview ids={pending} label={`Approve all ${pending.length}`} />
        </Card>
      )}
    </div>
  );
}
