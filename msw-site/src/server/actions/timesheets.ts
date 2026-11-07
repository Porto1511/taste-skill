"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff, requireViewer } from "../auth/viewer";
import { withUser } from "../db";
import { attempt, str, strs } from "./helpers";
import { WORK_TYPES } from "@/lib/timesheet";
import type { ActionState } from "@/lib/action-state";

const time = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Use a valid time");

const schema = z.object({
  entryId: z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable()),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobId: z.string().optional().transform((v) => (v && v !== "other" ? v : null)).pipe(z.string().uuid().nullable()),
  locationNote: z.string().trim().max(200).optional().transform((v) => v || null),
  workDone: z.array(z.enum(WORK_TYPES.map((w) => w.id) as [string, ...string[]])),
  workDescription: z.string().trim().max(1000).optional().transform((v) => v || null),
  travelMode: z.enum(["driver", "passenger"]),
  vehicleReg: z.string().trim().toUpperCase().max(12).optional().transform((v) => v || null),
  drivenBy: z.string().trim().max(120).optional().transform((v) => v || null),
  setOff: time, arrived: time, leftSite: time, gotBack: time,
  mileage: z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 2000), "Miles must be 0–2000"),
  notes: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** Add or update one job on a day. */
export async function saveTimesheetAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const raw = Object.fromEntries(
    ["entryId", "workDate", "jobId", "locationNote", "workDescription", "travelMode", "vehicleReg", "drivenBy",
      "setOff", "arrived", "leftSite", "gotBack", "mileage", "notes"].map((k) => [k, str(f, k) ?? undefined]),
  );
  const parsed = schema.safeParse({ ...raw, workDone: strs(f, "workDone"), travelMode: raw.travelMode ?? "driver" });
  if (!parsed.success) return { error: parsed.error.issues[0].message, nonce: Date.now() };
  const t = parsed.data;
  const fe: Record<string, string> = {};
  if (!t.jobId && str(f, "jobId") !== "other") fe.jobId = "Choose the job";
  if (str(f, "jobId") === "other" && !t.locationNote) fe.locationNote = "Say where you were";
  if (!t.workDone.length && !t.workDescription) fe.workDone = "Say what you did";
  if (t.travelMode === "driver" && !t.vehicleReg) fe.vehicleReg = "Enter the vehicle registration";
  if (t.travelMode === "passenger" && !t.drivenBy) fe.drivenBy = "Who was driving?";
  if (!t.setOff) fe.setOff = "Enter the time you set off";
  if (!t.arrived) fe.arrived = "Enter the time you arrived";
  if (!t.leftSite) fe.leftSite = "Enter the time you left site";
  if (Object.keys(fe).length) return { error: Object.values(fe)[0], fieldErrors: fe, nonce: Date.now() };

  const values = [t.jobId, t.locationNote, t.vehicleReg, t.travelMode, t.drivenBy, t.setOff, t.arrived, t.leftSite, t.gotBack,
    t.mileage, t.notes, t.workDone, t.workDescription];
  const res = await attempt("timesheets.save", async () => {
    await withUser(viewer.id, async (tx) => {
      if (t.entryId) {
        const { rowCount } = await tx.query(
          `update timesheets set job_id=$1, location_note=$2, vehicle_reg=$3, travel_mode=$4, driven_by=$5,
             travel_out_start=$6, travel_out_end=$7, travel_back_start=$8, travel_back_end=$9, mileage=$10, notes=$11,
             work_done=$12::text[], work_description=$13, site_start=null, site_finish=null, break_minutes=0
           where id = $14 and user_id = auth.uid()`,
          [...values, t.entryId],
        );
        if (!rowCount) throw Object.assign(new Error("This entry has been approved and can no longer be changed."), { code: "22023" });
      } else {
        await tx.query(
          `insert into timesheets (job_id, location_note, vehicle_reg, travel_mode, driven_by, travel_out_start, travel_out_end,
             travel_back_start, travel_back_end, mileage, notes, work_done, work_description, break_minutes, user_id, work_date)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13, 0, auth.uid(), $14)`,
          [...values, t.workDate],
        );
      }
    });
    return { ok: true };
  });
  if (res.error) return res;
  redirect(`/timesheet/${t.workDate}?saved=1`);
}

export async function deleteTimesheetEntryAction(f: FormData) {
  const viewer = await requireViewer();
  const id = z.string().uuid().parse(str(f, "entryId"));
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(str(f, "workDate"));
  await withUser(viewer.id, (tx) => tx.query("delete from timesheets where id = $1 and user_id = auth.uid() and status <> 'approved'", [id]));
  redirect(`/timesheet/${date}`);
}

export async function reviewTimesheetAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const ids = f.getAll("ids").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const status = z.enum(["approved", "query"]).parse(str(f, "status"));
  const note = (str(f, "note") ?? "").trim().slice(0, 500) || null;
  if (!ids.length) return { error: "Nothing selected.", nonce: Date.now() };
  if (status === "query" && !note) return { error: "Say what needs checking so the operative knows what to fix.", nonce: Date.now() };
  return attempt("timesheets.review", async () => {
    await withUser(viewer.id, (tx) => tx.query("update timesheets set status = $1, office_note = $2 where id = any($3::uuid[])", [status, note, ids]));
    refresh();
    return { ok: true, message: status === "approved" ? "Approved." : "Query sent to the operative.", nonce: Date.now() };
  });
}
