import { test, expect, devices } from "@playwright/test";

const PAGES = [
  "/rakshak-platform",
  "/rakshak-platform/leaderboard",
  "/rakshak-platform/knowledge",
  "/rakshak-platform/impact",
  "/rakshak-platform/mentors",
  "/rakshak-platform/auth",
];

for (const url of PAGES) {
  test(`no horizontal scroll on mobile: ${url}`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices["Pixel 5"] });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await ctx.close();
  });
}

test("skip-to-main link becomes visible on focus", async ({ page }) => {
  await page.goto("/rakshak-platform/leaderboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /skip to main/i });
  await expect(skip).toBeVisible();
});
