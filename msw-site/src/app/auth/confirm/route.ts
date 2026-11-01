import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { config } from "@/server/config";

/** Supabase mode: completes invitation / password-reset links, then sends the user to set a password. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (config.mode !== "supabase") return NextResponse.redirect(new URL("/login", url));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (tokenHash && type) {
    const { supabaseForRequest } = await import("@/server/auth/supabase");
    const { error } = await (await supabaseForRequest()).auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url));
  }
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That link has expired or was already used. Ask the MSW office to resend it."), url));
}
