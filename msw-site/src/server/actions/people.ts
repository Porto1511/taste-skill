"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "../auth/viewer";
import { withUser } from "../db";
import { config } from "../config";
import { log } from "../log";
import { UserError } from "../errors";
import { generateTemporaryPassword } from "../auth/passwords";
import { companyInput, fieldErrors, personInput } from "../validation";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const uuid = z.string().uuid();

export async function createCompanyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = companyInput.safeParse({
    name: str(f, "name"), trade: str(f, "trade"), contactName: str(f, "contactName"),
    contactPhone: str(f, "contactPhone"), contactEmail: str(f, "contactEmail"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  let id = "";
  const res = await attempt("companies.create", async () => {
    id = await withUser(viewer.id, async (tx) =>
      (await tx.query<{ id: string }>(
        "insert into companies (name, trade, contact_name, contact_phone, contact_email) values ($1,$2,$3,$4,$5) returning id",
        [c.name, c.trade, c.contactName, c.contactPhone, c.contactEmail],
      )).rows[0].id,
    );
    return { ok: true };
  });
  if (res.error) return res;
  redirect(`/office/people/companies/${id}`);
}

export async function updateCompanyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = uuid.parse(str(f, "companyId"));
  const parsed = companyInput.safeParse({
    name: str(f, "name"), trade: str(f, "trade"), contactName: str(f, "contactName"),
    contactPhone: str(f, "contactPhone"), contactEmail: str(f, "contactEmail"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  return attempt("companies.update", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query("update companies set name=$1, trade=$2, contact_name=$3, contact_phone=$4, contact_email=$5 where id=$6",
        [c.name, c.trade, c.contactName, c.contactPhone, c.contactEmail, id]),
    );
    refresh();
    return { ok: true, message: "Company saved.", nonce: Date.now() };
  });
}

export async function setCompanyActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = uuid.parse(str(f, "companyId"));
  const active = str(f, "active") === "1";
  return attempt("companies.active", async () => {
    await withUser(viewer.id, (tx) => tx.query("update companies set active = $1 where id = $2", [active, id]));
    refresh();
    return { ok: true, message: active ? "Company reactivated." : "Company deactivated. Its people keep any access you have given them individually — review them below.", nonce: Date.now() };
  });
}

/**
 * Add a person.  Supabase mode sends a real Supabase Auth invitation email;
 * demo mode creates the account with a one-time temporary password that the
 * administrator passes on (email delivery is simulated).
 */
export async function invitePersonAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const parsed = personInput.safeParse({
    fullName: str(f, "fullName"), email: str(f, "email"), phone: str(f, "phone"),
    jobTitle: str(f, "jobTitle"), companyId: str(f, "companyId"), role: str(f, "role") ?? "operative",
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;
  let newId = "";
  let secret: string | undefined;

  const res = await attempt("people.invite", async () => {
    const exists = await withUser(viewer.id, async (tx) =>
      (await tx.query("select 1 from profiles where lower(email) = $1", [p.email])).rowCount > 0,
    );
    if (exists) throw new UserError("Someone with that email address already has an account.");

    if (config.mode === "supabase") {
      const { supabaseAdmin } = await import("../auth/supabase");
      const admin = supabaseAdmin();
      const { data, error } = await admin.auth.admin.inviteUserByEmail(p.email, {
        redirectTo: `${config.siteUrl}/auth/confirm?next=/account`,
        data: { full_name: p.fullName },
      });
      if (error || !data.user) throw new UserError(`The invitation could not be sent: ${error?.message ?? "unknown error"}`);
      newId = data.user.id;
      try {
        await insertProfile(viewer.id, newId, p);
      } catch (err) {
        await admin.auth.admin.deleteUser(newId).catch(() => {});
        throw err;
      }
    } else {
      const { createLocalAuthUser, deleteLocalAuthUser } = await import("../auth/local");
      newId = randomUUID();
      secret = generateTemporaryPassword();
      await createLocalAuthUser(newId, p.email, secret);
      try {
        await insertProfile(viewer.id, newId, p);
      } catch (err) {
        await deleteLocalAuthUser(newId).catch(() => {});
        throw err;
      }
    }
    log.info("people.invited", { by: viewer.id, userId: newId, role: p.role });
    return { ok: true };
  });
  if (res.error) return res;
  if (secret) {
    // Shown once on screen; never put in a URL or log.
    return {
      ok: true,
      message: `${p.fullName} has been added. Demo mode does not send email — give them this temporary password securely. They can change it under Account.`,
      secret,
      href: `/office/people/${newId}`,
      nonce: Date.now(),
    };
  }
  redirect(`/office/people/${newId}?invited=1`);
}

async function insertProfile(adminId: string, id: string, p: z.infer<typeof personInput>) {
  await withUser(adminId, (tx) =>
    tx.query(
      `insert into profiles (id, company_id, full_name, email, phone, job_title, role, invited_at)
       values ($1, $2, $3, $4, $5, $6, $7, now())`,
      [id, p.companyId, p.fullName, p.email, p.phone, p.jobTitle, p.role],
    ),
  );
}

export async function updatePersonAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = uuid.parse(str(f, "userId"));
  const parsed = personInput.omit({ email: true }).safeParse({
    fullName: str(f, "fullName"), phone: str(f, "phone"), jobTitle: str(f, "jobTitle"),
    companyId: str(f, "companyId"), role: str(f, "role"),
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  if (id === viewer.id && parsed.data.role !== "admin") return { error: "You can't remove your own administrator role." };
  const p = parsed.data;
  return attempt("people.update", async () => {
    await withUser(viewer.id, (tx) =>
      tx.query("update profiles set full_name=$1, phone=$2, job_title=$3, company_id=$4, role=$5 where id=$6",
        [p.fullName, p.phone, p.jobTitle, p.companyId, p.role, id]),
    );
    refresh();
    return { ok: true, message: "Saved.", nonce: Date.now() };
  });
}

export async function setPersonActiveAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = uuid.parse(str(f, "userId"));
  const active = str(f, "active") === "1";
  if (id === viewer.id && !active) return { error: "You can't deactivate your own account." };
  return attempt("people.active", async () => {
    await withUser(viewer.id, (tx) => tx.query("update profiles set active = $1 where id = $2", [active, id]));
    if (!active) {
      if (config.mode === "supabase") {
        const { supabaseAdmin } = await import("../auth/supabase");
        await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "876000h" }).catch((e) => log.warn("people.ban_failed", { err: e }));
      } else {
        const { destroyAllLocalSessions } = await import("../auth/local");
        await destroyAllLocalSessions(id);
      }
    } else if (config.mode === "supabase") {
      const { supabaseAdmin } = await import("../auth/supabase");
      await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: "none" }).catch((e) => log.warn("people.unban_failed", { err: e }));
    }
    refresh();
    return {
      ok: true,
      message: active ? "Account reactivated. Their previous job allocations apply again." : "Account deactivated and signed out. They can no longer see any job.",
      nonce: Date.now(),
    };
  });
}

export async function resetPasswordAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const id = uuid.parse(str(f, "userId"));
  return attempt("people.reset", async () => {
    const email = await withUser(viewer.id, async (tx) =>
      (await tx.query<{ email: string }>("select email from profiles where id = $1", [id])).rows[0]?.email,
    );
    if (!email) throw new UserError("Person not found.");
    if (config.mode === "supabase") {
      const { supabaseAdmin } = await import("../auth/supabase");
      const { error } = await supabaseAdmin().auth.resetPasswordForEmail(email, { redirectTo: `${config.siteUrl}/auth/confirm?next=/account` });
      if (error) throw new UserError(`Could not send the reset email: ${error.message}`);
      return { ok: true, message: `Password reset email sent to ${email}.`, nonce: Date.now() };
    }
    const { setLocalPassword, destroyAllLocalSessions } = await import("../auth/local");
    const temp = generateTemporaryPassword();
    await setLocalPassword(id, temp);
    await destroyAllLocalSessions(id);
    log.info("people.password_reset", { by: viewer.id, userId: id });
    return { ok: true, message: "Temporary password created (demo mode — no email is sent). Pass it on securely:", secret: temp, nonce: Date.now() };
  });
}
