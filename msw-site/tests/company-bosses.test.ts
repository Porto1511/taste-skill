/**
 * Subcontractor bosses run their own people: MSW gives a job to a company,
 * the boss ticks which of their lads see it, files their cards, and switches
 * off leavers.  Everything is enforced in the database.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { setFileStoreForTesting } from "@/server/storage";
import { uploadCard } from "@/server/files/cards";
import { createVariation } from "@/server/files/variations";
import { serveCard, serveHandoverFile } from "@/server/files/serve";
import { getVariation } from "@/server/queries/variations";
import type { Viewer } from "@/server/auth/viewer";
import { asUser, createSeededDb, ids, system, type createMemoryStore } from "./support/db";

let db: Driver;
let store: ReturnType<typeof createMemoryStore>;
beforeAll(async () => { ({ driver: db, store } = await createSeededDb()); setDriverForTesting(db); setFileStoreForTesting(store); });

const viewer = (key: string, extra: Partial<Viewer> = {}): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role: "operative", jobTitle: null, companyId: "", companyName: "",
  isMswEmployee: false, isStaff: false, isAdmin: false, keepsTimesheet: false, canSiteVisit: false, isBoss: false, unreadNotifications: 0, ...extra,
});
const jobNumbers = async (k: string) => (await asUser(db, k).query<{ job_number: string }>("select job_number from jobs order by job_number")).map((r) => r.job_number);
const photo = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#889" } }).jpeg().toBuffer();
const signature = () =>
  sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg width="300" height="100"><path d="M10 80 C 60 10, 120 90, 290 30" stroke="black" stroke-width="5" fill="none"/></svg>'), top: 0, left: 0 }])
    .png().toBuffer();

/** The boss creates a login, as the app does: auth user first, then the profile through the database function. */
async function bossAdds(boss: string, name: string) {
  const id = randomUUID();
  await system(db)("insert into auth.users (id, email) values ($1, $2)", [id, `${name.toLowerCase().replace(/\W/g, ".")}@test.example`]);
  await asUser(db, boss).query("select public.boss_add_operative($1, $2, $3, null, 'Netting & deck')", [id, name, `${name.toLowerCase().replace(/\W/g, ".")}@test.example`]);
  return id;
}
const as = (id: string) => ({
  query: <T,>(sql: string, params: unknown[] = []) => import("@/server/db").then(({ withUser }) => withUser(id, async (tx) => (await tx.query<T>(sql, params)).rows)),
});

