import "server-only";
import { withUser } from "../db";
import type { Viewer } from "../auth/viewer";

/**
 * QS check: quantities recorded on site for a date range — daywork hours
 * (standing time / extra work), deliveries, handovers and MSW travel — to
 * check against subcontractor invoices.  Hours and counts only, no rates.
 * Runs as the signed-in user, so database policies still apply.
 */
export interface QsFilter { from: string; to: string; jobId?: string; companyId?: string }

export interface DayworkLine {
  daywork_id: string; kind: "standing" | "extra"; job_id: string; job_number: string; job_name: string;
  company_id: string; company: string; week_commencing: string; client_name: string; signed_at: string;
  person: string; trade: string; day: string; hours: number;
}
export interface QsDelivery {
  id: string; job_id: string; job_number: string; company_id: string; company: string; delivered_by: string;
  vehicle_reg: string | null; receiver_name: string; signed_at: string; item_count: number; items: { description: string; quantity: string }[];
  notes: string | null;
}
export interface QsHandover { id: string; job_number: string; title: string; scopes: string[]; company: string; signed_at: string }
export interface QsTravel {
  user_id: string; full_name: string; days: number; entries: number; driving_minutes: number; passenger_minutes: number;
  site_minutes: number; miles: number; unapproved: number;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const londonDay = (col: string) => `(${col} at time zone 'Europe/London')::date`;

export async function qsSummary(viewer: Viewer, f: QsFilter) {
  return withUser(viewer.id, async (tx) => {
    const args = [f.from, f.to, f.jobId ?? null, f.companyId ?? null];
    const daywork = (await tx.query<DayworkLine>(
      `select d.id as daywork_id, d.kind, d.job_id, j.job_number, j.name as job_name, d.captured_by_company_id as company_id,
              d.captured_by_company as company, d.week_commencing::text, d.client_name, d.signed_at,
              w->>'name' as person, coalesce(w->>'trade', '') as trade, (d.week_commencing + (o.n - 1)::int)::text as day,
              (w->'hours'->>o.day)::float as hours
         from dayworks d
         join jobs j on j.id = d.job_id
         cross join lateral jsonb_array_elements(d.workers) w
         cross join lateral unnest($5::text[]) with ordinality o(day, n)
        where coalesce((w->'hours'->>o.day)::numeric, 0) > 0
          and d.week_commencing + (o.n - 1)::int between $1::date and $2::date
          and ($3::uuid is null or d.job_id = $3) and ($4::uuid is null or d.captured_by_company_id = $4)
        order by d.captured_by_company, j.job_number, d.week_commencing, d.id, w->>'name', o.n`,
      [...args, DAYS],
    )).rows;

    const deliveries = (await tx.query<QsDelivery>(
      `select v.id, v.job_id, j.job_number, v.captured_by_company_id as company_id, v.captured_by_company as company,
              v.delivered_by, v.vehicle_reg, v.receiver_name, v.signed_at, jsonb_array_length(v.items) as item_count, v.items, v.notes
         from deliveries v join jobs j on j.id = v.job_id
        where ${londonDay("v.signed_at")} between $1::date and $2::date
          and ($3::uuid is null or v.job_id = $3) and ($4::uuid is null or v.captured_by_company_id = $4)
        order by v.signed_at`,
      args,
    )).rows;

    const handovers = (await tx.query<QsHandover>(
      `select h.id, j.job_number, h.title, h.scopes, h.captured_by_company as company, h.signed_at
         from handovers h join jobs j on j.id = h.job_id left join profiles p on p.id = h.captured_by
        where ${londonDay("h.signed_at")} between $1::date and $2::date
          and ($3::uuid is null or h.job_id = $3) and ($4::uuid is null or p.company_id = $4)
        order by h.signed_at`,
      args,
    )).rows;

    // MSW's own operatives only (subcontractors don't keep timesheets).
    const travel = (await tx.query<QsTravel>(
      `select t.user_id, p.full_name, count(distinct t.work_date)::int as days, count(*)::int as entries,
              sum(t.driving_minutes)::int as driving_minutes, sum(t.travel_minutes - t.driving_minutes)::int as passenger_minutes,
              sum(t.site_minutes)::int as site_minutes, coalesce(sum(t.mileage), 0)::int as miles,
              count(*) filter (where t.status <> 'approved')::int as unapproved
         from timesheets t join profiles p on p.id = t.user_id
        where t.work_date between $1::date and $2::date
          and ($3::uuid is null or t.job_id = $3) and ($4::uuid is null or p.company_id = $4)
        group by t.user_id, p.full_name order by p.full_name`,
      args,
    )).rows;

    return { daywork, deliveries, handovers, travel };
  });
}

export async function qsFilterOptions(viewer: Viewer) {
  return withUser(viewer.id, async (tx) => ({
    jobs: (await tx.query<{ id: string; job_number: string; name: string }>("select id, job_number, name from jobs order by job_number desc")).rows,
    companies: (await tx.query<{ id: string; name: string }>("select id, name from companies order by name")).rows,
  }));
}

/** Daywork grouped by company, then by sheet, with standing / extra totals. */
export function groupDaywork(lines: DayworkLine[]) {
  const companies = new Map<string, { company: string; standing: number; extra: number; sheets: Map<string, { line: DayworkLine; hours: number; people: Set<string> }> }>();
  for (const l of lines) {
    const c = companies.get(l.company_id) ?? { company: l.company, standing: 0, extra: 0, sheets: new Map() };
    c[l.kind] += l.hours;
    const s = c.sheets.get(l.daywork_id) ?? { line: l, hours: 0, people: new Set<string>() };
    s.hours += l.hours; s.people.add(l.person);
    c.sheets.set(l.daywork_id, s);
    companies.set(l.company_id, c);
  }
  return [...companies.entries()].map(([id, c]) => ({ id, ...c, sheets: [...c.sheets.values()] }));
}
