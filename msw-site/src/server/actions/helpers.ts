import "server-only";
import { unstable_rethrow } from "next/navigation";
import { toUserMessage } from "../errors";
import type { ActionState } from "@/lib/action-state";

/** Run an action body, converting any failure into a user-facing message. */
export async function attempt(context: string, fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() through
    return { error: toUserMessage(err, context), nonce: Date.now() };
  }
}

export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : undefined;
};
export const strs = (f: FormData, k: string) => f.getAll(k).filter((v): v is string => typeof v === "string" && v !== "");
