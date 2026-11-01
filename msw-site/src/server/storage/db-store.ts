import type { Driver } from "../db/types";
import { assertSafePath, type FileStore } from "./types";

/** Hosted demo only: private file storage inside the demo database. */
export function createDbStore(driver: Driver | (() => Promise<Driver>)): FileStore {
  const db = async () => (typeof driver === "function" ? driver() : driver);
  return {
    kind: "local",
    async put(p, data) {
      assertSafePath(p);
      await (await db()).query("insert into local_auth.files (path, content) values ($1, $2) on conflict (path) do nothing", [p, data]);
    },
    async get(p) {
      assertSafePath(p);
      const { rows } = await (await db()).query<{ content: Buffer }>("select content from local_auth.files where path = $1", [p]);
      return rows[0] ? Buffer.from(rows[0].content) : null;
    },
    async remove(paths) {
      paths.forEach(assertSafePath);
      if (paths.length) await (await db()).query("delete from local_auth.files where path = any($1::text[])", [paths]);
    },
  };
}
