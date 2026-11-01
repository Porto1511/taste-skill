import "server-only";
import { config } from "../config";
import type { FileStore } from "./types";
import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import { createDbStore } from "./db-store";
import { getDriver } from "../db";

export { storagePaths, type FileStore } from "./types";

const g = globalThis as unknown as { __mswStore?: FileStore };

export function getFileStore(): FileStore {
  if (!g.__mswStore) {
    g.__mswStore =
      config.mode === "supabase"
        ? createSupabaseStore(config.supabaseUrl!, config.serviceRoleKey!, config.storageBucket)
        : config.hostedDemo
          ? createDbStore(getDriver)
          : createLocalStore(config.storageDir);
  }
  return g.__mswStore;
}

export function setFileStoreForTesting(store: FileStore) {
  g.__mswStore = store;
}
