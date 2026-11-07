import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

export interface TimesheetRow {
  id: string; user_id: string; work_date: string; job_id: string | null; job_number: string | null; job_name: string | null;
  location_note: string | null; vehicle_reg: string | null; travel_mode: "driver" | "passenger" | "none"; driven_by: string | null;
  travel_out_start: string | null; travel_out_end: string | null; site_start: string | null; site_finish: string | null;
  break_minutes: number; travel_back_start: string | null; travel_back_end: string | null; mileage: number | null;
  notes: string | null; status: "submitted" | "approved" | "query"; office_note: string | null;
  work_done: string[]; work_description: string | null;
  travel_minutes: number; driving_minutes: number; site_minutes: number; reviewed_at: string | null; reviewed_by_name: string | null;
  updated_at: string;
}

const cols = `t.id, t.user_id, t.work_date, t.job_id, j.job_number, j.name as job_name, t.location_note, t.vehicle_reg, t.travel_mode, t.driven_by,
  to_char(t.travel_out_start, 'HH24:MI') as travel_out_start, to_char(t.travel_out_end, 'HH24:MI') as travel_out_end,
  to_char(t.site_start, 'HH24:MI') as site_start, to_char(t.site_finish, 'HH24:MI') as site_finish, t.break_minutes,
  to_char(t.travel_back_start, 'HH24:MI') as travel_back_start, to_char(t.travel_back_end, 'HH24:MI') as travel_back_end,
  t.mileage, t.notes, t.status, t.office_note, t.work_done, t.work_description, t.travel_minutes, t.driving_minutes, t.site_minutes, t.reviewed_at,
  rb.full_name as reviewed_by_name, t.updated_at`;
const entryOrder = "coalesce(t.travel_out_start, t.travel_out_end), t.created_at";
const from = `from timesheets t left join jobs j on j.id = t.job_id left join profiles rb on rb.id = t.reviewed_by`;

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export async function myTimesheetWeek(viewer: Viewer, monday: string) {
  return withUser(viewer.id, async (tx) =>
    (await tx.query<TimesheetRow>(`select ${cols} ${from} where t.user_id = auth.uid() and t.work_date between $1 and $2 order by t.work_date, ${entryOrder}`,
      [monday, addDays(monday, 6)])).rows,
  );
}

export async function myTimesheetDay(viewer: Viewer, date: string) {
  return withUser(viewer.id, async (tx) => {
    const entries = (await tx.query<TimesheetRow>(`select ${cols} ${from} where t.user_id = auth.uid() and t.work_date = $1 order by ${entryOrder}`, [date])).rows;
    const jobs = (await tx.query<{ id: string; job_number: string; name: string }>(
      `select j.id, j.job_number, j.name from jobs j
       join job_assignments a on a.job_id = j.id and a.user_id = auth.uid() and a.revoked_at is null
       order by j.job_number`,
    )).rows;
    const last = (await tx.query<{ vehicle_reg: string | null; travel_mode: string }>(
      "select vehicle_reg, travel_mode from timesheets where user_id = auth.uid() order by work_date desc limit 1",
    )).rows[0] ?? null;
    return { entries, jobs, last };
  });
}

export interface OfficeTimesheetPerson {
  user_id: string; full_name: string; job_title: string | null; days: TimesheetRow[];
}

export async function officeTimesheetWeek(viewer: Viewer, monday: string): Promise<OfficeTimesheetPerson[]> {
  return withUser(viewer.id, async (tx) => {
    const people = (await tx.query<{ user_id: string; full_name: string; job_title: string | null }>(
      `select p.id as user_id, p.full_name, p.job_title from profiles p join companies c on c.id = p.company_id
       where c.is_msw and p.role = 'operative' and (p.active or exists (
         select 1 from timesheets t where t.user_id = p.id and t.work_date between $1 and $2))
       order by p.full_name`,
      [monday, addDays(monday, 6)],
    )).rows;
    const rows = (await tx.query<TimesheetRow>(`select ${cols} ${from} where t.work_date between $1 and $2 order by t.work_date, ${entryOrder}`,
      [monday, addDays(monday, 6)])).rows;
    return people.map((p) => ({ ...p, days: rows.filter((r) => r.user_id === p.user_id) }));
  });
}

/** All entries for the person and day that the given entry belongs to. */
export async function officeTimesheetDay(viewer: Viewer, id: string) {
  return withUser(viewer.id, async (tx) => {
    const anchor = (await tx.query<{ user_id: string; work_date: string; full_name: string }>(
      "select t.user_id, t.work_date, p.full_name from timesheets t join profiles p on p.id = t.user_id where t.id = $1", [id],
    )).rows[0];
    if (!anchor) return null;
    const entries = (await tx.query<TimesheetRow>(
      `select ${cols} ${from} where t.user_id = $1 and t.work_date = $2 order by ${entryOrder}`, [anchor.user_id, anchor.work_date],
    )).rows;
    return { ...anchor, entries };
  });
}

