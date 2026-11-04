import "server-only";
import { config } from "../config";
import { log } from "../log";
import { createPgDriver } from "./pg";
import { migrateLocal } from "./migrate";
import type { Driver } from "./types";

/**
 * Hosted demonstration (e.g. Netlify): a shared Postgres database runs the
 * same migrations, RLS policies and triggers.  Serverless instances share it,
 * so sessions, uploads and access changes are consistent across requests.
 * The first instance to start applies migrations and seeds the fictional demo
 * data, guarded by an advisory lock.
 */
async function connectionString(): Promise<string> {
  if (config.demoDatabaseUrl) return config.demoDatabaseUrl;
  const { getConnectionString } = await import("@netlify/database");
  return getConnectionString();
}

export async function createHostedDemoDriver(): Promise<Driver> {
  const driver = createPgDriver(await connectionString(), { max: 4 });
  const started = Date.now();
  await driver.transaction(async (lock) => {
    await lock.query("select pg_advisory_xact_lock(7311)");
    const ran = await migrateLocal(driver);
    const { rows } = await driver.query<{ n: number }>("select count(*)::int as n from public.profiles");
    if (rows[0].n === 0) {
      const [{ seedDemo }, { localAuthUserFactory }, { createDbStore }, { DEMO_PASSWORD }] = await Promise.all([
        import("../seed/seed"), import("../seed/local-auth"), import("../storage/db-store"), import("../seed/demo-data"),
      ]);
      const counts = await seedDemo(driver, createDbStore(driver), localAuthUserFactory(driver), DEMO_PASSWORD);
      log.info("demo.seeded", { ...counts, ms: Date.now() - started });
    } else {
      // Bring an existing demo database up to date with newer demo content.
      const [{ seedExtras }, { createDbStore }] = await Promise.all([import("../seed/seed"), import("../storage/db-store")]);
      await seedExtras(driver, createDbStore(driver));
    }
    log.info("db.connect", { mode: "hosted-demo", migrationsApplied: ran.length, ms: Date.now() - started });
  });
  return driver;
}
