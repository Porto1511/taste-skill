import { Pool, types as pgTypes } from "pg";
import type { Driver, Queryable, QueryResult } from "./types";

// Keep values identical to the PGlite driver (see pglite.ts).
const TIMESTAMPTZ = 1184;
const TIMESTAMP = 1114;
const DATE = 1082;
const INT8 = 20;

const typeOverrides = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (oid === TIMESTAMPTZ) return (v: string) => new Date(v).toISOString();
    if (oid === TIMESTAMP || oid === DATE) return (v: string) => v;
    if (oid === INT8) return (v: string) => Number(v);
    return pgTypes.getTypeParser(oid, format);
  },
};

export function createPgDriver(connectionString: string): Driver {
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idleTimeoutMillis: 30_000,
    types: typeOverrides as never,
    ssl: connectionString.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
  });

  const query = async <T>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const res = await pool.query(text, params as unknown[]);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  };

  return {
    query,
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      const tx: Queryable = {
        async query<T>(text: string, params?: unknown[]) {
          const res = await client.query(text, params as unknown[]);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
        },
      };
      try {
        await client.query("begin");
        const out = await fn(tx);
        await client.query("commit");
        return out;
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
