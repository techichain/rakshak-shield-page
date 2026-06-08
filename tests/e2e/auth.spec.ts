import { test, expect } from "@playwright/test";

test("auth page renders sign-in form", async ({ page }) => {
  await page.goto("/rakshak-platform/auth");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input[type=email]").first()).toBeVisible();
});

test("admin URL while signed-out redirects to /auth or shows sign-in", async ({ page }) => {
  await page.goto("/rakshak-platform/admin");
  await page.waitForLoadState("networkidle");
  const url = page.url();
  const onAuth = url.includes("/auth");
  const hasSignIn = await page.locator("text=/sign in/i").first().isVisible().catch(() => false);
  expect(onAuth || hasSignIn).toBeTruthy();
});
