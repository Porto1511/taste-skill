import "server-only";
import { config } from "../config";
import { log } from "../log";
import type { Driver, Queryable } from "./types";
import { runAsUser } from "./session";

export type { Queryable } from "./types";

const globalForDb = globalThis as unknown as { __mswDriver?: Promise<Driver> };

async function createDriver(): Promise<Driver> {
  if (config.mode === "supabase") {
    const { createPgDriver } = await import("./pg");
    log.info("db.connect", { mode: "supabase" });
    return createPgDriver(config.databaseUrl!);
  }
  if (config.hostedDemo) {
    const { createHostedDemoDriver } = await import("./hosted-demo");
    return createHostedDemoDriver();
  }
  const { createPgliteDriver } = await import("./pglite");
  const { migrateLocal } = await import("./migrate");
  const driver = await createPgliteDriver(config.pgliteDir);
  const ran = await migrateLocal(driver);
  log.info("db.connect", { mode: "demo", dataDir: config.pgliteDir, migrationsApplied: ran.length });
  return driver;
}

export function getDriver(): Promise<Driver> {
  if (!globalForDb.__mswDriver) {
    globalForDb.__mswDriver = createDriver().catch((err) => {
      globalForDb.__mswDriver = undefined;
      throw err;
    });
  }
  return globalForDb.__mswDriver;
}

/** Test hook: substitute an already-migrated driver. */
export function setDriverForTesting(driver: Driver) {
  globalForDb.__mswDriver = Promise.resolve(driver);
}

/**
 * Run `fn` inside a transaction as the given user.  The connection switches to
 * the `authenticated` role and carries the user id as the JWT subject, exactly
 * as Supabase's API does, so every statement is subject to RLS.
 * This is the ONLY way application code reads or writes business data.
 */
export async function withUser<T>(userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return runAsUser(await getDriver(), userId, fn);
}

/**
 * Privileged access that bypasses RLS.  Restricted to authentication
 * plumbing (credential/session lookups, creating auth users) and seeding.
 * Never use it to read or write business data on behalf of a user.
 */
export async function withSystem<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const driver = await getDriver();
  return driver.transaction(fn);
}
