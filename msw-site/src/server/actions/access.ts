"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "../auth/viewer";
import { withUser } from "../db";
import { accessInput, fieldErrors } from "../validation";
import { attempt, str, strs } from "./helpers";
import type { ActionState } from "@/lib/action-state";

/** Grant (or update) access for one or many people in a single action. */
export async function grantAccessAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = accessInput.safeParse({
    jobId: str(f, "jobId"),
    userIds: strs(f, "userIds"),
    scope: str(f, "scope") ?? "areas",
    areaIds: strs(f, "areaIds"),
    attendanceFrom: str(f, "attendanceFrom"),
    attendanceTo: str(f, "attendanceTo"),
    note: str(f, "note"),
    managerReports: str(f, "managerReports") === "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: fieldErrors(parsed.error), nonce: Date.now() };
  const a = parsed.data;
  if (a.scope === "areas" && a.areaIds.length === 0 && str(f, "allowNoAreas") !== "1") {
    return { error: "Choose at least one floor/phase, or select 'All areas'.", fieldErrors: { areaIds: "Choose at least one area" }, nonce: Date.now() };
  }
  return attempt("access.grant", async () => {
    const n = await withUser(viewer.id, async (tx) =>
      (await tx.query<{ n: number }>(
        "select public.grant_job_access($1, $2::uuid[], $3, $4::uuid[], $5, $6, $7, $8) as n",
        [a.jobId, a.userIds, a.scope === "all", a.scope === "all" ? [] : a.areaIds, a.attendanceFrom, a.attendanceTo, a.note, a.managerReports],
      )).rows[0].n,
    );
    refresh();
    return { ok: true, message: `Access saved for ${n} ${n === 1 ? "person" : "people"}. They have been notified.`, nonce: Date.now() };
  });
}

export async function revokeAccessAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const ids = z.array(z.string().uuid()).min(1).safeParse(strs(f, "assignmentIds"));
  if (!ids.success) return { error: "Nothing selected." };
  return attempt("access.revoke", async () => {
    const n = await withUser(viewer.id, async (tx) =>
      (await tx.query<{ n: number }>("select public.revoke_job_access($1::uuid[]) as n", [ids.data])).rows[0].n,
    );
    refresh();
    return { ok: true, message: `Access removed for ${n} ${n === 1 ? "person" : "people"}.`, nonce: Date.now() };
  });
}
