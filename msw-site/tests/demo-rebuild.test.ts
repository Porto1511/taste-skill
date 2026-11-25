import { expect, it } from "vitest";
import { seedOrRebuildDemo } from "@/server/seed/rebuild";
import { localAuthUserFactory } from "@/server/seed/local-auth";
import { DEMO_PASSWORD } from "@/server/seed/demo-data";
import { createSeededDb, system } from "./support/db";

it("rebuilds an older demo once, then leaves it alone", async () => {
  const { driver, store } = await createSeededDb();
  await system(driver)("update companies set name = 'Old Name Ltd' where name = 'SOS'");
  expect(await seedOrRebuildDemo(driver, store, localAuthUserFactory(driver), DEMO_PASSWORD)).toBe("rebuilt");
  const names = (await system(driver)<{ name: string }>("select name from companies")).map((r) => r.name);
  expect(names).toContain("SOS");
  expect(names).not.toContain("Old Name Ltd");
  expect(await seedOrRebuildDemo(driver, store, localAuthUserFactory(driver), DEMO_PASSWORD)).toBe("current");
}, 60_000);

it("Ian is set up with site visits, and the patch is safe to run again", async () => {
  const { patchDemoIan } = await import("@/server/seed/seed");
  const { driver } = await createSeededDb();
  await patchDemoIan(driver, localAuthUserFactory(driver), DEMO_PASSWORD);
  await patchDemoIan(driver, localAuthUserFactory(driver), DEMO_PASSWORD);
  const rows = await system(driver)<{ full_name: string; site_visits: boolean; role: string }>("select full_name, site_visits, role from profiles where email = 'ian.spencer@msw.example'");
  expect(rows).toEqual([{ full_name: "Ian Spencer", site_visits: true, role: "operative" }]);
}, 60_000);
