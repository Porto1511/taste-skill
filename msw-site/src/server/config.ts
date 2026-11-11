import path from "node:path";

/**
 * Runtime mode.
 *  - "supabase": Supabase Postgres + Supabase Auth + private Supabase Storage.
 *  - "demo":     embedded Postgres (PGlite) running the SAME migrations and RLS
 *                policies, local password sessions and a private on-disk store.
 * Supabase mode is selected automatically when all its variables are present.
 */
export type AppMode = "supabase" | "demo";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = (() => {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = env("DATABASE_URL");
  const forced = env("MSW_MODE") as AppMode | undefined;
  const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey && databaseUrl);
  const mode: AppMode = forced ?? (hasSupabase ? "supabase" : "demo");

  if (mode === "supabase" && !hasSupabase) {
    throw new Error(
      "MSW_MODE=supabase requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL",
    );
  }

  // Hosted demo: a shared Postgres (e.g. Netlify Database) instead of embedded PGlite.
  const demoDatabaseUrl = env("DEMO_DATABASE_URL") ?? env("NETLIFY_DB_URL");
  const onNetlify = Boolean(env("NETLIFY") || env("NETLIFY_DB_URL") || env("SITE_ID"));

  const dataDir = path.resolve(env("MSW_DATA_DIR") ?? path.join(process.cwd(), ".data"));

  return {
    mode,
    isDemo: mode === "demo",
    /** One-tap "Try it as someone else" sign-in. Set MSW_QUICK_SIGNIN=off before real drawings go in. */
    quickSignIn: mode === "demo" && env("MSW_QUICK_SIGNIN") !== "off",
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    databaseUrl,
    demoDatabaseUrl,
    hostedDemo: mode === "demo" && (Boolean(demoDatabaseUrl) || onNetlify),
    storageBucket: env("SUPABASE_STORAGE_BUCKET") ?? "msw-private",
    siteUrl: env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
    dataDir,
    pgliteDir: path.join(dataDir, "pglite"),
    storageDir: path.join(dataDir, "storage"),
    forceSecureCookies: env("MSW_SECURE_COOKIES") === "1",
    maxPdfBytes: 50 * 1024 * 1024,
    maxPhotoBytes: 15 * 1024 * 1024,
    maxPhotosPerReport: 8,
  } as const;
})();
