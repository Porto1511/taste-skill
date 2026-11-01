import { createPgliteDriver } from "@/server/db/pglite";
import { migrateLocal } from "@/server/db/migrate";
import { runAsUser, runAsSystem } from "@/server/db/session";
import type { Driver, Row } from "@/server/db/types";
import type { FileStore } from "@/server/storage/types";
import { seedDemo } from "@/server/seed/seed";
import { localAuthUserFactory } from "@/server/seed/local-auth";
import { userId, jobId, areaId, demoId } from "@/server/seed/demo-data";

export const TEST_PASSWORD = "Test-Password-2026";

export function createMemoryStore(): FileStore & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    kind: "local",
    files,
    async put(p, data) { files.set(p, data); },
    async get(p) { return files.get(p) ?? null; },
    async remove(paths) { paths.forEach((p) => files.delete(p)); },
  };
}

export async function createSeededDb() {
  const driver = await createPgliteDriver();
  await migrateLocal(driver);
  const store = createMemoryStore();
  await seedDemo(driver, store, localAuthUserFactory(driver), TEST_PASSWORD);
  return { driver, store };
}

/** Query helpers bound to a demo user (by key, e.g. "john"). */
export function asUser(driver: Driver, key: string) {
  const id = userId(key);
  return {
    id,
    query: <T = Row>(sql: string, params: unknown[] = []) =>
      runAsUser(driver, id, async (tx) => (await tx.query<T>(sql, params)).rows),
  };
}

export function system(driver: Driver) {
  return <T = Row>(sql: string, params: unknown[] = []) =>
    runAsSystem(driver, async (tx) => (await tx.query<T>(sql, params)).rows);
}

export const ids = {
  user: userId,
  job: jobId,
  area: areaId,
  doc: (key: string) => demoId(`doc:${key}`),
  rev: (doc: string, rev: string) => demoId(`rev:${doc}:${rev}`),
  report: (key: string) => demoId(`report:${key}`),
};
