import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { addDays, londonToday, myTimesheetWeek, weekStart } from "@/server/queries/timesheets";
import { Alert } from "@/components/ui/form";
import { fmtMinutes, formatShortDate } from "@/lib/format";
import { summariseDay } from "@/lib/timesheet";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Timesheet" };

const statusChip = {
  submitted: "bg-ink/[0.07] text-muted",
  approved: "bg-ok-soft text-ok",
  query: "bg-danger text-white",
} as const;

export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.keepsTimesheet) notFound();
  const { week } = await searchParams;
  const today = londonToday();
  const monday = weekStart(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const rows = await myTimesheetWeek(viewer, monday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const total = rows.reduce((t, r) => ({ site: t.site + r.site_minutes, drive: t.drive + r.driving_minutes, travel: t.travel + r.travel_minutes }), { site: 0, drive: 0, travel: 0 });
  const queries = rows.filter((r) => r.status === "query");
  const isThisWeek = monday === weekStart(today);

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Timesheet</h1>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-card p-1.5 shadow-[var(--shadow-card)] ring-1 ring-line">
        <Link href={`/timesheet?week=${addDays(monday, -7)}`} className="grid size-11 place-items-center rounded-xl hover:bg-paper" aria-label="Previous week"><CaretLeft className="size-5" weight="bold" /></Link>
        <p className="text-[15px] font-semibold">{isThisWeek ? "This week" : `Week of ${formatShortDate(monday)}`}<span className="ml-2 font-normal text-muted">{formatShortDate(monday)} – {formatShortDate(addDays(monday, 6))}</span></p>
        <Link href={`/timesheet?week=${addDays(monday, 7)}`} aria-disabled={isThisWeek} className={cn("grid size-11 place-items-center rounded-xl hover:bg-paper", isThisWeek && "pointer-events-none opacity-25")} aria-label="Next week"><CaretRight className="size-5" weight="bold" /></Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[["On site", total.site], ["Driving", total.drive], ["Travel", total.travel]].map(([l, m]) => (
          <div key={l as string} className="rounded-2xl border border-line bg-card py-2.5">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{l}</p>
            <p className="tabular text-[19px] font-semibold">{fmtMinutes(m as number)}</p>
          </div>
        ))}
      </div>

      
      {queries.length > 0 && <Alert tone="danger" className="mt-3" title="The office has a question">Tap the day marked “Query” to see what needs checking.</Alert>}

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
        {days.map((d) => {
          const dayRows = rows.filter((x) => x.work_date === d);
          const r = dayRows.length ? summariseDay(dayRows) : null;
          const future = d > today;
          const name = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
          const inner = (
            <>
              <span className={cn("w-12 shrink-0 text-center", d === today && "text-brand")}>
                <span className="block text-[12px] font-bold uppercase">{name}</span>
                <span className="block text-[20px] font-semibold leading-none">{Number(d.slice(8))}</span>
              </span>
              {r ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {dayRows.length === 1 ? (dayRows[0].job_number ? `${dayRows[0].job_number} · ${dayRows[0].job_name}` : dayRows[0].location_note ?? "Other") : `${dayRows.length} jobs · ${r.jobs.join(", ")}`}
                  </span>
                  <span className="tabular block text-[13px] text-muted">Site {fmtMinutes(r.site)} · Driving {fmtMinutes(r.driving)}</span>
                </span>
              ) : (
                <span className="flex-1 text-[14px] text-subtle">{future ? "" : "Nothing logged"}</span>
              )}
              {r ? (
                <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold uppercase", statusChip[r.status!])}>{r.status === "submitted" ? "Sent" : r.status}</span>
              ) : !future ? (
                <span className="grid size-9 place-items-center rounded-full bg-brand text-white"><Plus className="size-5" weight="bold" /></span>
              ) : null}
            </>
          );
          return (
            <li key={d}>
              {future ? <div className="flex min-h-16 items-center gap-3 px-3 py-2 opacity-60">{inner}</div>
                : <Link href={`/timesheet/${d}`} className="flex min-h-16 items-center gap-3 px-3 py-2 active:bg-paper">{inner}</Link>}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12.5px] text-muted">Fill in each day. Went to more than one job? Add each one to the same day. The office approves or queries your days.</p>
    </div>
  );
}
