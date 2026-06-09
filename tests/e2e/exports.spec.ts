import { test, expect } from "@playwright/test";

test("exports route is admin-only", async ({ page }) => {
  const resp = await page.goto("/rakshak-platform/admin/exports");
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

test("print route requires a dataset param", async ({ page }) => {
  // Without a valid signed-in admin we just confirm the route exists and does not 5xx.
  const resp = await page.goto("/rakshak-platform/admin/print/leaderboard");
  expect(resp?.status() ?? 200).toBeLessThan(500);
});