describe("a subcontractor boss runs their own people", () => {
  let newLad = "";

  it("adds a lad to their own company only; MSW's administrator is told", async () => {
    newLad = await bossAdds("dave", "New Lad");
    const [p] = await system(db)<{ company: string; role: string }>(
      "select c.name as company, p.role::text from profiles p join companies c on c.id = p.company_id where p.id = $1", [newLad]);
    expect(p).toEqual({ company: "Derby Decking", role: "operative" });
    const alerts = await asUser(db, "claire").query<{ title: string }>("select title from notifications where kind = 'person.added'");
    expect(alerts.map((a) => a.title)).toContain("Derby Decking added New Lad");
    // An operative can't add people.
    await expect(asUser(db, "john").query("select public.boss_add_operative($1, 'X Y', 'xy@test.example', null, null)", [randomUUID()]))
      .rejects.toMatchObject({ code: "42501" });
    // The boss sees their own people, never another company's.
    const seen = (await asUser(db, "dave").query<{ full_name: string }>("select full_name from profiles")).map((r) => r.full_name);
    expect(seen).toContain("New Lad");
    expect(seen).not.toContain("Liam Turner");
  });

  it("a new lad sees nothing until the boss ticks them on a job; then the whole job, all drawings", async () => {
    expect(await as(newLad).query("select id from jobs")).toHaveLength(0);
    await asUser(db, "dave").query("select public.boss_set_job_access($1, $2, true)", [ids.job("bm"), newLad]);
    expect((await as(newLad).query<{ job_number: string }>("select job_number from jobs")).map((r) => r.job_number)).toEqual(["MSW-2611"]);
    const officeDocs = (await asUser(db, "claire").query("select id from documents where job_id = $1 and kind = 'drawing'", [ids.job("bm")])).length;
    const ladDocs = (await as(newLad).query("select id from documents where job_id = $1 and kind = 'drawing'", [ids.job("bm")])).length;
    expect(ladDocs).toBe(officeDocs);
    const alerts = await asUser(db, "claire").query<{ title: string }>("select title from notifications where kind = 'company.allocation'");
    expect(alerts.map((a) => a.title)).toContain("Derby Decking put New Lad on MSW-2611");
    // Untick: gone straight away.
    await asUser(db, "dave").query("select public.boss_set_job_access($1, $2, false)", [ids.job("bm"), newLad]);
    expect(await as(newLad).query("select id from jobs")).toHaveLength(0);
  });

  it("a boss can't tick another company's lad, or onto a job their company doesn't have", async () => {
    await expect(asUser(db, "dave").query("select public.boss_set_job_access($1, $2, true)", [ids.job("bm"), ids.user("liam")]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "dave").query("select public.boss_set_job_access($1, $2, true)", [ids.job("northgate"), newLad]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(asUser(db, "john").query("select public.boss_set_job_access($1, $2, true)", [ids.job("bm"), newLad]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("switching a lad off cuts them off every job at once", async () => {
    await asUser(db, "dave").query("select public.boss_set_job_access($1, $2, true)", [ids.job("riverside"), newLad]);
    expect(await as(newLad).query("select id from jobs")).toHaveLength(1);
    await asUser(db, "dave").query("select public.boss_update_operative($1, 'New Lad', null, null, false)", [newLad]);
    expect(await as(newLad).query("select id from jobs")).toHaveLength(0);
    await expect(asUser(db, "dave").query("select public.boss_update_operative($1, 'Liam', null, null, false)", [ids.user("liam")]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("cards: the boss files them; the lad, the boss and the office see them; nobody else", async () => {
    const card = await uploadCard(viewer("dave"), { userId: ids.user("john"), cardType: "CSCS card", cardNumber: "123456", expiresOn: "2027-03-31" },
      { name: "cscs.jpg", bytes: await photo() });
    await expect(uploadCard(viewer("sarah"), { userId: ids.user("john"), cardType: "CSCS card", cardNumber: null, expiresOn: null },
      { name: "x.jpg", bytes: await photo() })).rejects.toBeTruthy();
    await expect(uploadCard(viewer("mark"), { userId: ids.user("john"), cardType: "CSCS card", cardNumber: null, expiresOn: null },
      { name: "x.jpg", bytes: await photo() })).rejects.toBeTruthy();
    const sees = async (k: string) => (await asUser(db, k).query("select id from operative_cards where id = $1", [card.id])).length;
    expect(await sees("john")).toBe(1);
    expect(await sees("dave")).toBe(1);
    expect(await sees("claire")).toBe(1);
    expect(await sees("mark")).toBe(0); // same gang, not his card
    expect(await sees("sarah")).toBe(0); // another company's boss
    expect((await serveCard(ids.user("john"), card.id, false)).status).toBe(200);
    expect((await serveCard(ids.user("liam"), card.id, false)).status).toBe(404);
    const alerts = await asUser(db, "claire").query<{ title: string }>("select title from notifications where kind = 'card.changed'");
    expect(alerts.map((a) => a.title)).toContain("Derby Decking added CSCS card for John Smith");
  });
});

describe("variations", () => {
  it("raised on site with photos; seen by the office, whoever raised it and their boss — not other gangs", async () => {
    const res = await createVariation(viewer("john"), {
      jobId: ids.job("bm"), areaId: ids.area("bm", "l1"), description: "Extra nets to the new lift shaft void", requestedBy: "Martin Doyle",
      operatives: ["John Smith", "Mark Jones"], operativeName: "John Smith",
      clientName: "Martin Doyle", clientCompany: "Kingsgate Construction Ltd", clientPosition: null, clientEmail: null,
    }, { client: { name: "c.png", bytes: await signature() }, operative: { name: "o.png", bytes: await signature() } },
    [{ bytes: await photo(), caption: "Void at D4" }]);
    const sees = async (k: string) => (await asUser(db, k).query("select id from variations where id = $1", [res.id])).length;
    expect(await sees("john")).toBe(1);
    expect(await sees("dave")).toBe(1);
    expect(await sees("claire")).toBe(1);
    expect(await sees("mark")).toBe(0);
    expect(await sees("liam")).toBe(0);
    expect(await sees("sarah")).toBe(0);
    const v = await getVariation(viewer("dave"), res.id);
    expect(v?.photos).toHaveLength(1);
    expect((await serveHandoverFile(ids.user("dave"), v!.photos[0].id, "variation-photo")).status).toBe(200);
    expect((await serveHandoverFile(ids.user("liam"), v!.photos[0].id, "variation-photo")).status).toBe(404);
    expect((await serveHandoverFile(ids.user("liam"), res.id, "variation-client")).status).toBe(404);
    // A signed variation can't be changed.
    await asUser(db, "john").query("update variations set description = 'changed' where id = $1", [res.id]).catch(() => {});
    const [row] = await system(db)<{ description: string }>("select description from variations where id = $1", [res.id]);
    expect(row.description).toBe("Extra nets to the new lift shaft void");
  });
});

describe("MSW decides which companies have a job", () => {
  it("taking a job off a company cuts off its boss and every one of its lads; other companies carry on", async () => {
    expect(await jobNumbers("john")).toContain("MSW-2611");
    const [jc] = await system(db)<{ id: string }>(
      "select jc.id from job_companies jc join companies c on c.id = jc.company_id where c.name = 'Derby Decking' and jc.job_id = $1 and jc.revoked_at is null", [ids.job("bm")]);
    // Only an administrator can.
    await asUser(db, "sam").query("update job_companies set revoked_at = now() where id = $1", [jc.id]);
    expect(await jobNumbers("john")).toContain("MSW-2611");
    await asUser(db, "claire").query("update job_companies set revoked_at = now(), revoked_by = auth.uid() where id = $1", [jc.id]);
    expect(await jobNumbers("john")).not.toContain("MSW-2611");
    expect(await jobNumbers("mark")).not.toContain("MSW-2611");
    expect(await jobNumbers("dave")).not.toContain("MSW-2611");
    expect(await jobNumbers("dave")).toContain("MSW-2604"); // still has Riverside
    expect(await jobNumbers("liam")).toContain("MSW-2611"); // SOS unaffected
    // Giving it back: the boss sees it again; lads wait to be ticked.
    await asUser(db, "claire").query("insert into job_companies (job_id, company_id, granted_by) select $1, id, auth.uid() from companies where name = 'Derby Decking'", [ids.job("bm")]);
    expect(await jobNumbers("dave")).toContain("MSW-2611");
    expect(await jobNumbers("john")).not.toContain("MSW-2611");
  });
});
