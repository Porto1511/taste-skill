"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff, requireViewer } from "../auth/viewer";
import { withUser } from "../db";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const time = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Use a valid time");

const schema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobId: z.string().optional().transform((v) => (v && v !== "other" ? v : null)).pipe(z.string().uuid().nullable()),
  locationNote: z.string().trim().max(200).optional().transform((v) => v || null),
  vehicleReg: z.string().trim().toUpperCase().max(12).optional().transform((v) => v || null),
  travelMode: z.enum(["driver", "passenger", "none"]),
  travelOutStart: time, travelOutEnd: time, siteStart: time, siteFinish: time, travelBackStart: time, travelBackEnd: time,
  breakMinutes: z.coerce.number().int().min(0).max(300),
  mileage: z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 2000), "Miles must be 0–2000"),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
});

const pairs: [string, string, string][] = [
  ["travelOutStart", "travelOutEnd", "Travel to site"],
  ["siteStart", "siteFinish", "Time on site"],
  ["travelBackStart", "travelBackEnd", "Travel home"],
];

export async function saveTimesheetAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const raw = Object.fromEntries(
    ["workDate", "jobId", "locationNote", "vehicleReg", "travelMode", "travelOutStart", "travelOutEnd", "siteStart", "siteFinish",
      "travelBackStart", "travelBackEnd", "breakMinutes", "mileage", "notes"].map((k) => [k, str(f, k) ?? undefined]),
  );
  const parsed = schema.safeParse({ ...raw, breakMinutes: raw.breakMinutes ?? "0", travelMode: raw.travelMode ?? "driver" });
  if (!parsed.success) return { error: parsed.error.issues[0].message, nonce: Date.now() };
  const t = parsed.data as z.infer<typeof schema> & Record<string, string | null>;
  const fieldErrors: Record<string, string> = {};
  for (const [a, b, label] of pairs) {
    if (Boolean(t[a]) !== Boolean(t[b])) fieldErrors[a] = `${label}: enter both times`;
  }
  if (!t.siteStart && !t.travelOutStart && !t.travelBackStart) fieldErrors.siteStart = "Enter at least your times on site";
  if (t.travelMode === "driver" && (t.travelOutStart || t.travelBackStart) && !t.vehicleReg) fieldErrors.vehicleReg = "Enter the vehicle registration";
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors, nonce: Date.now() };

  const res = await attempt("timesheets.save", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query(
        `insert into timesheets (user_id, work_date, job_id, location_note, vehicle_reg, travel_mode, travel_out_start, travel_out_end,
           site_start, site_finish, break_minutes, travel_back_start, travel_back_end, mileage, notes)
         values (auth.uid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (user_id, work_date) do update set
           job_id = excluded.job_id, location_note = excluded.location_note, vehicle_reg = excluded.vehicle_reg,
           travel_mode = excluded.travel_mode, travel_out_start = excluded.travel_out_start, travel_out_end = excluded.travel_out_end,
           site_start = excluded.site_start, site_finish = excluded.site_finish, break_minutes = excluded.break_minutes,
           travel_back_start = excluded.travel_back_start, travel_back_end = excluded.travel_back_end,
           mileage = excluded.mileage, notes = excluded.notes`,
        [t.workDate, t.jobId, t.locationNote, t.vehicleReg, t.travelMode, t.travelOutStart, t.travelOutEnd, t.siteStart, t.siteFinish,
          t.breakMinutes, t.travelBackStart, t.travelBackEnd, t.mileage, t.notes],
      ),
    );
    return { ok: true };
  });
  if (res.error) return res;
  redirect(`/timesheet?saved=${t.workDate}`);
}

export async function deleteTimesheetAction(f: FormData) {
  const viewer = await requireViewer();
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(str(f, "workDate"));
  await withUser(viewer.id, (tx) => tx.query("delete from timesheets where user_id = auth.uid() and work_date = $1 and status <> 'approved'", [date]));
  redirect("/timesheet");
}

export async function reviewTimesheetAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const ids = f.getAll("ids").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const status = z.enum(["approved", "query"]).parse(str(f, "status"));
  const note = (str(f, "note") ?? "").trim().slice(0, 500) || null;
  if (!ids.length) return { error: "Nothing selected.", nonce: Date.now() };
  if (status === "query" && !note) return { error: "Say what needs checking so the operative knows what to fix.", nonce: Date.now() };
  return attempt("timesheets.review", async () => {
    const n = await withUser(viewer.id, async (tx) =>
      (await tx.query("update timesheets set status = $1, office_note = $2 where id = any($3::uuid[])", [status, note, ids])).rowCount,
    );
    refresh();
    return { ok: true, message: status === "approved" ? `${n} day${n === 1 ? "" : "s"} approved.` : "Query sent to the operative.", nonce: Date.now() };
  });
}
