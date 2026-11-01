"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { config } from "@/server/config";
import { signIn, signOut } from "@/server/auth/session";
import { DEMO_PASSWORD } from "@/server/seed/demo-data";
import type { ActionState } from "@/lib/action-state";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    next: form.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };
  redirect(safeNext(parsed.data.next));
}

/** Demo mode only: one-tap sign-in for the listed demonstration accounts. */
export async function demoSignInAction(form: FormData) {
  if (!config.isDemo) throw new Error("Demo sign-in is disabled");
  const email = String(form.get("email") ?? "");
  if (!email.endsWith(".example")) throw new Error("Not a demo account");
  const result = await signIn(email, DEMO_PASSWORD);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error)}`);
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
