/** Site visits: office only, typed job numbers link to known jobs, photos, blockers and the PDF report. */
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { createSiteVisit, deleteSiteVisit, setBlockerCleared, siteVisitInput } from "@/server/files/site-visits";
import { getSiteVisit, listSiteVisits } from "@/server/queries/site-visits";
import { buildSiteVisitReport } from "@/server/files/certificate";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;
beforeAll(async () => { ({ driver: db, store } = await createSeededDb()); setDriverForTesting(db); setFileStoreForTesting(store); });

const v = (key: string, role: Viewer["role"]): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role, jobTitle: null, companyId: "", companyName: "",
  isMswEmployee: role !== "operative", isStaff: role === "admin" || role === "office", isAdmin: role === "admin", keepsTimesheet: false, canSiteVisit: role === "admin" || role === "office", unreadNotifications: 0,
});
const visit = (jobNumber: string) => siteVisitInput.parse({
  jobNumber, jobName: "", siteAddress: "Plot 4, Station Road, Derby", visitDate: "2026-11-24", visitType: "pre_start",
  metName: "Martin Doyle", metPhone: "07700 900201",
  areas: [{ name: "Level 3", status: "part", note: "Steel up, not bolted off", expected: "w/c 8 Dec" }],
  checklist: { handrails: { answer: "partial", note: "None on east side" }, mewp: { answer: "yes", note: "2 x scissor, client supplies" }, bogus: { answer: "yes", note: "" } },
  blockers: [{ text: "No handrails on Level 4 east side", owner: "client", severity: "stops" }],
  ready: "conditional", conditions: "Handrails on L4", proposedStart: "2026-12-08", menNeeded: "4", plantNeeded: "2 scissor lifts",
  actions: [{ what: "Book MEWP", who: "Alan", by: "Fri" }], notes: "Gateman needs 24h notice",
});
const photo = () => sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 130, b: 140 } } }).jpeg().toBuffer();

describe("site visits", () => {
  it("the office records a visit; a known job number links to the job, a new one doesn't", async () => {
    const known = await createSiteVisit(v("claire", "admin"), visit("msw-2611"), [{ bytes: await photo(), caption: "Level 3 east" }]);
    const fresh = await createSiteVisit(v("sam", "office"), visit("NEW-0200"), []);
    const [k] = await system(db)<{ job_id: string | null; visited_by_name: string; checklist: Record<string, unknown> }>("select job_id, visited_by_name, checklist from site_visits where id = $1", [known.id]);
    expect(k.job_id).toBe(ids.job("bm"));
    expect(k.visited_by_name).toBe("Damian Pendleton");
    expect(Object.keys(k.checklist).sort()).toEqual(["handrails", "mewp"]); // unknown checklist keys are dropped
    expect((await system(db)<{ job_id: string | null }>("select job_id from site_visits where id = $1", [fresh.id]))[0].job_id).toBeNull();
    const d = (await getSiteVisit(v("claire", "admin"), known.id))!;
    expect(d.photos).toHaveLength(1);
    expect(d.open_blockers).toBe(1);
  });

  it("is office only: operatives, subcontractors and managers can't see or create visits", async () => {
    for (const key of ["gareth", "john", "dave", "liam"]) {
      expect(await asUser(db, key).query("select id from site_visits")).toHaveLength(0);
      expect(await asUser(db, key).query("select id from site_visit_photos")).toHaveLength(0);
    }
    await expect(createSiteVisit(v("gareth", "operative"), visit("X-1"), [])).rejects.toThrow(/office/);
    await expect(asUser(db, "john").query(
      "insert into site_visits (job_number, site_address, visit_date, visit_type, ready, visited_by, visited_by_name) values ('X', 'Somewhere', '2026-11-24', 'progress', 'no', $1, 'x')",
      [ids.user("john")])).rejects.toMatchObject({ code: "42501" });
  });

  it("blockers can be marked cleared; the PDF report builds with photos; delete removes the files", async () => {
    const staff = v("claire", "admin");
    const [first] = await listSiteVisits(staff, ids.job("bm"));
    await setBlockerCleared(staff, first.id, 0, true);
    const d = (await getSiteVisit(staff, first.id))!;
    expect(d.open_blockers).toBe(0);
    expect(d.blockers[0].cleared_at).toBeTruthy();
    const pdf = await buildSiteVisitReport(d, await Promise.all(d.photos.map(async (p) => (await store.get(p.storage_path))!)));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const before = store.files.size;
    await deleteSiteVisit(staff, first.id);
    expect(store.files.size).toBe(before - 1);
    expect(await getSiteVisit(staff, first.id)).toBeNull();
  });

  it("an MSW lad given site visits (Ian) can record and see them; other lads can't", async () => {
    const ian: Viewer = { ...v("ian", "operative"), isMswEmployee: true, keepsTimesheet: true, canSiteVisit: true };
    const { id } = await createSiteVisit(ian, visit("MSW-2611"), []);
    expect((await asUser(db, "ian").query("select id from site_visits where id = $1", [id]))).toHaveLength(1);
    expect(await asUser(db, "gareth").query("select id from site_visits")).toHaveLength(0);
    await expect(asUser(db, "gareth").query(
      "insert into site_visits (job_number, site_address, visit_date, visit_type, ready, visited_by, visited_by_name) values ('X', 'Somewhere', '2026-11-24', 'progress', 'no', $1, 'x')",
      [ids.user("gareth")])).rejects.toMatchObject({ code: "42501" });
    const [row] = await system(db)<{ visited_by_name: string }>("select visited_by_name from site_visits where id = $1", [id]);
    expect(row.visited_by_name).toBe("Ian Spencer");
  });
});
