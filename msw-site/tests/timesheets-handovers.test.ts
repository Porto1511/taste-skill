/**
 * Live-only job access, daily timesheets and handover sign-off — enforced
 * by the database (RLS + triggers), exercised as real users.
 */
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { serveRevision } from "@/server/files/serve";
import { createHandover } from "@/server/files/handovers";
import { buildHandoverCertificate } from "@/server/files/certificate";
import { getHandover } from "@/server/queries/handovers";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;

beforeAll(async () => {
  ({ driver: db, store } = await createSeededDb());
  setDriverForTesting(db);
  setFileStoreForTesting(store);
});

const viewer = (key: string): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role: "operative", jobTitle: null, companyId: "", companyName: "",
  isMswEmployee: false, isStaff: false, isAdmin: false, keepsTimesheet: false, unreadNotifications: 0,
});
const jobs = async (key: string) =>
  (await asUser(db, key).query<{ job_number: string }>("select job_number from jobs order by 1")).map((r) => r.job_number);

describe("site users only see LIVE jobs", () => {
  it("a planned job is invisible to the operative booked on it until it goes live", async () => {
    expect(await jobs("chris")).toEqual([]); // allocated to Wharf Street, which is planned
    await asUser(db, "claire").query("update jobs set status = 'live' where id = $1", [ids.job("wharf")]);
    expect(await jobs("chris")).toEqual(["MSW-2617"]);
    const note = await asUser(db, "chris").query<{ title: string }>("select title from notifications where kind = 'job.live'");
    expect(note.map((n) => n.title)).toEqual(["MSW-2617 is now live"]);
    await asUser(db, "claire").query("update jobs set status = 'planned' where id = $1", [ids.job("wharf")]);
  });

  it("putting a job on hold removes it, its drawings and its files from site immediately", async () => {
    expect(await jobs("gareth")).toEqual(["MSW-2611"]);
    await asUser(db, "claire").query("update jobs set status = 'on_hold' where id = $1", [ids.job("bm")]);
    expect(await jobs("gareth")).toEqual([]);
    expect(await asUser(db, "gareth").query("select id from documents where job_id = $1", [ids.job("bm")])).toHaveLength(0);
    expect((await serveRevision(ids.user("gareth"), ids.rev("bm-dk1", "C02"), false)).status).toBe(404);
    expect((await serveRevision(ids.user("sam"), ids.rev("bm-dk1", "C02"), false)).status).toBe(200); // office unaffected
    await asUser(db, "claire").query("update jobs set status = 'live' where id = $1", [ids.job("bm")]);
    expect(await jobs("gareth")).toEqual(["MSW-2611"]);
  });
});

