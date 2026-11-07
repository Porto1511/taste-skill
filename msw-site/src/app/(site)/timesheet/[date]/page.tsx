import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, PencilSimple, Car, Users } from "@phosphor-icons/react/dist/ssr";
import { requireViewer } from "@/server/auth/viewer";
import { londonToday, myTimesheetDay, weekStart } from "@/server/queries/timesheets";
import { deleteTimesheetEntryAction } from "@/server/actions/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { TimesheetForm } from "@/components/timesheet/timesheet-form";
import { summariseDay, workLabel } from "@/lib/timesheet";
import { fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Timesheet" };

export default async function TimesheetDayPage({ params, searchParams }: {
  params: Promise<{ date: string }>; searchParams: Promise<{ add?: string; edit?: string; saved?: string }>;
}) {
  const viewer = await requireViewer();
  if (!viewer.keepsTimesheet) notFound();
  const { date } = await params;
  const { add, edit, saved } = await searchParams;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > londonToday()) notFound();
  const { entries, jobs, last } = await myTimesheetDay(viewer, date);
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const day = summariseDay(entries);
  const editing = edit ? entries.find((e) => e.id === edit) ?? null : null;
  const showForm = entries.length === 0 || add === "1" || Boolean(editing);
  const back = { href: `/timesheet?week=${weekStart(date)}`, label: "Timesheet" };

  if (showForm) {
    const readOnly = editing?.status === "approved";
    return (
      <div>
        <PageHeader back={entries.length ? { href: `/timesheet/${date}`, label } : back} title={editing ? "Edit job" : entries.length ? "Add another job" : label}
          description={entries.length && !editing ? label : undefined} />
        {editing?.status === "query" && <Alert tone="danger" className="mb-4" title="Query from the office">{editing.office_note ?? "Please check and resubmit."}</Alert>}
        {readOnly && <Alert tone="ok" className="mb-4">Approved — contact the office if something is wrong.</Alert>}
        <TimesheetForm key={editing?.id ?? "new"} date={date} sheet={editing} jobs={jobs} last={last} readOnly={readOnly}
          previous={!editing && entries.length ? entries[entries.length - 1] : null} />
        {editing && !readOnly && (
          <form action={deleteTimesheetEntryAction} className="mt-2 text-center">
            <input type="hidden" name="entryId" value={editing.id} />
            <input type="hidden" name="workDate" value={date} />
            <button className="py-3 text-[14px] font-semibold text-danger">Delete this job from the day</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader back={back} title={label} />
      {saved && <Alert tone="ok" className="mb-3">Saved and sent to the office. Went to another job today? Add it below.</Alert>}
      {day.status === "query" && <Alert tone="danger" className="mb-3" title="Query from the office">{entries.find((e) => e.status === "query")?.office_note ?? "Please check and resubmit."}</Alert>}

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-ink p-3 text-center text-white">
        {[["On site", day.site], ["Driving", day.driving], ["Travel", day.travel]].map(([l, m]) => (
          <div key={l as string}><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{l}</p><p className="tabular text-[20px] font-semibold">{fmtMinutes(m as number)}</p></div>
        ))}
      </div>

      <ol className="grid gap-2">
        {entries.map((e, i) => {
          const Mode = e.travel_mode === "passenger" ? Users : Car;
          return (
            <li key={e.id}>
              <Link href={`/timesheet/${date}?edit=${e.id}`} className="block rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-signal text-[14px] font-bold text-ink">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{e.job_number ? `${e.job_number} · ${e.job_name}` : e.location_note ?? "Other"}</p>
                    {e.work_done.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">{e.work_done.map((w) => <span key={w} className="rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-white">{workLabel(w)}</span>)}</div>
                    )}
                    {e.work_description && <p className="mt-1.5 text-[14px] text-muted">{e.work_description}</p>}
                    <div className="mt-2 grid gap-0.5 text-[13px] tabular text-muted">
                      <span className="inline-flex items-center gap-1.5"><Mode className="size-4" />
                        {e.travel_mode === "passenger" ? `Passenger${e.driven_by ? ` with ${e.driven_by}` : ""}` : `Drove${e.vehicle_reg ? ` ${e.vehicle_reg}` : ""}`}
                      </span>
                      {e.travel_out_start && <span>Set off {e.travel_out_start} · arrived {e.travel_out_end}</span>}
                      {e.travel_back_start && <span>Left site {e.travel_back_start}{e.travel_back_end ? ` · got back ${e.travel_back_end}` : " · on to next job"}</span>}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                    e.status === "approved" ? "bg-ok-soft text-ok" : e.status === "query" ? "bg-danger text-white" : "bg-ink/[0.07] text-muted")}>
                    {e.status === "submitted" ? "Sent" : e.status}
                  </span>
                </div>
                {e.status !== "approved" && <p className="mt-2 flex items-center justify-end gap-1 text-[12px] font-semibold text-signal-ink"><PencilSimple className="size-3.5" /> Edit</p>}
              </Link>
            </li>
          );
        })}
      </ol>

      <Link href={`/timesheet/${date}?add=1`} className="mt-3 flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/30 bg-card text-[16px] font-semibold">
        <Plus className="size-5" weight="bold" /> Add another job
      </Link>
      <Link href={back.href} className="mt-2 flex h-14 items-center justify-center rounded-xl bg-ink text-[16px] font-semibold text-white">Done</Link>
    </div>
  );
}
