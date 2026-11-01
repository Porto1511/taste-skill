import { createClient } from "@supabase/supabase-js";
import { assertSafePath, type FileStore } from "./types";

/**
 * Production store: a PRIVATE Supabase Storage bucket accessed only from the
 * server with the service-role key (never sent to the browser).  Callers must
 * have already authorised the request through an RLS-checked query.
 */
export function createSupabaseStore(url: string, serviceRoleKey: string, bucket: string): FileStore {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = () => client.storage.from(bucket);
  return {
    kind: "supabase",
    async put(p, data, contentType) {
      assertSafePath(p);
      const { error } = await storage().upload(p, data, { contentType, upsert: false });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async get(p) {
      assertSafePath(p);
      const { data, error } = await storage().download(p);
      if (error) {
        if (/not found|404/i.test(error.message)) return null;
        throw new Error(`Storage download failed: ${error.message}`);
      }
      return Buffer.from(await data.arrayBuffer());
    },
    async remove(paths) {
      paths.forEach(assertSafePath);
      if (paths.length === 0) return;
      const { error } = await storage().remove(paths);
      if (error) throw new Error(`Storage delete failed: ${error.message}`);
    },
  };
}
