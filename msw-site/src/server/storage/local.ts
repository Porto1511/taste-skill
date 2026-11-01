import fs from "node:fs/promises";
import path from "node:path";
import { assertSafePath, type FileStore } from "./types";

/**
 * Demo-mode private file store.  Files live outside /public and are only
 * reachable through the authorising /api/files routes.
 */
export function createLocalStore(root: string): FileStore {
  const resolve = (p: string) => {
    assertSafePath(p);
    const full = path.resolve(root, p);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("Path escapes storage root");
    return full;
  };
  return {
    kind: "local",
    async put(p, data) {
      const full = resolve(p);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data, { mode: 0o600 });
    },
    async get(p) {
      try {
        return await fs.readFile(resolve(p));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async remove(paths) {
      await Promise.all(paths.map((p) => fs.rm(resolve(p), { force: true })));
    },
  };
}
