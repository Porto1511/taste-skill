/**
 * Server-side file pipeline: authorised downloads (direct URL attempts),
 * report/photo uploads and document revision uploads, exercised through the
 * same functions the route handlers call.
 */
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { serveRevision, servePhoto } from "@/server/files/serve";
import { addRevision, createDocument, createReport } from "@/server/files/uploads";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;

beforeAll(async () => {
  ({ driver: db, store } = await createSeededDb());
  setDriverForTesting(db);
  setFileStoreForTesting(store);
});

function viewer(key: string, role: Viewer["role"] = "operative", companyId = "00000000-0000-0000-0000-000000000000"): Viewer {
  return {
    id: ids.user(key), fullName: key, email: `${key}@x.example`, role, jobTitle: null, companyId, companyName: "",
    isMswEmployee: false, isStaff: role === "admin" || role === "office", isAdmin: role === "admin", keepsTimesheet: false, unreadNotifications: 0,
  };
}

const minimalPdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("document downloads", () => {
  it("serves the current revision to an allocated operative", async () => {
    const res = await serveRevision(ids.user("john"), ids.rev("bm-dk1", "C02"), false);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns 404 (no bytes) to a same-company operative who is not allocated", async () => {
    const res = await serveRevision(ids.user("paul"), ids.rev("bm-dk1", "C02"), false);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });

  it("returns 404 for an out-of-area drawing on the user's own job", async () => {
    expect((await serveRevision(ids.user("john"), ids.rev("bm-sn", "B"), false)).status).toBe(404);
    expect((await serveRevision(ids.user("liam"), ids.rev("bm-sn", "B"), false)).status).toBe(200);
  });

  it("never serves superseded or draft revisions outside the office", async () => {
    expect((await serveRevision(ids.user("john"), ids.rev("bm-dk1", "C01"), false)).status).toBe(404);
    expect((await serveRevision(ids.user("liam"), ids.rev("bm-dk3", "C02"), false)).status).toBe(404);
    expect((await serveRevision(ids.user("sam"), ids.rev("bm-dk1", "C01"), false)).status).toBe(200);
  });

  it("rejects malformed identifiers", async () => {
    expect((await serveRevision(ids.user("john"), "../../etc/passwd", false)).status).toBe(404);
  });

  it("logs opens and downloads for the office's 'who has it' view", async () => {
    await serveRevision(ids.user("mark"), ids.rev("bm-dk1", "C02"), true);
    const reach = await asUser(db, "claire").query<{ full_name: string; viewed_at: string | null }>(
      "select full_name, viewed_at from public.document_reach($1)",
      [ids.rev("bm-dk1", "C02")],
    );
    expect(reach.find((r) => r.full_name === "Mark Jones")?.viewed_at).toBeTruthy();
    expect(reach.find((r) => r.full_name === "John Smith")?.viewed_at).toBeTruthy();
    expect(reach.map((r) => r.full_name)).not.toContain("Liam Turner"); // Level 1 drawing
    await expect(asUser(db, "john").query("select * from public.document_reach($1)", [ids.rev("bm-dk1", "C02")])).rejects.toMatchObject({ code: "42501" });
  });
});

describe("photo access", () => {
  it("serves report photos only to people who can see the report", async () => {
    const [photo] = await system(db)<{ id: string }>("select id from report_photos where report_id = $1", [ids.report("bm-edge")]);
    expect((await servePhoto(ids.user("john"), photo.id, true)).status).toBe(200);
    expect((await servePhoto(ids.user("dave"), photo.id, false)).status).toBe(200); // Derby Decking manager with report grant
    expect((await servePhoto(ids.user("mark"), photo.id, false)).status).toBe(404); // colleague, not shared
    expect((await servePhoto(ids.user("liam"), photo.id, false)).status).toBe(404);
    expect((await servePhoto(ids.user("sarah"), photo.id, false)).status).toBe(404);
  });
});

