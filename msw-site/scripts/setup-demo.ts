/**
 * Demo environment setup.
 *   npm run demo:setup          create + seed if no demo database exists yet
 *   npm run demo:reset          wipe .data/ and re-seed from scratch
 */
import fs from "node:fs";
import { config } from "../src/server/config";
import { createPgliteDriver } from "../src/server/db/pglite";
import { migrateLocal } from "../src/server/db/migrate";
import { createLocalStore } from "../src/server/storage/local";
import { seedDemo } from "../src/server/seed/seed";
import { localAuthUserFactory } from "../src/server/seed/local-auth";
import { DEMO_PASSWORD } from "../src/server/seed/demo-data";

const reset = process.argv.includes("--reset");

async function main() {
  if (config.mode !== "demo") {
    console.log("Supabase mode detected — demo setup skipped. Use `npm run seed:supabase` to load demo data into Supabase.");
    return;
  }
  if (reset && fs.existsSync(config.dataDir)) {
    fs.rmSync(config.dataDir, { recursive: true, force: true });
    console.log(`Removed ${config.dataDir}`);
  }
  const driver = await createPgliteDriver(config.pgliteDir);
  try {
    await migrateLocal(driver);
    const { rows } = await driver.query<{ n: number }>("select count(*)::int as n from public.profiles");
    if (rows[0].n > 0) {
      console.log("Demo database already set up (use `npm run demo:reset` to start again).");
      return;
    }
    const started = Date.now();
    const store = createLocalStore(config.storageDir);
    const counts = await seedDemo(driver, store, localAuthUserFactory(driver), DEMO_PASSWORD, (m) =>
      process.stdout.write(`  seeding ${m}…\n`),
    );
    console.log(
      `Demo data ready in ${((Date.now() - started) / 1000).toFixed(1)}s: ${counts.jobs} jobs, ${counts.users} users, ${counts.revisions} document revisions, ${counts.reports} reports.`,
    );
    console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  } finally {
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
