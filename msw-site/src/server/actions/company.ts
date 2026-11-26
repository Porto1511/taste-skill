"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireBoss, requireViewer } from "../auth/viewer";
import { withUser } from "../db";
import { config } from "../config";
import { log } from "../log";
import { UserError } from "../errors";
import { deleteCard } from "../files/cards";
import { fieldErrors } from "../validation";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const operativeInput = z.object({
  fullName: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().email("Enter their email address — it's what they sign in with").max(200),
  phone: text(40),
  jobTitle: text(120),
  password: z.string().min(8, "Make the password at least 8 characters").max(72),
});

/**
 * A boss adds one of their own lads.  The boss sets the password and passes it
 * on; nothing is emailed.  The database only lets a boss add people to their
 * own company, as operatives.
 */
export async function addOperativeAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireBoss();
  const parsed = operativeInput.safeParse({
    fullName: str(f, "fullName"), email: str(f, "email"), phone: str(f, "phone"), jobTitle: str(f, "jobTitle"), password: str(f, "password"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;
  const id = randomUUID();
  const res = await attempt("company.add_operative", async () => {
    if (config.mode === "supabase") {
      const { supabaseAdmin } = await import("../auth/supabase");
      const admin = supabaseAdmin();
      const { error } = await admin.auth.admin.createUser({ id, email: p.email, password: p.password, email_confirm: true, user_metadata: { full_name: p.fullName } });
      if (error) throw new UserError(/already/i.test(error.message) ? "Someone with that email address already has an account." : `The login could not be created: ${error.message}`);
      try {
        await withUser(viewer.id, (tx) => tx.query("select public.boss_add_operative($1,$2,$3,$4,$5)", [id, p.fullName, p.email, p.phone, p.jobTitle]));
      } catch (err) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
        throw err;
      }
    } else {
      const { createLocalAuthUser, deleteLocalAuthUser } = await import("../auth/local");
      const taken = await withUser(viewer.id, async (tx) => (await tx.query("select public.email_taken($1) as t", [p.email])).rows[0]?.t === true);
      if (taken) throw new UserError("Someone with that email address already has an account.");
      await createLocalAuthUser(id, p.email, p.password);
      try {
        await withUser(viewer.id, (tx) => tx.query("select public.boss_add_operative($1,$2,$3,$4,$5)", [id, p.fullName, p.email, p.phone, p.jobTitle]));
      } catch (err) {
        await deleteLocalAuthUser(id).catch(() => {});
        throw err;
      }
    }
    log.info("company.operative_added", { by: viewer.id, userId: id });
    return { ok: true };
  });
  if (res.error) return res;
  redirect(`/company/people/${id}?added=1`);
}

export async function updateOperativeAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireBoss();
  const id = uuid.parse(str(f, "userId"));
  const parsed = operativeInput.pick({ fullName: true, phone: true, jobTitle: true }).safeParse({
    fullName: str(f, "fullName"), phone: str(f, "phone"), jobTitle: str(f, "jobTitle"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return attempt("company.update_operative", async () => {
    await withUser(viewer.id, async (tx) => {
      const active = (await tx.query<{ active: boolean }>("select active from profiles where id = $1", [id])).rows[0]?.active;
      if (active === undefined) throw new UserError("Person not found.", 404);
      await tx.query("select public.boss_update_operative($1,$2,$3,$4,$5)", [id, parsed.data.fullName, parsed.data.phone, parsed.data.jobTitle, active]);
    });
    refresh();
    return { ok: true, message: "Saved.", nonce: Date.now() };
  });
}

/** Switch someone off (they've left): signed out and locked out of every job straight away. */
export async function setOperativeActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireBoss();
  const id = uuid.parse(str(f, "userId"));
  const active = str(f, "active") === "1";
  return attempt("company.operative_active", async () => {
    await withUser(viewer.id, async (tx) => {
      const p = (await tx.query<{ full_name: string; phone: string | null; job_title: string | null }>(
        "select full_name, phone, job_title from profiles where id = $1", [id])).rows[0];
      if (!p) throw new UserError("Person not found.", 404);
      await tx.query("select public.boss_update_operative($1,$2,$3,$4,$5)", [id, p.full_name, p.phone, p.job_title, active]);
    });
    if (!active) {
      if (config.mode === "supabase") {
        const { supabaseAdmin } = await import("../auth/supabase");
        await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch((e) => log.warn("company.ban_failed", { err: e }));
      } else {
        const { destroyAllLocalSessions } = await import("../auth/local");
        await destroyAllLocalSessions(id);
      }
    } else if (config.mode === "supabase") {
      const { supabaseAdmin } = await import("../auth/supabase");
      await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "none" }).catch((e) => log.warn("company.unban_failed", { err: e }));
    }
    refresh();
    return {
      ok: true,
      message: active ? "Switched back on. They can see the jobs they're ticked on again." : "Switched off and signed out. They can't see any job now.",
      nonce: Date.now(),
    };
  });
}

/** Tick or untick one person on one job. */
export async function setJobAccessAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireBoss();
  const jobId = uuid.parse(str(f, "jobId"));
  const userId = uuid.parse(str(f, "userId"));
  const on = str(f, "on") === "1";
  return attempt("company.job_access", async () => {
    await withUser(viewer.id, (tx) => tx.query("select public.boss_set_job_access($1,$2,$3)", [jobId, userId, on]));
    refresh();
    return { ok: true, nonce: Date.now() };
  });
}

export async function deleteCardAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const id = uuid.parse(str(f, "cardId"));
  return attempt("cards.delete", async () => {
    await deleteCard(viewer, id);
    refresh();
    return { ok: true, message: "Card removed.", nonce: Date.now() };
  });
}
