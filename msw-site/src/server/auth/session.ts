import "server-only";
import { cookies, headers } from "next/headers";
import { config } from "../config";
import { log } from "../log";
import { rateLimit, resetRateLimit } from "./rate-limit";

async function secureCookies() {
  if (config.forceSecureCookies) return true;
  const h = await headers();
  return h.get("x-forwarded-proto") === "https";
}

/** The authenticated user id for this request, or null. */
export async function getSessionUserId(): Promise<string | null> {
  if (config.mode === "supabase") {
    const { supabaseForRequest } = await import("./supabase");
    const sb = await supabaseForRequest();
    // getUser() validates the token with Supabase Auth (not just decoding it).
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  }
  const { SESSION_COOKIE, resolveLocalSession } = await import("./local");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveLocalSession(token);
}

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${email.toLowerCase()}`;
  const limit = rateLimit(key, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    log.warn("auth.rate_limited", { ip });
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s).` };
  }

  if (config.mode === "supabase") {
    const { supabaseForRequest } = await import("./supabase");
    const sb = await supabaseForRequest();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      log.info("auth.sign_in_failed", { reason: error.message });
      return { ok: false, error: "Email or password not recognised." };
    }
    resetRateLimit(key);
    return { ok: true };
  }

  const { verifyLocalCredentials, createLocalSession, SESSION_COOKIE } = await import("./local");
  const userId = await verifyLocalCredentials(email, password);
  if (!userId) {
    log.info("auth.sign_in_failed", { mode: "demo" });
    return { ok: false, error: "Email or password not recognised, or the account is disabled." };
  }
  const { token, expires } = await createLocalSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
    expires,
  });
  resetRateLimit(key);
  log.info("auth.signed_in", { userId, mode: "demo" });
  return { ok: true };
}

export async function signOut() {
  if (config.mode === "supabase") {
    const { supabaseForRequest } = await import("./supabase");
    await (await supabaseForRequest()).auth.signOut();
    return;
  }
  const { SESSION_COOKIE, destroyLocalSession } = await import("./local");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroyLocalSession(token);
  store.delete(SESSION_COOKIE);
}
