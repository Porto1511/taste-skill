import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { BM, signIn, signOut } from "./helpers";
import { demoId } from "../src/server/seed/demo-data";

test.describe("operative mobile experience", () => {
  test("John sees only his allocated job and only Level 1–2 drawings", async ({ page }) => {
    await signIn(page, "john.smith@abcdecking.example");
    await expect(page.getByRole("heading", { name: "Your jobs" })).toBeVisible();
    const cards = page.locator('a[href^="/jobs/"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("British Museum");
    await expect(cards.first()).toContainText("Level 1");
    await expect(cards.first()).toContainText("Level 2");

    await cards.first().click();
    await expect(page.getByText("Your area")).toBeVisible();
    await expect(page.getByRole("link", { name: /MSW-2611-DK-101/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /MSW-2611-DK-102/ })).toBeVisible();
    await expect(page.getByText("MSW-2611-DK-103")).toHaveCount(0);
    await expect(page.getByText("MSW-2611-SN-201")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Call site/ })).toHaveAttribute("href", "tel:+447700900201");

    // Filter chips narrow the drawing list to one floor.
    await page.getByRole("group", { name: /Filter drawings/ }).getByRole("button", { name: "Level 2" }).click();
    await expect(page.getByRole("link", { name: /MSW-2611-DK-101/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /MSW-2611-DK-102/ })).toBeVisible();
  });

  test("the PDF viewer renders the current approved revision", async ({ page }) => {
    await signIn(page, "john.smith@abcdecking.example");
    await page.goto(`/jobs/${BM}/documents/${demoId("doc:bm-dk1")}`);
    await expect(page.getByText("Rev C02")).toBeVisible();
    const canvas = page.locator('[data-page="1"] canvas').first();
    await expect(canvas).toBeVisible();
    await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 20_000 }).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText(/^\d+%$/)).not.toHaveText("100%");
  });

  test("John reports an issue with a photo; the office is notified", async ({ page }) => {
    await signIn(page, "john.smith@abcdecking.example");
    await page.goto(`/jobs/${BM}/report?kind=issue`);
    await page.getByRole("button", { name: "Materials problem" }).click();
    await page.getByLabel("Where?").selectOption({ label: "Level 1" });
    await page.getByLabel("Short title").fill("E2E: dented sheets in bundle 12");
    await page.getByLabel("Details").fill("Six sheets dented on delivery.");
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#999" } }).jpeg().toBuffer();
    await page.locator('input[type="file"][multiple]').setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByPlaceholder("Caption for photo 1 (optional)")).toBeVisible();
    await page.getByRole("button", { name: "Send to MSW office" }).click();
    await expect(page.getByText("Sent to the MSW office")).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E: dented sheets in bundle 12" })).toBeVisible();
    await expect(page.locator('img[src^="/api/files/photos/"]')).toHaveCount(1);
  });

  test("safety categories prompt an immediate phone call", async ({ page }) => {
    await signIn(page, "liam.turner@northernedge.example");
    await page.goto(`/jobs/${BM}/report?kind=issue`);
    await page.getByRole("button", { name: "Safety concern" }).click();
    await expect(page.getByText("Is anyone at risk right now?")).toBeVisible();
    await expect(page.getByRole("link", { name: /Call Martin Doyle/ })).toHaveAttribute("href", "tel:+447700900201");
  });

  test("Paul (same company, not allocated) cannot reach the job, its drawings or its files", async ({ page, request }) => {
    await signIn(page, "paul.brown@abcdecking.example");
    await expect(page.locator('a[href^="/jobs/"]')).toHaveCount(1);
    await expect(page.getByText("British Museum")).toHaveCount(0);

    const job = await page.goto(`/jobs/${BM}`);
    expect(job?.status()).toBe(404);
    const viewer = await page.goto(`/jobs/${BM}/documents/${demoId("doc:bm-dk1")}`);
    expect(viewer?.status()).toBe(404);
    const file = await page.request.get(`/api/files/revisions/${demoId("rev:bm-dk1:C02")}?download=1`);
    expect(file.status()).toBe(404);
    const office = await page.goto("/office");
    expect(office?.status()).toBe(404);

    // Logged-out requests get nothing either.
    await signOut(page);
    const anon = await request.get(`/api/files/revisions/${demoId("rev:bm-dk1:C02")}`);
    expect(anon.status()).toBe(404);
  });

  test("John gets a handover signed by the contractor on his phone; the office gets a certificate", async ({ page }) => {
    await signIn(page, "john.smith@abcdecking.example");
    await page.goto(`/jobs/${BM}`);
    await page.getByRole("link", { name: /Handover/ }).first().click();
    await page.getByLabel("Area", { exact: true }).selectOption({ label: "Level 1" });
    await page.getByLabel("What's being handed over").fill("E2E: Level 1 bays A1–D3");
    await page.getByRole("button", { name: "Metal deck laid and fixed to current drawings", exact: true }).click();
    await page.getByRole("button", { name: /Next: contractor signs/ }).click();
    await expect(page.getByText("Hand the phone to the site manager")).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("Martin Doyle");
    const pad = page.getByLabel(/Signature box/);
    await pad.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 120);
    await page.mouse.down();
    for (const [dx, dy] of [[60, 40], [110, 100], [160, 50], [220, 110], [280, 60]]) await page.mouse.move(box.x + dx, box.y + dy, { steps: 6 });
    await page.mouse.up();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign & submit" }).click();
    await expect(page.getByText("Handover signed and sent to the MSW office")).toBeVisible();
    await expect(page.getByAltText(/Signature of Martin Doyle/)).toBeVisible();
    const href = await page.getByRole("link", { name: /Handover certificate/ }).getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("an MSW operative logs today's timesheet; subcontractors have no timesheet", async ({ page }) => {
    await signIn(page, "gareth.evans@msw.example");
    await page.getByRole("link", { name: "Timesheet" }).click();
    await page.locator('a[href^="/timesheet/"]').filter({ hasText: "Nothing logged" }).last().click();
    await page.getByLabel("Vehicle reg").fill("MS21 NET");
    const times = page.locator('input[type="time"]');
    for (const [i, t] of ["06:00", "07:10", "07:30", "16:30", "16:30", "17:40"].entries()) await times.nth(i).fill(t);
    await expect(page.getByText("2h 20m").first()).toBeVisible();
    await page.getByRole("button", { name: "Netting", exact: true }).click();
    await page.getByLabel("Details of work done").fill("E2E: nets Level 3");
    await page.getByRole("button", { name: "Save this job" }).click();
    await expect(page.getByText("Saved and sent to the office")).toBeVisible();
    // Second job the same day
    await page.getByRole("link", { name: "Add another job" }).click();
    await page.locator("#jobId").selectOption("other");
    await page.getByLabel("Where / what").fill("Yard");
    const t2 = page.locator('input[type="time"]');
    for (const [i, t] of ["16:30", "17:00", "17:00", "18:00"].entries()) await t2.nth(i).fill(t);
    await page.getByRole("button", { name: "Other", exact: true }).click();
    await page.getByRole("button", { name: "Save this job" }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);
    await expect(page.getByText("E2E: nets Level 3")).toBeVisible();
    await signOut(page);
    await signIn(page, "john.smith@abcdecking.example");
    await expect(page.getByRole("link", { name: "Timesheet" })).toHaveCount(0);
    expect((await page.goto("/timesheet"))?.status()).toBe(404);
  });
});
