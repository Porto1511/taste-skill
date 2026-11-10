/** QS check: totals by company and date, standing vs extra, and database policies still apply. */
import { beforeAll, describe, expect, it } from "vitest";
import type { Driver } from "@/server/db/types";
import { setDriverForTesting } from "@/server/db";
import { groupDaywork, qsSummary } from "@/server/queries/qs";
import { parseQsParams, qsPresets } from "@/lib/qs";
import type { Viewer } from "@/server/auth/viewer";
import { createSeededDb, ids, system } from "./support/db";

let db: Driver;
beforeAll(async () => { ({ driver: db } = await createSeededDb()); setDriverForTesting(db); });

const v = (key: string, isStaff = false): Viewer => ({
  id: ids.user(key), fullName: key, email: "", role: isStaff ? "office" : "operative", jobTitle: null, companyId: "", companyName: "",
  isMswEmployee: isStaff, isStaff, isAdmin: false, keepsTimesheet: false, unreadNotifications: 0,
});
const ALL = { from: "2000-01-01", to: "2100-01-01" };

describe("QS check", () => {
  it("totals daywork per company, split into standing time and extra work", async () => {
    const d = await qsSummary(v("claire", true), ALL);
    const byCo = Object.fromEntries(groupDaywork(d.daywork).map((c) => [c.company, c]));
    expect(byCo["SOS"]).toMatchObject({ standing: 6, extra: 0 });
    expect(byCo["Derby Decking"]).toMatchObject({ standing: 0, extra: 7 });
    expect(d.deliveries.length).toBeGreaterThan(0);
    expect(d.travel.map((t) => t.full_name)).toContain("Gareth Evans");
  });

  it("counts daywork hours on the day they were worked", async () => {
    const [sheet] = await system(db)<{ week_commencing: string }>("select week_commencing::text from dayworks where kind = 'extra'");
    const mon = sheet.week_commencing;
    const tue = new Date(`${mon}T12:00:00Z`); tue.setUTCDate(tue.getUTCDate() + 1);
    const tueIso = tue.toISOString().slice(0, 10);
    const onlyMon = groupDaywork((await qsSummary(v("claire", true), { from: mon, to: mon })).daywork).find((c) => c.extra > 0);
    const onlyTue = groupDaywork((await qsSummary(v("claire", true), { from: tueIso, to: tueIso })).daywork).find((c) => c.extra > 0);
    expect(onlyMon?.extra).toBe(4);
    expect(onlyTue?.extra).toBe(3);
  });

  it("filters by company and job", async () => {
    const [{ id: abc }] = await system(db)<{ id: string }>("select id from companies where name = 'Derby Decking'");
    const d = await qsSummary(v("claire", true), { ...ALL, companyId: abc });
    expect(new Set(d.daywork.map((l) => l.company))).toEqual(new Set(["Derby Decking"]));
    expect(d.travel).toEqual([]); // MSW travel isn't Derby Decking's
    const other = await qsSummary(v("claire", true), { ...ALL, jobId: ids.job("riverside") });
    expect(other.daywork).toEqual([]);
  });

  it("still runs under the database policies: an operative only sees their own", async () => {
    const paul = await qsSummary(v("paul"), ALL);
    expect(paul.daywork).toEqual([]);
    expect(paul.deliveries).toEqual([]);
    const liam = await qsSummary(v("liam"), ALL);
    expect(new Set(liam.daywork.map((l) => l.company))).toEqual(new Set(["SOS"]));
  });

  it("daywork must be standing time or extra work", async () => {
    await expect(system(db)("update dayworks set kind = 'other'")).rejects.toMatchObject({ code: "23514" });
  });

  it("date presets and parameters", () => {
    expect(qsPresets("2026-11-11")[0]).toEqual({ label: "This week", from: "2026-11-09", to: "2026-11-15" });
    expect(qsPresets("2026-11-11")[3]).toEqual({ label: "Last month", from: "2026-10-01", to: "2026-10-31" });
    expect(parseQsParams({ from: "2026-11-20", to: "2026-11-01", job: "nope" }, "2026-11-11")).toEqual({ from: "2026-11-01", to: "2026-11-20", jobId: undefined, companyId: undefined });
  });
});