describe("timesheets", () => {
  const insert = (key: string, date: string, extra = "") =>
    asUser(db, key).query<{ user_id: string; status: string; site_minutes: number; driving_minutes: number; travel_minutes: number }>(
      `insert into timesheets (user_id, work_date, job_id, vehicle_reg, travel_mode, travel_out_start, travel_out_end, site_start, site_finish,
         break_minutes, travel_back_start, travel_back_end ${extra ? ", status" : ""})
       values ($1, $2, $3, 'AB12 CDE', 'driver', '06:00', '07:15', '07:30', '16:30', 30, '16:30', '17:45' ${extra ? `, '${extra}'` : ""})
       returning user_id, status, site_minutes, driving_minutes, travel_minutes`,
      [ids.user("claire"), date, ids.job("bm")],
    );

  it("an MSW operative records a day; hours are calculated by the database; author and status are forced", async () => {
    const [row] = await insert("gareth", "2026-09-01", "approved");
    expect(row.user_id).toBe(ids.user("gareth")); // not Claire, whatever was sent
    expect(row.status).toBe("submitted");
    expect(row.site_minutes).toBe(510); // 9h minus 30 min break
    expect(row.driving_minutes).toBe(150);
    expect(row.travel_minutes).toBe(150);
  });

  it("handles a journey home past midnight", async () => {
    const [row] = await asUser(db, "luke").query<{ travel_minutes: number }>(
      `insert into timesheets (user_id, work_date, travel_mode, vehicle_reg, site_start, site_finish, travel_back_start, travel_back_end)
       values (auth.uid(), '2026-09-02', 'driver', 'X1', '14:00', '22:30', '22:30', '00:45') returning travel_minutes`,
    );
    expect(row.travel_minutes).toBe(135);
  });

  it("subcontractor operatives and managers cannot keep MSW timesheets", async () => {
    await expect(insert("john", "2026-09-01")).rejects.toMatchObject({ code: "42501" });
    await expect(insert("dave", "2026-09-01")).rejects.toMatchObject({ code: "42501" });
  });

  it("operatives see only their own timesheets; the office sees everyone's", async () => {
    const own = await asUser(db, "gareth").query<{ user_id: string }>("select user_id from timesheets");
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.user_id === ids.user("gareth"))).toBe(true);
    const all = await asUser(db, "sam").query<{ user_id: string }>("select distinct user_id from timesheets");
    expect(all.length).toBe(3);
  });

  it("operatives cannot approve their own day; the office cannot alter the recorded hours", async () => {
    await asUser(db, "gareth").query("update timesheets set status = 'approved', site_finish = '18:00' where work_date = '2026-09-01'");
    let [t] = await system(db)<{ status: string; site_minutes: number }>(
      "select status, site_minutes from timesheets where user_id = $1 and work_date = '2026-09-01'", [ids.user("gareth")]);
    expect(t).toEqual({ status: "submitted", site_minutes: 600 });

    await asUser(db, "sam").query(
      "update timesheets set status = 'approved', office_note = 'OK', site_finish = '23:00' where user_id = $1 and work_date = '2026-09-01'",
      [ids.user("gareth")]);
    [t] = await system(db)<{ status: string; site_minutes: number }>(
      "select status, site_minutes from timesheets where user_id = $1 and work_date = '2026-09-01'", [ids.user("gareth")]);
    expect(t).toEqual({ status: "approved", site_minutes: 600 });

    // Approved days are locked for the operative.
    const changed = await asUser(db, "gareth").query("update timesheets set notes = 'x' where work_date = '2026-09-01' returning id");
    expect(changed).toHaveLength(0);
    const notes = await asUser(db, "gareth").query<{ title: string }>("select title from notifications where kind = 'timesheet.approved'");
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe("handover sign-off", () => {
  const signature = () =>
    sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="300" height="100"><path d="M10 80 C 60 10, 120 90, 290 30" stroke="black" stroke-width="5" fill="none"/></svg>'), top: 0, left: 0 }])
      .png().toBuffer();
  const blank = () => sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const input = (area: string) => ({
    jobId: ids.job("bm"), areaId: ids.area("bm", area), title: "Level 1 deck complete", scope: null,
    checklist: [{ label: "Deck fixed", checked: true }], signerName: "Martin Doyle", signerCompany: "Kingsgate Construction Ltd",
    signerPosition: "Site Manager", signerEmail: null,
  });

  it("an allocated operative captures a signed handover; drawings at handover are recorded server-side", async () => {
    const res = await createHandover(viewer("mark"), input("l1"), { name: "sig.png", bytes: await signature() }, []);
    const [h] = await system(db)<{ captured_by_name: string; drawing_refs: { doc_number: string }[] }>(
      "select captured_by_name, drawing_refs from handovers where id = $1", [res.id]);
    expect(h.captured_by_name).toBe("Mark Jones");
    expect(h.drawing_refs.map((d) => d.doc_number)).toContain("MSW-2611-DK-101");
    expect(h.drawing_refs.map((d) => d.doc_number)).not.toContain("MSW-2611-DK-103");
    const office = await asUser(db, "claire").query<{ title: string }>("select title from notifications where kind = 'handover.signed'");
    expect(office.map((n) => n.title)).toContain("Handover signed on MSW-2611: Level 1 deck complete");
  });

  it("rejects an empty signature and handovers outside the user's allocation", async () => {
    await expect(createHandover(viewer("mark"), input("l1"), { name: "s.png", bytes: await blank() }, [])).rejects.toThrow(/empty/);
    await expect(createHandover(viewer("john"), input("l3"), { name: "s.png", bytes: await signature() }, [])).rejects.toMatchObject({ code: "42501" });
    await expect(createHandover(viewer("paul"), input("l1"), { name: "s.png", bytes: await signature() }, [])).rejects.toMatchObject({ code: "42501" });
  });

  it("is visible by area and cannot be edited or deleted", async () => {
    const titles = async (k: string) => (await asUser(db, k).query<{ title: string }>("select title from handovers order by title")).map((r) => r.title);
    expect(await titles("john")).toContain("Level 2 metal deck and edge trims");
    expect(await titles("liam")).not.toContain("Level 2 metal deck and edge trims"); // Levels 3–4 only
    expect(await titles("paul")).toEqual([]);
    await expect(asUser(db, "claire").query("update handovers set signer_name = 'Someone else'")).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "claire").query("delete from handovers")).rejects.toMatchObject({ code: "42501" });
  });

  it("produces a PDF certificate including the signature", async () => {
    const [{ id }] = await system(db)<{ id: string }>("select id from handovers where title = 'Level 2 metal deck and edge trims'");
    const h = (await getHandover({ ...viewer("claire"), isStaff: true }, id))!;
    const pdf = await buildHandoverCertificate(h, (await store.get(h.signature_path))!, await Promise.all(h.photos.map(async (p) => (await store.get(p.storage_path))!)));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  });
});