describe("report uploads", () => {
  it("creates a report with sanitised photos (re-encoded, metadata stripped)", async () => {
    const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#888" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } })
      .toBuffer();
    expect(withExif.toString("latin1")).toContain("secret-gps-test");

    const report = await createReport(
      viewer("john"),
      { jobId: ids.job("bm"), kind: "issue", category: "materials", priority: "high", areaId: ids.area("bm", "l2"), title: "Damaged sheets", description: "Bundle 9 dented" },
      [{ file: { name: "IMG_0001.jpg", bytes: withExif }, caption: "Dented sheets" }],
    );
    const [row] = await system(db)<{ author_name: string; status: string }>("select author_name, status from reports where id = $1", [report.id]);
    expect(row).toEqual({ author_name: "John Smith", status: "open" });

    const [photo] = await system(db)<{ storage_path: string; width: number }>("select storage_path, width from report_photos where report_id = $1", [report.id]);
    expect(photo.width).toBe(2400); // capped
    const stored = store.files.get(photo.storage_path)!;
    expect(stored.toString("latin1")).not.toContain("secret-gps-test");
  });

  it("rejects a non-image disguised as a photo", async () => {
    await expect(
      createReport(viewer("john"), { jobId: ids.job("bm"), kind: "photo", priority: "normal", areaId: null, title: null, description: null },
        [{ file: { name: "evil.jpg", bytes: Buffer.from("<script>alert(1)</script>") }, caption: null }]),
    ).rejects.toThrow(/could not be read as an image/);
  });

  it("refuses uploads to a job the user is not allocated to, leaving no orphaned files", async () => {
    const before = store.files.size;
    const img = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(
      createReport(viewer("paul"), { jobId: ids.job("bm"), kind: "photo", priority: "normal", areaId: null, title: null, description: null },
        [{ file: { name: "a.jpg", bytes: img }, caption: null }]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(store.files.size).toBe(before);
  });
});

describe("document uploads", () => {
  it("the administrator uploads a new revision as draft; it stays hidden from site until approved", async () => {
    const { revisionId } = await addRevision(viewer("claire", "admin"), { documentId: ids.doc("bm-dk2"), revision: "C02", changeNote: "Bay sizes", approve: false }, { name: "dk102.pdf", bytes: minimalPdf });
    expect((await serveRevision(ids.user("john"), revisionId, false)).status).toBe(404);
    await asUser(db, "claire").query("select public.approve_revision($1)", [revisionId]);
    expect((await serveRevision(ids.user("john"), revisionId, false)).status).toBe(200);
    expect((await serveRevision(ids.user("john"), ids.rev("bm-dk2", "C01"), false)).status).toBe(404);
    const notes = await asUser(db, "john").query<{ title: string }>("select title from notifications where title like '%DK-102%'");
    expect(notes.map((n) => n.title)).toContain("Drawing updated: MSW-2611-DK-102 now rev C02");
  });

  it("creates a new area-restricted document with an approved first revision", async () => {
    const { documentId } = await createDocument(
      viewer("claire", "admin"),
      { jobId: ids.job("bm"), kind: "drawing", docNumber: "MSW-2611-DK-105", title: "Roof Deck Layout", description: null, areaIds: [ids.area("bm", "roof")], revision: "C01", changeNote: null, approve: true },
      { name: "roof.pdf", bytes: minimalPdf },
    );
    expect(await asUser(db, "gareth").query("select id from documents where id = $1", [documentId])).toHaveLength(1);
    expect(await asUser(db, "john").query("select id from documents where id = $1", [documentId])).toHaveLength(0);
  });

  it("operatives cannot upload documents and non-PDFs are rejected", async () => {
    await expect(
      addRevision(viewer("john"), { documentId: ids.doc("bm-dk1"), revision: "X1", changeNote: null, approve: false }, { name: "a.pdf", bytes: minimalPdf }),
    ).rejects.toThrow();
    await expect(
      addRevision(viewer("claire", "admin"), { documentId: ids.doc("bm-dk1"), revision: "C03", changeNote: null, approve: false }, { name: "a.pdf", bytes: Buffer.from("MZ executable") }),
    ).rejects.toThrow(/not a PDF/);
  });
});
