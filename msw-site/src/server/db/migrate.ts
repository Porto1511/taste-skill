import fs from "node:fs";
import path from "node:path";
import type { Driver } from "./types";

const root = process.env.MSW_PROJECT_ROOT ?? process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const shimFile = path.join(root, "db", "local-supabase-shim.sql");

/** Migrations that only make sense on Supabase (they touch the storage schema). */
function isSupabaseOnly(sql: string) {
  return /storage\.(buckets|objects)/.test(sql);
}

/**
 * Apply the Supabase migrations to an embedded database (demo mode and tests).
 * On Supabase itself, migrations are applied with the Supabase CLI instead.
 */
export async function migrateLocal(db: Driver): Promise<string[]> {
  await db.exec(fs.readFileSync(shimFile, "utf8"));
  await db.exec(`create table if not exists local_auth.schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set(
    (await db.query<{ name: string }>("select name from local_auth.schema_migrations")).rows.map((r) => r.name),
  );
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    if (!isSupabaseOnly(sql)) {
      await db.exec(sql);
    }
    await db.query("insert into local_auth.schema_migrations (name) values ($1)", [file]);
    ran.push(file);
  }
  return ran;
}
