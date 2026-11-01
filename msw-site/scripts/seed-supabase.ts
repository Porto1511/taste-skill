/**
 * Load the FICTIONAL demonstration data into a real Supabase project
 * (after `supabase db push` has applied the migrations).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... npm run seed:supabase
 *
 * Creates confirmed Supabase Auth users (password SiteDemo!2026), uploads the
 * generated PDFs/photos to the private bucket and inserts the demo records.
 * Do NOT run this against a production project holding real data.
 */
import { createClient } from "@supabase/supabase-js";
import { createPgDriver } from "../src/server/db/pg";
import { createSupabaseStore } from "../src/server/storage/supabase";
import { seedDemo } from "../src/server/seed/seed";
import { DEMO_PASSWORD } from "../src/server/seed/demo-data";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = process.env.DATABASE_URL;
  if (!url || !key || !db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL");
  if (!process.argv.includes("--yes")) {
    console.log("This loads fictional demo users and jobs into the Supabase project at", url);
    console.log("Re-run with --yes to continue.");
    return;
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const driver = createPgDriver(db);
  const store = createSupabaseStore(url, key, process.env.SUPABASE_STORAGE_BUCKET ?? "msw-private");
  try {
    const counts = await seedDemo(driver, store, async ({ id, email, password }) => {
      const { data, error } = await admin.auth.admin.createUser({ id, email, password, email_confirm: true } as never);
      if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message}`);
      return data.user.id;
    }, DEMO_PASSWORD, (m) => console.log(`  seeding ${m}…`));
    console.log("Seeded:", counts);
  } finally {
    await driver.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
