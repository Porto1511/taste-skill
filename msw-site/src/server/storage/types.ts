export interface FileStore {
  readonly kind: "local" | "supabase";
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer | null>;
  remove(paths: string[]): Promise<void>;
}

const SAFE_PATH = /^jobs\/[0-9a-f-]{36}\/(revisions|photos)\/[0-9a-f-]{36}\.(pdf|jpg)$/;

/** Storage paths are always generated server-side; reject anything else. */
export function assertSafePath(path: string) {
  if (!SAFE_PATH.test(path)) {
    throw new Error(`Refusing unsafe storage path: ${path}`);
  }
}

export const storagePaths = {
  revision: (jobId: string, revisionId: string) => `jobs/${jobId}/revisions/${revisionId}.pdf`,
  photo: (jobId: string, photoId: string) => `jobs/${jobId}/photos/${photoId}.jpg`,
};
