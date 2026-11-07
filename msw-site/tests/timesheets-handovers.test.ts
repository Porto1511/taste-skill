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
import { createDaywork, createDelivery, createHandover } from "@/server/files/handovers";
import { buildDayworkSheet, buildDeliveryNote, buildHandoverCertificate } from "@/server/files/certificate";
import { getDaywork, getDelivery, getHandover } from "@/server/queries/handovers";
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
  // set off -> arrived on site -> left site -> got back
  const insert = (key: string, date: string, extra = "") =>
    asUser(db, key).query<{ user_id: string; status: string; site_minutes: number; driving_minutes: number; travel_minutes: number }>(
      `insert into timesheets (user_id, work_date, job_id, vehicle_reg, travel_mode, travel_out_start, travel_out_end,
         travel_back_start, travel_back_end, work_done ${extra ? ", status" : ""})
       values ($1, $2, $3, 'AB12 CDE', 'driver', '06:00', '07:15', '16:30', '17:45', '{netting}' ${extra ? `, '${extra}'` : ""})
       returning user_id, status, site_minutes, driving_minutes, travel_minutes`,
      [ids.user("claire"), date, ids.job("bm")],
    );

  it("an MSW operative records a job; hours are worked out from the four times; author and status are forced", async () => {
    const [row] = await insert("gareth", "2026-09-01", "approved");
    expect(row.user_id).toBe(ids.user("gareth")); // not Claire, whatever was sent
    expect(row.status).toBe("submitted");
    expect(row.site_minutes).toBe(555); // arrived 07:15 -> left site 16:30
    expect(row.driving_minutes).toBe(150);
    expect(row.travel_minutes).toBe(150);
  });

  it("handles a journey home past midnight", async () => {
    const [row] = await asUser(db, "luke").query<{ travel_minutes: number }>(
      `insert into timesheets (user_id, work_date, travel_mode, vehicle_reg, location_note, travel_out_start, travel_out_end, travel_back_start, travel_back_end, work_done)
       values (auth.uid(), '2026-09-02', 'driver', 'X1', 'Delivery', '13:00', '14:00', '22:30', '00:45', '{delivery}') returning travel_minutes`,
    );
    expect(row.travel_minutes).toBe(60 + 135);
  });

  it("a passenger's travel is not driving time; there is no 'no travel' option", async () => {
    const [row] = await asUser(db, "chris").query<{ driving_minutes: number; travel_minutes: number }>(
      `insert into timesheets (user_id, work_date, travel_mode, driven_by, location_note, travel_out_start, travel_out_end, travel_back_start, travel_back_end, work_done)
       values (auth.uid(), '2026-09-02', 'passenger', 'Gareth Evans', 'Yard', '06:00', '07:00', '15:00', '16:00', '{other}') returning driving_minutes, travel_minutes`,
    );
    expect(row).toEqual({ driving_minutes: 0, travel_minutes: 120 });
    await expect(asUser(db, "chris").query(
      `insert into timesheets (user_id, work_date, travel_mode, location_note, travel_out_start, travel_out_end, travel_back_start)
       values (auth.uid(), '2026-09-05', 'none', 'Yard', '06:00', '07:00', '15:00')`,
    )).rejects.toMatchObject({ code: "23514" });
  });

  it("a day can have several jobs, each with the work done; only netting/deck/studs/delivery/other", async () => {
    await asUser(db, "luke").query(
      `insert into timesheets (user_id, work_date, job_id, travel_mode, vehicle_reg, travel_out_start, travel_out_end, travel_back_start, work_done, work_description)
       values (auth.uid(), '2026-09-03', $1, 'driver', 'X1', '06:00', '07:00', '12:00', '{deck,studs}', 'Bays 1-4')`, [ids.job("riverside")]);
    await asUser(db, "luke").query(
      `insert into timesheets (user_id, work_date, location_note, travel_mode, vehicle_reg, travel_out_start, travel_out_end, travel_back_start, travel_back_end, work_done)
       values (auth.uid(), '2026-09-03', 'Delivery to yard', 'driver', 'X1', '12:00', '12:45', '15:00', '15:30', '{delivery}')`);
    const day = await asUser(db, "luke").query<{ site_minutes: number; driving_minutes: number; work_done: string[] }>(
      "select site_minutes, driving_minutes, work_done from timesheets where work_date = '2026-09-03' order by travel_out_start");
    expect(day.map((d) => d.work_done)).toEqual([["deck", "studs"], ["delivery"]]);
    expect(day.reduce((t, d) => t + d.site_minutes, 0)).toBe(300 + 135);
    expect(day.reduce((t, d) => t + d.driving_minutes, 0)).toBe(60 + 75);
    await expect(asUser(db, "luke").query(
      `insert into timesheets (user_id, work_date, travel_mode, vehicle_reg, location_note, travel_out_start, travel_out_end, travel_back_start, work_done)
       values (auth.uid(), '2026-09-04', 'driver', 'X1', 'x', '06:00', '07:00', '08:00', '{concrete}')`,
    )).rejects.toMatchObject({ code: "23514" });
  });

  it("approving a two-job day sends the operative one notification", async () => {
    await asUser(db, "claire").query("update timesheets set status = 'approved' where user_id = $1 and work_date = '2026-09-03'", [ids.user("luke")]);
    const n = await asUser(db, "luke").query("select id from notifications where href = '/timesheet/2026-09-03'");
    expect(n).toHaveLength(1);
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

  it("operatives cannot approve their own day; the office cannot alter the recorded times", async () => {
    await asUser(db, "gareth").query("update timesheets set status = 'approved', travel_back_start = '18:00' where work_date = '2026-09-01'");
    let [t] = await system(db)<{ status: string; site_minutes: number }>(
      "select status, site_minutes from timesheets where user_id = $1 and work_date = '2026-09-01'", [ids.user("gareth")]);
    expect(t).toEqual({ status: "submitted", site_minutes: 645 });

    await asUser(db, "sam").query(
      "update timesheets set status = 'approved', office_note = 'OK', travel_back_start = '23:00' where user_id = $1 and work_date = '2026-09-01'",
      [ids.user("gareth")]);
    [t] = await system(db)<{ status: string; site_minutes: number }>(
      "select status, site_minutes from timesheets where user_id = $1 and work_date = '2026-09-01'", [ids.user("gareth")]);
    expect(t).toEqual({ status: "approved", site_minutes: 645 });

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
  const input = (area: string, scopes: string[] = ["deck"]) => ({
    jobId: ids.job("bm"), areaId: ids.area("bm", area), title: "Level 1 deck complete", scopes,
    details: { deck: { area: "Level 1, grids A–D" }, netting: { gridlines: "Level 1, grids A–D" } } as Record<string, Record<string, string>>,
    daysWorked: ["mon", "tue"], weekCommencing: "2026-11-02",
    signerName: "Martin Doyle", signerCompany: "Kingsgate Construction Ltd", signerPosition: "Site Manager", signerEmail: null,
  });
  const sigs = async (client?: Buffer) => ({ client: { name: "c.png", bytes: client ?? await signature() }, msw: { name: "m.png", bytes: await signature() } });

  it("an allocated operative captures a signed handover; drawings at handover are recorded server-side", async () => {
    const res = await createHandover(viewer("mark"), input("l1"), await sigs(), []);
    const [h] = await system(db)<{ captured_by_name: string; drawing_refs: { doc_number: string }[] }>(
      "select captured_by_name, drawing_refs from handovers where id = $1", [res.id]);
    expect(h.captured_by_name).toBe("Mark Jones");
    expect(h.drawing_refs.map((d) => d.doc_number)).toContain("MSW-2611-DK-101");
    expect(h.drawing_refs.map((d) => d.doc_number)).not.toContain("MSW-2611-DK-103");
    const office = await asUser(db, "claire").query<{ title: string }>("select title from notifications where kind = 'handover.signed'");
    expect(office.map((n) => n.title)).toContain("Handover signed on MSW-2611: Level 1 deck complete");
  });

  it("trades can be handed over separately (nets first) and a handover must name at least one trade", async () => {
    const nets = await createHandover(viewer("mark"), { ...input("l1", ["netting"]), title: "Level 1 nets" }, await sigs(), []);
    const [row] = await system(db)<{ scopes: string[] }>("select scopes from handovers where id = $1", [nets.id]);
    expect(row.scopes).toEqual(["netting"]);
    await expect(system(db)("update handovers set scopes = '{}' where id = $1", [nets.id])).rejects.toMatchObject({ code: "23514" });
    await expect(system(db)("update handovers set scopes = '{concrete}' where id = $1", [nets.id])).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects an empty signature and handovers outside the user's allocation", async () => {
    await expect(createHandover(viewer("mark"), input("l1"), await sigs(await blank()), [])).rejects.toThrow(/empty/);
    await expect(createHandover(viewer("john"), input("l3"), await sigs(), [])).rejects.toMatchObject({ code: "42501" });
    await expect(createHandover(viewer("paul"), input("l1"), await sigs(), [])).rejects.toMatchObject({ code: "42501" });
  });

  it("is visible by area and cannot be edited or deleted", async () => {
    const titles = async (k: string) => (await asUser(db, k).query<{ title: string }>("select title from handovers order by title")).map((r) => r.title);
    expect(await titles("john")).toContain("Level 2 — deck & studs handover");
    expect(await titles("liam")).not.toContain("Level 2 — deck & studs handover"); // Levels 3–4 only
    expect(await titles("liam")).toContain("Level 3 — nets handover");
    expect(await titles("paul")).toEqual([]);
    await expect(asUser(db, "claire").query("update handovers set signer_name = 'Someone else'")).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "claire").query("delete from handovers")).rejects.toMatchObject({ code: "42501" });
  });

  it("produces a PDF certificate including the signature", async () => {
    const [{ id }] = await system(db)<{ id: string }>("select id from handovers where title = 'Level 2 — deck & studs handover'");
    const h = (await getHandover({ ...viewer("claire"), isStaff: true }, id))!;
    expect(h.details.studs.totalStuds).toBe("1240");
    expect(h.msw_signature_path).toBeTruthy();
    const pdf = await buildHandoverCertificate(h, { client: (await store.get(h.signature_path))!, msw: (await store.get(h.msw_signature_path!))! }, await Promise.all(h.photos.map(async (p) => (await store.get(p.storage_path))!)));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  });
});

