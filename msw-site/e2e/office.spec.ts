import { expect, test } from "@playwright/test";
import { BM, signIn, signOut } from "./helpers";
import { demoId } from "../src/server/seed/demo-data";

test.describe("office workflows", () => {
  test("admin grants Steve access to Level 3 in one action; Steve then sees only Level 3 work", async ({ page }) => {
    await signIn(page, "steve.wilson@abcdecking.example");
    await expect(page.getByText("British Museum")).toHaveCount(0);
    await signOut(page);

    await signIn(page, "claire.morgan@msw.example");
    await page.goto(`/office/jobs/${BM}/access`);
    await page.getByRole("button", { name: "ABC Decking Ltd" }).click();
    await page.getByRole("checkbox", { name: /Steve Wilson/ }).check();
    await page.locator("#grant-form").getByRole("checkbox", { name: "Level 3", exact: true }).check();
    await page.getByLabel(/Note shown to them/).fill("Cover for Gang B");
    await page.getByRole("button", { name: /Give access to 1 person/ }).click();
    await expect(page.getByText("Access saved for 1 person")).toBeVisible();
    await page.goto(`/office/jobs/${BM}/activity?scope=access`);
    await expect(page.getByText("Steve Wilson given access (Level 3)")).toBeVisible();
    await signOut(page);

    await signIn(page, "steve.wilson@abcdecking.example");
    await page.getByRole("link", { name: /British Museum/ }).click();
    await expect(page.getByRole("link", { name: /MSW-2611-DK-103/ })).toBeVisible();
    await expect(page.getByText("MSW-2611-DK-101")).toHaveCount(0);
    await page.goto("/notifications");
    await expect(page.getByText(/You have been added to MSW-2611/)).toBeVisible();
  });

  test("office (non-admin) can view but not change access", async ({ page }) => {
    await signIn(page, "sam.patel@msw.example");
    await page.goto(`/office/jobs/${BM}/access`);
    await expect(page.getByText("Only MSW administrators can change who has access")).toBeVisible();
    await expect(page.getByRole("button", { name: /Give access/ })).toHaveCount(0);
  });

  test("office responds to a site report and resolves it; the operative sees the reply", async ({ page }) => {
    const reportId = demoId("report:bm-hoist");
    await signIn(page, "claire.morgan@msw.example");
    await page.goto(`/office/reports/${reportId}`);
    await page.getByLabel("Respond to site").fill("Engineer has fixed the hoist — carry on.");
    await page.getByLabel("Change status").selectOption("resolved");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Response sent.")).toBeVisible();
    await signOut(page);

    await signIn(page, "liam.turner@northernedge.example");
    await page.goto("/notifications");
    await page.getByRole("button", { name: /MSW replied and marked resolved: Hoist out of service/ }).click();
    await expect(page).toHaveURL(new RegExp(`/reports/${reportId}`));
    await expect(page.getByText("Engineer has fixed the hoist — carry on.")).toBeVisible();
  });

  test("approving a draft drawing issues it to site and supersedes the previous revision", async ({ page }) => {
    await signIn(page, "sam.patel@msw.example");
    await page.goto(`/office/jobs/${BM}/documents/${demoId("doc:bm-dk3")}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Approve for use" }).click();
    await expect(page.getByText("Rev C02 is current on site")).toBeVisible();
    await signOut(page);

    await signIn(page, "liam.turner@northernedge.example");
    await page.goto(`/jobs/${BM}/documents/${demoId("doc:bm-dk3")}`);
    await expect(page.getByText("Rev C02")).toBeVisible();
    const old = await page.request.get(`/api/files/revisions/${demoId("rev:bm-dk3:C01")}`);
    expect(old.status()).toBe(404);
  });

  test("dashboard and job list load for a contracts manager", async ({ page }) => {
    await signIn(page, "claire.morgan@msw.example");
    await expect(page.getByRole("heading", { name: /Good to see you, Claire/ })).toBeVisible();
    await page.goto("/office/jobs?q=riverside");
    await expect(page.getByText("Riverside Quarter Block B")).toBeVisible();
    await expect(page.getByText("British Museum")).toHaveCount(0);
  });

  test("site view is tucked in the account menu, not on the job page; the way back is on the site Account page", async ({ page }) => {
    await signIn(page, "claire.morgan@msw.example");
    await page.goto(`/office/jobs/${BM}`);
    await expect(page.getByRole("link", { name: "Site view" })).toHaveCount(0);
    await page.getByLabel("Account menu").last().click();
    await page.getByRole("link", { name: "Site view" }).last().click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("link", { name: "Office", exact: true })).toHaveCount(0);
    await page.goto("/account");
    await page.getByRole("link", { name: "Back to the office dashboard" }).click();
    await expect(page).toHaveURL(/\/office$/);
  });
});
