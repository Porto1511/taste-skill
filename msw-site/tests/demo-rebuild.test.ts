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