describe("certificate fields", () => {
  it("only keeps the fields for the trades being handed over, and requires the paper-form fields", async () => {
    const { handoverInput } = await import("@/server/files/handovers");
    const base = { jobId: ids.job("bm"), areaId: "", title: "Level 1", daysWorked: ["mon"], weekCommencing: "2026-11-02", signerName: "Martin Doyle", signerCompany: "Kingsgate", signerPosition: "", signerEmail: "" };
    expect(handoverInput.safeParse({ ...base, scopes: ["deck"], details: {} }).success).toBe(false);
    expect(handoverInput.safeParse({ ...base, scopes: ["studs"], details: { studs: { floorLevel: "L1", totalStuds: "lots" } } }).success).toBe(false);
    expect(handoverInput.safeParse({ ...base, scopes: ["deck"], details: { deck: { area: "L1 A–D" } }, daysWorked: [] }).success).toBe(false);
    expect(handoverInput.safeParse({ ...base, scopes: ["deck"], details: { deck: { area: "L1 A–D" } } }).success).toBe(true);
  });
});

describe("daywork sheets and delivery notes", () => {
  const signature = () =>
    sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg width="300" height="100"><path d="M10 80 C 60 10, 120 90, 290 30" stroke="black" stroke-width="5" fill="none"/></svg>'), top: 0, left: 0 }])
      .png().toBuffer();
  const hours = (tue: number) => ({ mon: 0, tue, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 });
  const daywork = (job = ids.job("bm")) => ({
    jobId: job, weekCommencing: "2026-11-02", workers: [{ name: "Mark Jones", trade: "Decker", hours: hours(2) }],
    description: "Standing time waiting for crane", materials: null, workComplete: true,
    clientName: "Martin Doyle", clientCompany: "Kingsgate Construction Ltd", clientPosition: null, clientEmail: null,
  });
  const delivery = (job = ids.job("bm")) => ({
    jobId: job, items: [{ description: "Deck sheets MD60", quantity: "40" }], deliveredBy: "Mark Jones", vehicleReg: "MS21 NET", notes: null,
    receiverName: "Martin Doyle", receiverCompany: "Kingsgate Construction Ltd", receiverPosition: null, receiverEmail: null,
  });
  const two = async () => ({ name: "a.png", bytes: await signature() });

  it("anyone on the job can raise them; nobody off the job can", async () => {
    const dw = await createDaywork(viewer("mark"), daywork(), { client: await two(), msw: await two() });
    const dl = await createDelivery(viewer("mark"), delivery(), { receiver: await two(), driver: await two() });
    const [row] = await system(db)<{ captured_by_name: string }>("select captured_by_name from dayworks where id = $1", [dw.id]);
    expect(row.captured_by_name).toBe("Mark Jones");
    expect(dl.id).toBeTruthy();
    await expect(createDaywork(viewer("paul"), daywork(), { client: await two(), msw: await two() })).rejects.toMatchObject({ code: "42501" });
    await expect(createDelivery(viewer("paul"), delivery(), { receiver: await two(), driver: await two() })).rejects.toMatchObject({ code: "42501" });
    const office = await asUser(db, "claire").query<{ kind: string }>("select kind from notifications where kind in ('daywork.signed','delivery.signed')");
    expect(new Set(office.map((n) => n.kind))).toEqual(new Set(["daywork.signed", "delivery.signed"]));
  });

  it("are seen by the office, the person who raised them and nobody else's gang", async () => {
    const seen = async (k: string, table: string) => (await asUser(db, k).query<{ id: string }>(`select id from ${table}`)).length;
    for (const table of ["dayworks", "deliveries"]) {
      expect(await seen("claire", table)).toBeGreaterThanOrEqual(2);
      expect(await seen("paul", table)).toBe(0);
      // ABC's manager has the report grant: sees ABC's (Mark's) sheet, never Northern Edge's or MSW's.
      const names = (await asUser(db, "dave").query<{ captured_by_name: string }>(`select captured_by_name from ${table}`)).map((r) => r.captured_by_name);
      expect(names).toEqual(["Mark Jones"]);
    }
    expect(await seen("sarah", "dayworks")).toBe(0); // Northern Edge manager without the report grant on this job
    expect(await seen("liam", "dayworks")).toBe(1); // their own standing-time sheet
    expect(await seen("ryan", "dayworks")).toBe(0); // same gang, not the person who raised it
    expect(await seen("gareth", "deliveries")).toBe(1);
  });

  it("cannot be edited or deleted once signed", async () => {
    for (const table of ["dayworks", "deliveries"]) {
      await expect(asUser(db, "claire").query(`update ${table} set created_at = now()`)).rejects.toMatchObject({ code: "42501" });
      await expect(asUser(db, "claire").query(`delete from ${table}`)).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("produces the daywork sheet and delivery note PDFs", async () => {
    const staff = { ...viewer("claire"), isStaff: true };
    const [{ id: dwId }] = await system(db)<{ id: string }>("select id from dayworks where description like 'Standing time — crane%'");
    const d = (await getDaywork(staff, dwId))!;
    const sheet = await buildDayworkSheet(d, { client: (await store.get(d.client_signature_path))!, msw: (await store.get(d.msw_signature_path))! });
    expect(sheet.subarray(0, 5).toString()).toBe("%PDF-");
    const [{ id: dlId }] = await system(db)<{ id: string }>("select id from deliveries where delivered_by = 'Gareth Evans'");
    const v = (await getDelivery(staff, dlId))!;
    expect(v.items).toHaveLength(3);
    const note = await buildDeliveryNote(v, { receiver: (await store.get(v.receiver_signature_path))!, driver: (await store.get(v.driver_signature_path))! });
    expect(note.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
