import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

/** Per-request Supabase client bound to the user's auth cookies (anon key). */
export async function supabaseForRequest() {
  const store = await cookies();
  return createServerClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; the
          // proxy refreshes the session on the next request.
        }
      },
    },
  });
}

/**
 * Service-role client for privileged auth administration (inviting users).
 * SERVER ONLY — the key never reaches the browser.
 */
export function supabaseAdmin() {
  return createClient(config.supabaseUrl!, config.serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
