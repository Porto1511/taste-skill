export interface FileStore {
  readonly kind: "local" | "supabase";
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer | null>;
  remove(paths: string[]): Promise<void>;
}

const UUID = "[0-9a-f-]{36}";
const SAFE_PATH = new RegExp(
  `^(jobs/${UUID}/(revisions/${UUID}\\.pdf|photos/${UUID}\\.jpg|signatures/${UUID}\\.png)` +
  `|deliveries/${UUID}/${UUID}\\.png|companies/${UUID}/certificates/${UUID}\\.pdf|site-visits/${UUID}/${UUID}\\.jpg|companies/${UUID}/cards/${UUID}\\.(pdf|jpg))$`,
);

/** Storage paths are always generated server-side; reject anything else. */
export function assertSafePath(path: string) {
  if (!SAFE_PATH.test(path)) {
    throw new Error(`Refusing unsafe storage path: ${path}`);
  }
}

export const storagePaths = {
  revision: (jobId: string, revisionId: string) => `jobs/${jobId}/revisions/${revisionId}.pdf`,
  photo: (jobId: string, photoId: string) => `jobs/${jobId}/photos/${photoId}.jpg`,
  signature: (jobId: string, handoverId: string) => `jobs/${jobId}/signatures/${handoverId}.png`,
  deliverySignature: (deliveryId: string, signatureId: string) => `deliveries/${deliveryId}/${signatureId}.png`,
  certificate: (companyId: string, certificateId: string) => `companies/${companyId}/certificates/${certificateId}.pdf`,
  visitPhoto: (visitId: string, photoId: string) => `site-visits/${visitId}/${photoId}.jpg`,
  card: (companyId: string, cardId: string, ext: "pdf" | "jpg") => `companies/${companyId}/cards/${cardId}.${ext}`,
};
