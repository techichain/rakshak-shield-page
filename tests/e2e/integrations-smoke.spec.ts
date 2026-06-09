import { test, expect } from "@playwright/test";

test("integrations admin page is gated", async ({ page }) => {
  const resp = await page.goto("/rakshak-platform/admin/integrations");
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

test("public health-ping endpoint returns ok", async ({ request }) => {
  const resp = await request.get("/api/public/hooks/health-ping");
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body.ok).toBe(true);
  expect(typeof body.ts).toBeTruthy();
});

test("meeting-reminders hook rejects unauthenticated calls", async ({ request }) => {
  const resp = await request.post("/api/public/hooks/meeting-reminders", {
    data: {},
  });
  // No x-cron-secret header → must reject (401/403).
  expect([401, 403]).toContain(resp.status());
});
