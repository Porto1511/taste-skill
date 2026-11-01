"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff, requireViewer } from "../auth/viewer";
import { withUser } from "../db";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  reportId: z.string().uuid(),
  body: z.string().trim().max(4000, "Keep the reply under 4000 characters").optional().transform((v) => v || null),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

/** Reply to a report.  Office users may also change an issue's status (enforced in the database). */
export async function respondAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse({ reportId: str(f, "reportId"), body: str(f, "body"), status: str(f, "status") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return attempt("reports.respond", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query("select public.respond_to_report($1, $2, $3::public.report_status)", [parsed.data.reportId, parsed.data.body, parsed.data.status ?? null]),
    );
    refresh();
    return { ok: true, message: viewer.isStaff ? "Response sent." : "Reply sent to the MSW office.", nonce: Date.now() };
  });
}

export async function setSharedAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const reportId = z.string().uuid().parse(str(f, "reportId"));
  const shared = str(f, "shared") === "1";
  return attempt("reports.share", async () => {
    await withUser(viewer.id, (tx) => tx.query("update reports set shared_with_team = $1 where id = $2", [shared, reportId]));
    refresh();
    return {
      ok: true,
      message: shared ? "Shared with everyone allocated to this area of the job." : "No longer shared — only the author and MSW office can see it.",
      nonce: Date.now(),
    };
  });
}

export async function setPriorityAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireStaff();
  const reportId = z.string().uuid().parse(str(f, "reportId"));
  const priority = z.enum(["normal", "high", "urgent"]).parse(str(f, "priority"));
  return attempt("reports.priority", async () => {
    await withUser(viewer.id, (tx) => tx.query("update reports set priority = $1 where id = $2", [priority, reportId]));
    refresh();
    return { ok: true, nonce: Date.now() };
  });
}
