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

/** Give a job to a subcontractor company: its boss sees it and chooses which of their people can. */
export async function giveJobToCompanyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const jobId = z.string().uuid().parse(str(f, "jobId"));
  const companyId = z.string().uuid().safeParse(str(f, "companyId"));
  if (!companyId.success) return { error: "Choose a company.", nonce: Date.now() };
  return attempt("access.company_give", async () => {
    await withUser(viewer.id, (tx) => tx.query(
      `insert into job_companies (job_id, company_id, granted_by)
       select $1, c.id, auth.uid() from companies c where c.id = $2 and not c.is_msw
       on conflict do nothing`, [jobId, companyId.data]));
    refresh();
    return { ok: true, message: "Job given to the company. Their boss has been told.", nonce: Date.now() };
  });
}

/** Take a job off a company: everyone from that company loses it straight away. */
export async function takeJobFromCompanyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = z.string().uuid().parse(str(f, "jobCompanyId"));
  return attempt("access.company_take", async () => {
    await withUser(viewer.id, (tx) => tx.query("update job_companies set revoked_at = now(), revoked_by = auth.uid() where id = $1 and revoked_at is null", [id]));
    refresh();
    return { ok: true, message: "Taken off. Nobody from that company can see the job now.", nonce: Date.now() };
  });
}
