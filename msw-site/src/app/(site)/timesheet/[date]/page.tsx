import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/viewer";
import { londonToday, myTimesheetDay, weekStart } from "@/server/queries/timesheets";
import { deleteTimesheetAction } from "@/server/actions/timesheets";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/form";
import { TimesheetForm } from "@/components/timesheet/timesheet-form";

export const metadata: Metadata = { title: "Timesheet" };

export default async function TimesheetDayPage({ params }: { params: Promise<{ date: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.keepsTimesheet) notFound();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > londonToday()) notFound();
  const { sheet, jobs, last } = await myTimesheetDay(viewer, date);
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const approved = sheet?.status === "approved";
  return (
    <div>
      <PageHeader back={{ href: `/timesheet?week=${weekStart(date)}`, label: "Timesheet" }} title={label} />
      {sheet?.status === "query" && <Alert tone="danger" className="mb-4" title="Query from the office">{sheet.office_note ?? "Please check this day and resubmit."}</Alert>}
      {approved && <Alert tone="ok" className="mb-4" title="Approved">{sheet.reviewed_by_name ? `Approved by ${sheet.reviewed_by_name}. ` : ""}Approved days can&apos;t be changed — contact the office if something is wrong.</Alert>}
      <TimesheetForm date={date} sheet={sheet} jobs={jobs} last={last} readOnly={approved} />
      {sheet && !approved && (
        <form action={deleteTimesheetAction} className="mt-2 text-center">
          <input type="hidden" name="workDate" value={date} />
          <button className="py-3 text-[14px] font-semibold text-danger">Delete this day</button>
        </form>
      )}
    </div>
  );
}
