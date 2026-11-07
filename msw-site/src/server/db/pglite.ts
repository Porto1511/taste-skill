import fs from "node:fs";
import { PGlite, types } from "@electric-sql/pglite";
import type { Driver, Queryable, QueryResult } from "./types";

// Normalise types so both drivers return identical JS values:
// timestamptz -> ISO string, date -> "YYYY-MM-DD", int8 -> number.
const parsers = {
  [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
  [types.TIMESTAMP]: (v: string) => v,
  [types.DATE]: (v: string) => v,
  [types.INT8]: (v: string) => Number(v),
};

function wrap(q: { query: PGlite["query"] }): Queryable {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
      const res = await q.query<T>(text, params as unknown[] | undefined);
      // Match node-postgres: SELECT reports the rows returned, writes the rows affected.
      return { rows: res.rows, rowCount: Math.max(res.affectedRows ?? 0, res.rows.length) };
    },
  };
}

export async function createPgliteDriver(dataDir?: string): Promise<Driver> {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create({ dataDir, parsers });
  const base = wrap(db);
  return {
    query: base.query,
    async exec(sql) {
      await db.exec(sql);
    },
    transaction(fn) {
      return db.transaction((tx) => fn(wrap(tx)));
    },
    async close() {
      await db.close();
    },
  };
}
