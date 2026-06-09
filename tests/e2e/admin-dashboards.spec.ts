import { test, expect } from "@playwright/test";

/**
 * Signed-out smoke: every admin entry redirects to /auth or renders a sign-in CTA.
 * Verifies routes resolve (no 404 / blank shell) and the auth gate is wired.
 */
const ADMIN_ROUTES = [
  "/rakshak-platform/admin",
  "/rakshak-platform/admin/cron-health",
  "/rakshak-platform/admin/alerts",
  "/rakshak-platform/admin/integrations",
  "/rakshak-platform/admin/exports",
  "/rakshak-platform/admin/evaluator-leaderboard",
  "/rakshak-platform/admin/qa",
];

for (const route of ADMIN_ROUTES) {
  test(`admin route ${route} is gated`, async ({ page }) => {
    const resp = await page.goto(route);
    expect(resp?.status() ?? 200, `${route} should not 5xx`).toBeLessThan(500);
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const onAuth = url.includes("/auth");
    const hasSignIn = await page
      .locator("text=/sign in|log in/i")
      .first()
      .isVisible()
      .catch(() => false);
    expect(onAuth || hasSignIn, `${route} should redirect to /auth or show sign-in`).toBeTruthy();
  });
}
