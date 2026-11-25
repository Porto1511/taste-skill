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
  isMswEmployee: isStaff, isStaff, isAdmin: false, keepsTimesheet: false, canSiteVisit: false, unreadNotifications: 0,
});
const ALL = { from: "2000-01-01", to: "2100-01-01" };

describe("QS check", () => {
  it("totals daywork hours per company", async () => {
    const d = await qsSummary(v("claire", true), ALL);
    const byCo = Object.fromEntries(groupDaywork(d.daywork).map((c) => [c.company, c]));
    expect(byCo["SOS"].hours).toBe(6);
    expect(byCo["Derby Decking"].hours).toBe(7);
    expect(d.daywork.every((l) => l.description.length > 0)).toBe(true); // the reason travels with every line
    expect(d.handovers.map((h) => h.title)).toContain("Level 2 — deck & studs handover");
    expect(d.issues.length).toBeGreaterThan(0);
  });

  it("counts daywork hours on the day they were worked", async () => {
    const [sheet] = await system(db)<{ week_commencing: string }>("select week_commencing::text from dayworks where description like 'Extra edge trim%'");
    const mon = sheet.week_commencing;
    const tue = new Date(`${mon}T12:00:00Z`); tue.setUTCDate(tue.getUTCDate() + 1);
    const derby = async (from: string, to: string) => groupDaywork((await qsSummary(v("claire", true), { from, to })).daywork).find((c) => c.company === "Derby Decking");
    expect((await derby(mon, mon))?.hours).toBe(4);
    expect((await derby(tue.toISOString().slice(0, 10), tue.toISOString().slice(0, 10)))?.hours).toBe(3);
  });

  it("filters by company and job", async () => {
    const [{ id: abc }] = await system(db)<{ id: string }>("select id from companies where name = 'Derby Decking'");
    const d = await qsSummary(v("claire", true), { ...ALL, companyId: abc });
    expect(new Set(d.daywork.map((l) => l.company))).toEqual(new Set(["Derby Decking"]));
    expect(new Set(d.issues.map((i) => i.company))).toEqual(new Set(["Derby Decking"]));
    const other = await qsSummary(v("claire", true), { ...ALL, jobId: ids.job("riverside") });
    expect(other.daywork).toEqual([]);
  });

  it("still runs under the database policies: an operative only sees their own", async () => {
    const paul = await qsSummary(v("paul"), ALL);
    expect(paul.daywork).toEqual([]);
    expect(new Set(paul.issues.map((i) => i.author_name))).toEqual(new Set(["Paul Brown"])); // only his own
    const liam = await qsSummary(v("liam"), ALL);
    expect(new Set(liam.daywork.map((l) => l.company))).toEqual(new Set(["SOS"]));
  });

  it("date presets and parameters", () => {
    expect(qsPresets("2026-11-11")[0]).toEqual({ label: "This week", from: "2026-11-09", to: "2026-11-15" });
    expect(qsPresets("2026-11-11")[3]).toEqual({ label: "Last month", from: "2026-10-01", to: "2026-10-31" });
    expect(parseQsParams({ from: "2026-11-20", to: "2026-11-01", job: "nope" }, "2026-11-11")).toEqual({ from: "2026-11-01", to: "2026-11-20", jobId: undefined, companyId: undefined });
  });
});
