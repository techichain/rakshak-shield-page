import { test, expect } from "@playwright/test";

test("qa-checklist page is admin-only", async ({ page }) => {
  const resp = await page.goto("/rakshak-platform/admin/qa-checklist");
  expect(resp?.status() ?? 200).toBeLessThan(500);
  await page.waitForLoadState("networkidle");
  const onAuth = page.url().includes("/auth");
  const hasSignIn = await page
    .locator("text=/sign in|log in/i")
    .first()
    .isVisible()
    .catch(() => false);
  expect(onAuth || hasSignIn).toBeTruthy();
});

test("public knowledge listing renders without errors", async ({ page }) => {
  const resp = await page.goto("/rakshak-platform/knowledge");
  expect(resp?.status() ?? 200).toBeLessThan(500);
  await page.waitForLoadState("networkidle");
  // Headings exist on the public surface.
  const headings = page.locator("h1, h2");
  await expect(headings.first()).toBeVisible();
});
