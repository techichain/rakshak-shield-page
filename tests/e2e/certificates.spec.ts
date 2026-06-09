import { test, expect } from "@playwright/test";

test("certificate verify page handles an invalid code", async ({ page }) => {
  const resp = await page.goto("/rakshak-platform/verify/not-a-real-cert-xyz");
  expect(resp?.status() ?? 200).toBeLessThan(500);
  await page.waitForLoadState("networkidle");
  // Page should render something — either a "not found" / invalid message or the verify shell.
  const bodyText = (await page.locator("body").innerText()).toLowerCase();
  const looksLikeVerify =
    bodyText.includes("verify") ||
    bodyText.includes("certificate") ||
    bodyText.includes("not found") ||
    bodyText.includes("invalid");
  expect(looksLikeVerify, "verify page should render verify/error UI").toBeTruthy();
});
