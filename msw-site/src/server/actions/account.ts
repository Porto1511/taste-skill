"use server";

import { requireViewer } from "../auth/viewer";
import { config } from "../config";
import { passwordProblem } from "../auth/passwords";
import { attempt, str } from "./helpers";
import type { ActionState } from "@/lib/action-state";

export async function changePasswordAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const current = str(f, "current") ?? "";
  const next = str(f, "next") ?? "";
  const confirm = str(f, "confirm") ?? "";
  const problem = passwordProblem(next);
  if (problem) return { error: problem, fieldErrors: { next: problem } };
  if (next !== confirm) return { error: "The new passwords don't match.", fieldErrors: { confirm: "Doesn't match" } };
  return attempt("account.password", async () => {
    if (config.mode === "supabase") {
      const { supabaseForRequest } = await import("../auth/supabase");
      const { error } = await (await supabaseForRequest()).auth.updateUser({ password: next });
      if (error) return { error: error.message };
    } else {
      const { checkLocalPassword, setLocalPassword } = await import("../auth/local");
      if (!(await checkLocalPassword(viewer.id, current))) return { error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect" } };
      await setLocalPassword(viewer.id, next);
    }
    return { ok: true, message: "Password changed.", nonce: Date.now() };
  });
}
