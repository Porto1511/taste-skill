import { expect, type Page } from "@playwright/test";
import { demoId } from "../src/server/seed/demo-data";

export const PASSWORD = "SiteDemo!2026";
export const BM = demoId("job:bm");

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}
