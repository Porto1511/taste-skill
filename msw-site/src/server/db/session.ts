import type { Driver, Queryable } from "./types";

/**
 * Run as an end user: role `authenticated` + JWT subject.  RLS applies and
 * triggers treat the statements as API calls (server timestamps, forced
 * authorship).  Mirrors how Supabase's API executes user requests.
 */
export function runAsUser<T>(driver: Driver, userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return driver.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    return fn(tx);
  });
}

/**
 * Trusted maintenance connection (bypasses RLS).  Optionally attributes audit
 * entries to an actor and backdates them — used ONLY by the demo seeder.
 */
export function runAsSystem<T>(
  driver: Driver,
  fn: (tx: Queryable) => Promise<T>,
  opts: { actorId?: string; at?: string } = {},
): Promise<T> {
  return driver.transaction(async (tx) => {
    if (opts.actorId) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: opts.actorId })]);
    }
    if (opts.at) {
      await tx.query("select set_config('msw.activity_time', $1, true)", [opts.at]);
    }
    return fn(tx);
  });
}
