import { expect, test } from "@playwright/test";
import { BM, signIn, signOut } from "./helpers";
import { demoId } from "../src/server/seed/demo-data";

test.describe("office workflows", () => {
  test("admin grants Steve access to Level 3 in one action; Steve then sees only Level 3 work", async ({ page }) => {
    await signIn(page, "steve.wilson@derbydecking.example");
    await expect(page.getByText("British Museum")).toHaveCount(0);
    await signOut(page);

    await signIn(page, "damian.pendleton@msw.example");
    await page.goto(`/office/jobs/${BM}/access`);
    await page.getByRole("button", { name: "Derby Decking" }).click();
    await page.getByRole("checkbox", { name: /Steve Wilson/ }).check();
    await page.locator("#grant-form").getByRole("checkbox", { name: "Level 3", exact: true }).check();
    await page.getByLabel(/Note shown to them/).fill("Cover for Gang B");
    await page.getByRole("button", { name: /Give access to 1 person/ }).click();
    await expect(page.getByText("Access saved for 1 person")).toBeVisible();
    await page.goto(`/office/jobs/${BM}/activity?scope=access`);
    await expect(page.getByText("Steve Wilson given access (Level 3)")).toBeVisible();
    await signOut(page);

    await signIn(page, "steve.wilson@derbydecking.example");
    await page.getByRole("link", { name: /British Museum/ }).click();
    await expect(page.getByRole("link", { name: /MSW-2611-DK-103/ })).toBeVisible();
    await expect(page.getByText("MSW-2611-DK-101")).toHaveCount(0);
    await page.goto("/notifications");
    await expect(page.getByText(/You have been added to MSW-2611/)).toBeVisible();
  });

  test("office (non-admin) can view but not change access", async ({ page }) => {
    await signIn(page, "alan.stokoe@msw.example");
    await page.goto(`/office/jobs/${BM}/access`);
    await expect(page.getByText("Only MSW administrators can change who has access")).toBeVisible();
    await expect(page.getByRole("button", { name: /Give access/ })).toHaveCount(0);
  });

  test("office responds to a site report and resolves it; the operative sees the reply", async ({ page }) => {
    const reportId = demoId("report:bm-hoist");
    await signIn(page, "damian.pendleton@msw.example");
    await page.goto(`/office/reports/${reportId}`);
    await page.getByLabel("Respond to site").fill("Engineer has fixed the hoist — carry on.");
    await page.getByLabel("Change status").selectOption("resolved");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Response sent.")).toBeVisible();
    await signOut(page);

    await signIn(page, "liam.turner@sos.example");
    await page.goto("/notifications");
    await page.getByRole("button", { name: /MSW replied and marked resolved: Hoist out of service/ }).click();
    await expect(page).toHaveURL(new RegExp(`/reports/${reportId}`));
    await expect(page.getByText("Engineer has fixed the hoist — carry on.")).toBeVisible();
  });

  test("approving a draft drawing issues it to site and supersedes the previous revision", async ({ page }) => {
    await signIn(page, "alan.stokoe@msw.example");
    await page.goto(`/office/jobs/${BM}/documents/${demoId("doc:bm-dk3")}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Approve for use" }).click();
    await expect(page.getByText("Rev C02 is current on site")).toBeVisible();
    await signOut(page);

    await signIn(page, "liam.turner@sos.example");
    await page.goto(`/jobs/${BM}/documents/${demoId("doc:bm-dk3")}`);
    await expect(page.getByText("Rev C02")).toBeVisible();
    const old = await page.request.get(`/api/files/revisions/${demoId("rev:bm-dk3:C01")}`);
    expect(old.status()).toBe(404);
  });

  test("dashboard and job list load for a contracts manager", async ({ page }) => {
    await signIn(page, "damian.pendleton@msw.example");
    await expect(page.getByRole("heading", { name: /Good to see you, Damian/ })).toBeVisible();
    await page.goto("/office/jobs?q=riverside");
    await expect(page.getByText("Riverside Quarter Block B")).toBeVisible();
    await expect(page.getByText("British Museum")).toHaveCount(0);
  });

  test("site view is tucked in the account menu, not on the job page; the way back is on the site Account page", async ({ page }) => {
    await signIn(page, "damian.pendleton@msw.example");
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

  test("drop several PDFs: details come from the file names; a known number becomes its next revision", async ({ page }) => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    await signIn(page, "damian.pendleton@msw.example");
    await page.goto(`/office/jobs/${BM}/documents`);
    await page.getByLabel("Choose PDFs").setInputFiles([
      { name: "MSW-2611-DK-105_C01_Level 2 Deck Infill.pdf", mimeType: "application/pdf", buffer: pdf },
      { name: "MSW-2611-DK-101 C03.pdf", mimeType: "application/pdf", buffer: pdf },
    ]);
    const rows = page.locator("li").filter({ has: page.getByLabel("Revision") });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByLabel("Number")).toHaveValue("MSW-2611-DK-105");
    await expect(rows.nth(0).getByLabel("Title")).toHaveValue("Level 2 Deck Infill");
    await expect(rows.nth(0).getByLabel("Area")).toHaveValue(await rows.nth(0).getByLabel("Area").locator("option", { hasText: "Level 2" }).getAttribute("value") as string);
    await expect(rows.nth(1).getByText("New revision · was C02")).toBeVisible();
    await expect(rows.nth(1).getByLabel("Revision")).toHaveValue("C03");
    await page.getByRole("button", { name: "Upload 2 files" }).click();
    await expect(page.getByLabel("Uploaded")).toHaveCount(2);
    await page.reload();
    await expect(page.getByText("MSW-2611-DK-105")).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "MSW-2611-DK-101" })).toContainText("Rev C03 current");
  });

  test("Pete (QS) sees sign-offs, daywork hours by company and site issues, and can export them", async ({ page }) => {
    await signIn(page, "pete@msw.example");
    await page.getByRole("link", { name: "QS check" }).click();
    await page.getByRole("link", { name: "This month" }).click();
    await expect(page.getByRole("heading", { name: "Derby Decking" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SOS" })).toBeVisible();
    await expect(page.getByText(/Sign-offs \(handovers\)/)).toBeVisible();
    await expect(page.getByText(/Site issues ·/)).toBeVisible();
    await expect(page.getByText("MSW driving")).toHaveCount(0); // driving is for timesheet sign-off, not the QS
    await page.locator("summary").filter({ hasText: "Extra work" }).first().click();
    await expect(page.getByRole("cell", { name: "John Smith" })).toBeVisible();
    const href = await page.getByRole("link", { name: /Export CSV/ }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Extra work");
    // Not for site users.
    await signOut(page);
    await signIn(page, "john.smith@derbydecking.example");
    expect((await page.request.get("/office/qs")).status()).toBe(404);
    expect((await page.request.get(href!)).status()).toBe(404);
  });
});
