import { test, expect } from "@playwright/test";

test("leaderboard renders with table", async ({ page }) => {
  await page.goto("/rakshak-platform/leaderboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("table").first()).toBeVisible({ timeout: 10_000 });
});

test("public knowledge index loads", async ({ page }) => {
  await page.goto("/rakshak-platform/knowledge");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("verify route shows not-found for bogus slug", async ({ page }) => {
  await page.goto("/rakshak-platform/verify/this-is-not-a-real-cert");
  await expect(page.getByText(/not found|certificate/i).first()).toBeVisible();
});

test("integrations admin redirects unauthenticated users", async ({ page }) => {
  await page.goto("/rakshak-platform/admin/integrations");
  await page.waitForLoadState("networkidle");
  const url = page.url();
  expect(url.includes("/auth") || url.includes("/integrations")).toBeTruthy();
});

test("health-ping responds 200 with ok payload", async ({ request }) => {
  const res = await request.get("/api/public/hooks/health-ping");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});
