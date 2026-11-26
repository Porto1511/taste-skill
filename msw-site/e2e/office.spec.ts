import { expect, test } from "@playwright/test";
import sharp from "sharp";
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
    await signIn(page, "damian.pendleton@msw.example");
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
    await expect(page.getByText(/Jobs · click one/)).toBeVisible();
    await page.getByRole("link", { name: /MSW-2611/ }).filter({ hasText: "British Museum" }).click();
    await expect(page.getByRole("link", { name: "← All jobs" })).toBeVisible();
    await expect(page.getByText(/Daywork by gang/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Derby Decking" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SOS" })).toBeVisible();
    await expect(page.getByText(/Sign-offs \(handovers\)/)).toBeVisible();
    await expect(page.getByText(/Site issues ·/)).toBeVisible();
    await expect(page.getByText("MSW driving")).toHaveCount(0); // driving is for timesheet sign-off, not the QS
    await page.locator("summary").filter({ hasText: "Extra edge trim" }).first().click();
    await expect(page.getByRole("cell", { name: "John Smith" })).toBeVisible();
    const href = await page.getByRole("link", { name: /Export CSV/ }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Extra edge trim");
    // Not for site users.
    await signOut(page);
    await signIn(page, "john.smith@derbydecking.example");
    expect((await page.request.get("/office/qs")).status()).toBe(404);
    expect((await page.request.get(href!)).status()).toBe(404);
  });

  test("only the administrator sees upload and delete; deleting a drawing removes it", async ({ page }) => {
    await signIn(page, "alan.stokoe@msw.example");
    await page.goto(`/office/jobs/${BM}/documents`);
    await expect(page.getByText("Only an MSW administrator can upload or delete drawings and RAMS.")).toBeVisible();
    await expect(page.getByRole("link", { name: /New job/ })).toHaveCount(0);
    await page.goto(`/office/jobs/${BM}/documents/${demoId("doc:bm-dk4")}`);
    await expect(page.getByRole("button", { name: "Delete drawing" })).toHaveCount(0);
    await signOut(page);

    await signIn(page, "damian.pendleton@msw.example");
    await page.goto(`/office/jobs/${BM}/documents/${demoId("doc:bm-dk4")}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete drawing" }).click();
    await expect(page.getByText("Drawing deleted")).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "MSW-2611-DK-104" })).toHaveCount(0);
  });

  test("certificates: the office uploads for a subcontractor; that subcontractor sees only their own", async ({ page }) => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    await signIn(page, "damian.pendleton@msw.example");
    await page.getByRole("link", { name: "Certificates" }).click();
    const sos = page.locator("section").filter({ has: page.getByRole("heading", { name: /^SOS/ }) });
    await sos.getByPlaceholder(/Name, e\.g\./).fill("SOS net certificates 2026");
    await sos.getByLabel("Choose a PDF for SOS").setInputFiles({ name: "sos-nets.pdf", mimeType: "application/pdf", buffer: pdf });
    await sos.getByRole("button", { name: "Upload" }).click();
    await expect(sos.getByText("SOS net certificates 2026")).toBeVisible();
    await signOut(page);

    await signIn(page, "liam.turner@sos.example");
    await page.goto("/certificates");
    await expect(page.getByText("SOS net certificates 2026")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Derby Decking/ })).toHaveCount(0);
    await signOut(page);
    await signIn(page, "john.smith@derbydecking.example");
    await page.goto("/certificates");
    await expect(page.getByText("SOS net certificates 2026")).toHaveCount(0);
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
    test("the office menu is a drop-down with every page and a working Sign out", async ({ page }) => {
      await signIn(page, "pete@msw.example");
      await page.getByRole("button", { name: /Menu/ }).click();
      await page.getByRole("link", { name: "QS check" }).click();
      await expect(page).toHaveURL(/\/office\/qs/);
      await expect(page.locator("#office-menu")).toHaveCount(0); // closes after navigating
      await page.getByRole("button", { name: /Menu/ }).click();
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/login/);
    });

    test("site visit on a phone: checklist, blocker, photo, outcome; then the report", async ({ page }) => {
      await signIn(page, "damian.pendleton@msw.example");
      await page.getByRole("button", { name: /Menu/ }).click();
      await page.getByRole("link", { name: "Site visits" }).click();
      await page.getByRole("link", { name: /New site visit/ }).click();
      await page.getByLabel("Job number").fill("MSW-2611");
      await expect(page.getByLabel("Site address")).toHaveValue(/Great Russell Street/);
      await expect(page.getByLabel("Area 1", { exact: true })).toHaveValue("Level 1"); // floors come from the job
      await page.getByRole("group", { name: "Handrails / edge protection on" }).getByRole("button", { name: "Partial" }).click();
      await page.getByLabel("Handrails / edge protection on note").fill("None on east side of Level 4");
      await page.getByRole("button", { name: "Add blocker" }).click();
      await page.getByLabel("Blocker 1", { exact: true }).fill("No handrails on Level 4 east side");
      // Full-size phone photos (noisy 4000×3000, several MB each): together far over the host's ~6 MB request cap.
      const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#889", noise: { type: "gaussian", mean: 128, sigma: 60 } } }).jpeg({ quality: 95 }).toBuffer();
      expect(big.length).toBeGreaterThan(3_000_000);
      await page.getByLabel("Choose photos").setInputFiles([1, 2, 3, 4].map((n) => ({ name: `site-${n}.jpg`, mimeType: "image/jpeg", buffer: big })));
      await expect(page.locator("img[src^='blob:']")).toHaveCount(4);
      await page.getByRole("group", { name: "Ready to start?" }).getByRole("button", { name: "Yes, if…" }).click();
      await page.getByLabel("Ready if…").fill("Handrails on Level 4");
      await page.getByRole("button", { name: "Save site visit" }).click();
      await expect(page.getByText("No handrails on Level 4 east side")).toBeVisible();
      await expect(page.getByText("Ready if:")).toBeVisible();
      await expect(page.locator("img[src*='/api/files/visit-photos/']")).toHaveCount(4);
      await expect(page.getByText(/didn.t upload/)).toHaveCount(0);
      await page.getByRole("button", { name: /as cleared/ }).click();
      await expect(page.getByRole("button", { name: /as not cleared/ })).toBeVisible();
      const report = await page.request.get(page.url().replace(/\/office\/site-visits\//, "/api/site-visits/") + "/report");
      expect(report.headers()["content-type"]).toBe("application/pdf");
    });

    test("site visits are office only", async ({ page }) => {
      await signIn(page, "gareth.evans@msw.example");
      expect((await page.request.get("/office/site-visits")).status()).toBe(404);
    });

    test("a job's sections are a drop-down and the Sign-offs page fits the screen", async ({ page }) => {
      await signIn(page, "damian.pendleton@msw.example");
      await page.goto(`/office/jobs/${BM}`);
      await page.getByText("Section:").click();
      await page.getByRole("link", { name: "Sign-offs" }).click();
      await expect(page).toHaveURL(/\/handovers$/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });

  test("the administrator gives a job to a subcontractor and can take it off again", async ({ page }) => {
    await signIn(page, "damian.pendleton@msw.example");
    await page.goto(`/office/jobs/${demoId("job:riverside")}/access`);
    await expect(page.getByRole("heading", { name: "Subcontractors on this job" })).toBeVisible();
    await page.getByLabel("Company to give the job to").selectOption({ label: "SOS" });
    await page.getByRole("button", { name: "Give job" }).click();
    await expect(page.getByText("Job given to the company")).toBeVisible();
    const row = page.getByRole("group", { name: "SOS", exact: true });
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Take off job" }).click();
    await expect(row).toHaveCount(0); // SOS no longer holds the job
  });
});
