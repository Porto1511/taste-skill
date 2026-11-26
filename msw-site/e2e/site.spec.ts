import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { BM, signIn, signOut } from "./helpers";
import { demoId } from "../src/server/seed/demo-data";

test.describe("operative mobile experience", () => {
  test("John sees only his allocated job and only Level 1–2 drawings", async ({ page }) => {
    await signIn(page, "john.smith@derbydecking.example");
    await expect(page.getByRole("heading", { name: "Your jobs" })).toBeVisible();
    const cards = page.locator('a[href^="/jobs/"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("British Museum");
    await expect(cards.first()).toContainText("Level 1");
    await expect(cards.first()).toContainText("Level 2");
    await expect(page.getByRole("link", { name: "Office", exact: true })).toHaveCount(0);
    await page.goto("/account");
    await expect(page.getByRole("link", { name: /office dashboard/ })).toHaveCount(0);
    expect((await page.request.get("/office")).status()).toBe(404);
    await page.goto("/jobs");

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
    await signIn(page, "john.smith@derbydecking.example");
    await page.goto(`/jobs/${BM}/documents/${demoId("doc:bm-dk1")}`);
    await expect(page.getByText("Rev C02")).toBeVisible();
    const canvas = page.locator('[data-page="1"] canvas').first();
    await expect(canvas).toBeVisible();
    await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 20_000 }).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(page.getByText(/^\d+%$/)).not.toHaveText("100%");
  });

  test("John reports an issue with a photo; the office is notified", async ({ page }) => {
    await signIn(page, "john.smith@derbydecking.example");
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
    await signIn(page, "liam.turner@sos.example");
    await page.goto(`/jobs/${BM}/report?kind=issue`);
    await page.getByRole("button", { name: "Safety concern" }).click();
    await expect(page.getByText("Is anyone at risk right now?")).toBeVisible();
    await expect(page.getByRole("link", { name: /Call Martin Doyle/ })).toHaveAttribute("href", "tel:+447700900201");
  });

  test("Paul (same company, not allocated) cannot reach the job, its drawings or its files", async ({ page, request }) => {
    await signIn(page, "paul.brown@derbydecking.example");
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

  test("John hands over Level 1 nets: certificate fields, MSW signs, client signs, both copies", async ({ page }) => {
    await signIn(page, "john.smith@derbydecking.example");
    await page.goto(`/jobs/${BM}`);
    await page.getByRole("link", { name: /Handover/ }).first().click();
    await page.getByLabel("Area", { exact: true }).selectOption({ label: "Level 1" });
    await page.getByRole("button", { name: "Nets", exact: true }).click();
    await expect(page.getByLabel("Gridlines / Level")).toHaveValue("Level 1");
    await page.getByLabel("Serial numbers of nets used").fill("N1 4471, N2 4472");
    await expect(page.getByText("Openings and voids")).toHaveCount(0);
    await page.getByRole("button", { name: /Next: MSW signs/ }).click();
    await draw(page, 0);
    await page.getByRole("button", { name: /Next: client signs/ }).click();
    await expect(page.getByText("Hand the phone to the client")).toBeVisible();
    await expect(page.getByLabel("Print name")).toHaveValue("Martin Doyle");
    await draw(page, 0);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign & submit" }).click();
    await expect(page.getByText(/Signed — the MSW copy is saved/)).toBeVisible();
    await expect(page.getByAltText(/Signature of Martin Doyle/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send copy to client" })).toBeVisible();
    const href = await page.getByRole("link", { name: /Open PDF/ }).getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    await page.goto(`/jobs/${BM}#reports`);
    await expect(page.getByLabel("Nets handed over").first()).toBeVisible();
  });

  test("Gareth records a delivery and the receiver signs for it", async ({ page }) => {
    await signIn(page, "gareth.evans@msw.example");
    await page.goto(`/jobs/${BM}#reports`);
    await page.getByRole("link", { name: "Delivery note" }).click();
    await expect(page.getByText("MSW-2611").first()).toBeVisible();
    await page.getByLabel("Item 1").fill("MD60 deck sheets");
    await page.getByLabel("Quantity 1").fill("40");
    await expect(page.getByLabel("Delivered by")).toHaveValue("Gareth Evans");
    await page.getByRole("button", { name: /Next: driver signs/ }).click();
    await draw(page, 0);
    await page.getByRole("button", { name: /Next: receiver signs/ }).click();
    await expect(page.getByText("Hand the phone to the person receiving the delivery")).toBeVisible();
    await page.getByLabel(/Received by — print name/).fill("Martin Doyle");
    await draw(page, 0);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign & submit" }).click();
    await expect(page.getByText(/Signed — the MSW copy is saved/)).toBeVisible();
    await expect(page.getByText("MD60 deck sheets")).toBeVisible();
    await expect(page.getByText(/Delivered by Gareth Evans/)).toBeVisible();
    const pdf = await page.request.get(await page.getByRole("link", { name: /Open PDF/ }).getAttribute("href") as string);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("a daywork sheet starts with four rows; spare rows are left blank", async ({ page }) => {
    await signIn(page, "john.smith@derbydecking.example");
    await page.goto(`/jobs/${BM}/daywork`);
    for (const n of [1, 2, 3, 4]) await expect(page.getByLabel(`Name ${n}`)).toBeVisible();
    await expect(page.getByLabel("Name 1")).toHaveValue("John Smith");
    await page.getByLabel("Person 1 hours Tuesday").or(page.getByLabel("John Smith hours Tuesday")).fill("3");
    await page.getByLabel("Name 2").fill("Mark Jones");
    await page.getByRole("button", { name: /Next: MSW signs/ }).click();
    await expect(page.getByText("Enter the hours for Mark Jones, or clear their name.")).toBeVisible();
    await page.getByLabel("Mark Jones hours Tuesday").fill("3");
    await page.getByLabel(/What.s it for/).fill("Waiting for the crane");
    await page.getByRole("button", { name: "yes", exact: true }).click();
    await page.getByRole("button", { name: /Next: MSW signs/ }).click();
    await draw(page, 0);
    await page.getByRole("button", { name: /Next: client signs/ }).click();
    await expect(page.getByText("Hand the phone to the client")).toBeVisible();
    await page.getByLabel(/Client — print name/).fill("Martin Doyle");
    await draw(page, 0);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign & submit" }).click();
    await expect(page.getByText(/Signed — the MSW copy is saved/)).toBeVisible();
    await expect(page.getByText("Mark Jones")).toBeVisible();
  });

  test("deliveries are for MSW's own lads: job typed in from the Deliveries button; subcontractors don't get them", async ({ page }) => {
    await signIn(page, "chris.dawson@msw.example"); // MSW, not allocated to the British Museum job
    await page.getByRole("link", { name: "Deliveries" }).click();
    await page.getByRole("link", { name: /New delivery/ }).click();
    // Typed in, not picked: a job number we know fills in the address…
    await page.getByLabel("Job number").fill("MSW-2611");
    await expect(page.getByLabel("Delivery address")).toHaveValue(/Great Russell Street/);
    // …and one we don't is fine too.
    await page.getByLabel("Job number").fill("NEW-0101");
    await page.getByLabel("Delivery address").fill("Plot 4, Station Road, Derby");
    await page.getByLabel("Item 1").fill("Edge trim 150 mm x 3 m");
    await page.getByRole("button", { name: /Next: driver signs/ }).click();
    await expect(page.getByText("NEW-0101").first()).toBeVisible();
    await signOut(page);

    await signIn(page, "john.smith@derbydecking.example");
    await expect(page.getByRole("link", { name: "Deliveries" })).toHaveCount(0);
    await page.goto(`/jobs/${BM}#reports`);
    await expect(page.getByRole("link", { name: "Daywork sheet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Delivery note" })).toHaveCount(0);
    expect((await page.request.get("/deliveries/new")).status()).toBe(404);
  });

  test("Ian (MSW lad with site visits) has timesheet, deliveries and site visits on his phone", async ({ page }) => {
    await signIn(page, "ian.spencer@msw.example");
    await expect(page.getByRole("link", { name: "Timesheet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Deliveries" })).toBeVisible();
    await expect(page.getByText("British Museum").first()).toBeVisible();
    await page.getByRole("link", { name: "Site visits" }).click();
    await page.getByRole("link", { name: /New site visit/ }).click();
    await page.getByLabel("Job number").fill("MSW-2611");
    await expect(page.getByLabel("Site address")).toHaveValue(/Great Russell Street/);
    await page.getByRole("group", { name: "Ready to start?" }).getByRole("button", { name: "Not yet" }).click();
    await page.getByRole("button", { name: "Save site visit" }).click();
    await expect(page).toHaveURL(/\/site-visits\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/by Ian Spencer/)).toBeVisible();
    expect((await page.request.get("/office")).status()).toBe(404); // still not an office login
  });

  test("an MSW operative logs today's timesheet; subcontractors have no timesheet", async ({ page }) => {
    await signIn(page, "gareth.evans@msw.example");
    await page.getByRole("link", { name: "Timesheet" }).click();
    await page.locator('a[href^="/timesheet/"]').filter({ hasText: "Nothing logged" }).last().click();
    await expect(page.getByRole("checkbox", { name: /Premium time/ })).toBeVisible();
    await page.getByRole("button", { name: "Netting", exact: true }).click();
    await page.getByLabel("Details of work done").fill("E2E: nets Level 3");
    await expect(page.getByRole("button", { name: /No travel/ })).toHaveCount(0);
    await page.getByLabel("Vehicle reg").fill("MS21 NET");
    await page.getByLabel("Set off").fill("06:00");
    await page.getByLabel("Arrived on site").fill("07:10");
    await page.getByLabel("Left site").fill("12:00");
    await expect(page.getByText("4h 50m")).toBeVisible(); // on site, worked out
    await page.getByRole("button", { name: "Save this job" }).click();
    await expect(page.getByText("Saved and sent to the office")).toBeVisible();
    // Second job the same day, as a passenger
    await page.getByRole("link", { name: "Add another job" }).click();
    await expect(page.getByLabel("Set off")).toHaveValue("12:00");
    await page.locator("#jobId").selectOption("other");
    await page.getByLabel("Where").fill("Delivery to yard");
    await page.getByRole("button", { name: "Delivery", exact: true }).click();
    await page.getByRole("button", { name: /Passenger/ }).click();
    await page.getByLabel("Who was driving?").fill("Luke Bennett");
    await page.getByLabel("Arrived on site").fill("12:40");
    await page.getByLabel("Left site").fill("15:00");
    await page.getByLabel("Got back").fill("15:30");
    await page.getByRole("button", { name: "Save this job" }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);
    await expect(page.getByText("Passenger with Luke Bennett")).toBeVisible();
    await signOut(page);
    await signIn(page, "john.smith@derbydecking.example");
    await expect(page.getByRole("link", { name: "Timesheet" })).toHaveCount(0);
    expect((await page.goto("/timesheet"))?.status()).toBe(404);
  });

  test("a boss adds a lad, files his CSCS card and ticks him onto a job; the lad then sees only that", async ({ page }) => {
    await signIn(page, "dave.clarke@derbydecking.example");
    await page.getByRole("link", { name: "Company" }).click();
    await expect(page.getByRole("heading", { name: "Derby Decking" })).toBeVisible();
    await page.getByRole("link", { name: /Add a person/ }).click();
    await page.getByLabel("Name").fill("Sam Fisher");
    await page.getByLabel("Email").fill("sam.fisher@derbydecking.example");
    await page.getByLabel("Password", { exact: true }).fill("Netting-2026!");
    await page.getByRole("button", { name: "Add to my company" }).click();
    await expect(page.getByText("Sam Fisher has been added")).toBeVisible();

    await page.getByLabel("What is it?").fill("CSCS card");
    await page.getByLabel("Expiry date").fill("2027-01-31");
    const card = await sharp({ create: { width: 900, height: 560, channels: 3, background: "#2b6" } }).jpeg().toBuffer();
    await page.getByLabel("Photo of the card", { exact: true }).setInputFiles({ name: "cscs.jpg", mimeType: "image/jpeg", buffer: card });
    await page.getByRole("button", { name: "Save card" }).click();
    await expect(page.getByText(/Expires 31 Jan 2027/)).toBeVisible();

    const tick = page.getByRole("switch", { name: /MSW-2611/ });
    await expect(tick).toHaveAttribute("aria-checked", "false");
    await tick.click();
    await expect(tick).toHaveAttribute("aria-checked", "true");
    await signOut(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill("sam.fisher@derbydecking.example");
    await page.getByLabel("Password").fill("Netting-2026!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator('a[href^="/jobs/"]')).toHaveCount(1);
    await expect(page.locator('a[href^="/jobs/"]').first()).toContainText("British Museum");
    await expect(page.getByRole("link", { name: "Company" })).toHaveCount(0); // lads don't get the boss pages
    expect((await page.request.get("/company")).status()).toBe(404);
    await page.goto("/account/cards");
    await expect(page.getByText("CSCS card")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send or print/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove/ })).toHaveCount(0);
  });

  test("variation: what was asked, a photo, the operative signs, then the client", async ({ page }) => {
    await signIn(page, "john.smith@derbydecking.example");
    await page.goto(`/jobs/${BM}#reports`);
    await page.getByRole("link", { name: "Variation" }).click();
    await page.getByLabel("Where?").selectOption({ label: "Level 1" });
    await page.getByLabel("What has the client asked for?").fill("Extra nets to the new lift shaft void at D4");
    await expect(page.getByLabel("Operative 1")).toHaveValue("John Smith");
    await page.getByLabel("Operative 2").fill("Mark Jones");
    const ph = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#889" } }).jpeg().toBuffer();
    await page.getByLabel("Choose photos").setInputFiles({ name: "void.jpg", mimeType: "image/jpeg", buffer: ph });
    await page.getByLabel("Caption for photo 1").fill("Void at D4");
    await page.getByRole("button", { name: /Next: operative signs/ }).click();
    await draw(page, 0);
    await page.getByRole("button", { name: /Next: client signs/ }).click();
    await expect(page.getByText("Hand the phone to the client")).toBeVisible();
    await draw(page, 0);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Sign & submit" }).click();
    await expect(page.getByText(/Signed — the copy is saved/)).toBeVisible();
    await expect(page.getByText("Extra nets to the new lift shaft void at D4")).toBeVisible();
    await expect(page.getByAltText("Void at D4")).toBeVisible();
    const pdf = await page.request.get(page.url().replace(/\/jobs\/[^/]+\/variation\//, "/api/variations/").replace(/\?.*$/, "") + "/sheet");
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("a boss sends an invoice; their own lads can't see it", async ({ page }) => {
    await signIn(page, "dave.clarke@derbydecking.example");
    await page.goto("/company/invoices");
    await page.getByLabel("Job", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Invoice number").fill("DD-2001");
    await page.getByLabel(/Amount/).fill("3,150.00");
    await page.getByLabel("Choose the invoice PDF").setInputFiles({ name: "inv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF") });
    await page.getByRole("button", { name: "Send to MSW" }).click();
    await expect(page.getByText("Invoice DD-2001")).toBeVisible();
    await expect(page.getByText("£3,150.00")).toBeVisible();
    const href = await page.getByRole("link", { name: /Invoice DD-2001/ }).getAttribute("href");
    await signOut(page);
    await signIn(page, "john.smith@derbydecking.example");
    expect((await page.request.get("/company/invoices")).status()).toBe(404);
    expect((await page.request.get(href!)).status()).toBe(404);
  });
});

async function draw(page: import("@playwright/test").Page, index: number) {
  const pad = page.getByLabel(/Signature box/).nth(index);
  await pad.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 120);
  await page.mouse.down();
  for (const [dx, dy] of [[60, 40], [110, 100], [160, 50], [220, 110], [280, 60]]) await page.mouse.move(box.x + dx, box.y + dy, { steps: 6 });
  await page.mouse.up();
}
