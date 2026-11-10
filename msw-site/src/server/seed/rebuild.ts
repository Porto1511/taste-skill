import type { Driver } from "../db/types";
import type { FileStore } from "../storage/types";
import { seedDemo, type CreateAuthUser } from "./seed";

/**
 * Bump this when the demo's people or companies change: a hosted demo built
 * with an older version is wiped and seeded again on its next start.
 * Demo (fictional) data only — never runs in Supabase mode.
 */
export const DEMO_SEED_VERSION = "2026-11-msw-team";

const DEMO_TABLES = [
  "public.activity_log", "public.assignment_areas", "public.companies", "public.dayworks", "public.deliveries",
  "public.document_areas", "public.document_revisions", "public.documents", "public.handover_photos", "public.handovers",
  "public.job_areas", "public.job_assignments", "public.jobs", "public.notifications", "public.profiles",
  "public.report_photos", "public.report_responses", "public.reports", "public.timesheets",
  "local_auth.credentials", "local_auth.sessions", "local_auth.files", "auth.users",
];

/** Returns "seeded", "rebuilt" or "current". */
export async function seedOrRebuildDemo(driver: Driver, store: FileStore, createAuthUser: CreateAuthUser, password: string) {
  await driver.query("create table if not exists local_auth.meta (key text primary key, value text not null)");
  const [{ n }] = (await driver.query<{ n: number }>("select count(*)::int as n from public.profiles")).rows;
  const [meta] = (await driver.query<{ value: string }>("select value from local_auth.meta where key = 'demo_seed'")).rows;
  if (n > 0 && meta?.value === DEMO_SEED_VERSION) return "current" as const;
  if (n > 0) await driver.query(`truncate ${DEMO_TABLES.join(", ")} cascade`);
  await seedDemo(driver, store, createAuthUser, password);
  await driver.query("insert into local_auth.meta (key, value) values ('demo_seed', $1) on conflict (key) do update set value = excluded.value", [DEMO_SEED_VERSION]);
  return n > 0 ? ("rebuilt" as const) : ("seeded" as const);
}
