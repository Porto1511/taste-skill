import "server-only";
import { withUser } from "../db";
import { getFileStore } from "../storage";
import { log } from "../log";
import { makeThumbnail, safeFileName } from "./validate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const baseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Same response whether the file does not exist or the user may not see it. */
export function notFound() {
  return new Response("Not found", { status: 404, headers: { ...baseHeaders, "Content-Type": "text/plain" } });
}

function disposition(kind: "inline" | "attachment", fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Stream a document revision.  Authorisation is the RLS-checked lookup: if
 * the viewer cannot select the revision row, they get a 404 and no bytes.
 */
export async function serveRevision(viewerId: string, revisionId: string, download: boolean): Promise<Response> {
  if (!UUID.test(revisionId)) return notFound();
  const rev = await withUser(viewerId, async (tx) => {
    const row = (
      await tx.query<{ storage_path: string; file_name: string; mime_type: string; doc_number: string; revision: string }>(
        `select r.storage_path, r.file_name, r.mime_type, d.doc_number, r.revision
         from document_revisions r join documents d on d.id = r.document_id where r.id = $1`,
        [revisionId],
      )
    ).rows[0];
    if (row) await tx.query("select public.log_document_access($1, $2)", [revisionId, download ? "downloaded" : "viewed"]);
    return row;
  });
  if (!rev) {
    log.info("file.denied_or_missing", { viewerId, revisionId });
    return notFound();
  }
  const data = await getFileStore().get(rev.storage_path);
  if (!data) {
    log.error("file.storage_missing", { revisionId, path: rev.storage_path });
    return notFound();
  }
  const fileName = safeFileName(rev.file_name, `${rev.doc_number}_rev${rev.revision}.pdf`);
  return new Response(new Uint8Array(data), {
    headers: {
      ...baseHeaders,
      "Content-Type": "application/pdf",
      "Content-Length": String(data.length),
      "Content-Disposition": disposition(download ? "attachment" : "inline", fileName),
    },
  });
}

export async function servePhoto(viewerId: string, photoId: string, thumb: boolean): Promise<Response> {
  if (!UUID.test(photoId)) return notFound();
  const photo = await withUser(viewerId, async (tx) =>
    (await tx.query<{ storage_path: string }>("select storage_path from report_photos where id = $1", [photoId])).rows[0],
  );
  if (!photo) return notFound();
  const data = await getFileStore().get(photo.storage_path);
  if (!data) {
    log.error("file.storage_missing", { photoId, path: photo.storage_path });
    return notFound();
  }
  const body = thumb ? await makeThumbnail(data) : data;
  return new Response(new Uint8Array(body), {
    headers: { ...baseHeaders, "Content-Type": "image/jpeg", "Content-Length": String(body.length) },
  });
}

/** Handover photos and signatures: visible to whoever can see the handover (RLS). */
export async function serveHandoverFile(viewerId: string, id: string, kind: "photo" | "signature", thumb = false): Promise<Response> {
  if (!UUID.test(id)) return notFound();
  const path = await withUser(viewerId, async (tx) =>
    kind === "photo"
      ? (await tx.query<{ p: string }>("select storage_path as p from handover_photos where id = $1", [id])).rows[0]?.p
      : (await tx.query<{ p: string }>("select signature_path as p from handovers where id = $1", [id])).rows[0]?.p,
  );
  if (!path) return notFound();
  const data = await getFileStore().get(path);
  if (!data) return notFound();
  const body = kind === "photo" && thumb ? await makeThumbnail(data) : data;
  return new Response(new Uint8Array(body), {
    headers: { ...baseHeaders, "Content-Type": kind === "photo" ? "image/jpeg" : "image/png", "Content-Length": String(body.length) },
  });
}
