import { test, expect } from "@playwright/test";

/**
 * Admins must not be able to load evaluator/team/mentor pages via URL.
 * They should land on the 403 /rakshak-platform/unauthorized page.
 *
 * Override credentials via ADMIN_EMAIL / ADMIN_PASSWORD env vars if needed.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "RakshakAdmin2025!";

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/rakshak-platform/auth");
  await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).first().fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"), { timeout: 15_000 });
}

const PROTECTED_PATHS = [
  "/rakshak-platform/evaluator",
  "/rakshak-platform/team",
  "/rakshak-platform/mentor",
  "/rakshak-platform/mentor/availability",
  "/rakshak-platform/team/locations",
  "/rakshak-platform/team/reports",
  "/rakshak-platform/team/ai-check",
];

test.describe("Admin role-route protection", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  for (const path of PROTECTED_PATHS) {
    test(`admin is blocked from ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(
        /\/rakshak-platform\/(unauthorized|dashboard)/,
        { timeout: 10_000 },
      );
      const url = page.url();
      expect(url).toMatch(/unauthorized|dashboard/);
      if (url.includes("unauthorized")) {
        await expect(page.getByTestId("rp-unauthorized")).toBeVisible();
      }
    });
  }
});
