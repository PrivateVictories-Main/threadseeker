import { test, expect } from "@playwright/test";

// Deterministic smoke — does NOT depend on live upstream APIs returning data
// (asserts the search-MODE transition, not result counts), so it's stable in CI.

test("landing renders the hero + constellation with no unexpected console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Expected when serving the static export WITHOUT Pages Functions: the
    // /api/* proxy + AI endpoints 404, which the client degrades from. Those
    // surface as generic "Failed to load resource … 404" with no URL in the
    // text, so filter network resource-load failures here. Real JS/React
    // runtime errors have distinct messages and are still caught.
    if (t.includes("/api/") || t.includes("favicon") || t.includes("Failed to load resource")) {
      return;
    }
    errors.push(t);
  });
  await page.goto("/");
  await expect(page.locator(".ts-landing-hero")).toBeVisible();
  await expect(page.locator(".ts-constellation")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search query" }).first()).toBeVisible();
  expect(errors, `unexpected console errors: ${errors.join(" | ")}`).toEqual([]);
});

test("submitting a search transitions out of the hero into results mode", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("combobox", { name: "Search query" }).first();
  await input.click();
  await input.fill("react");
  await input.press("Enter");
  // Deterministic regardless of what upstream returns: the hero unmounts and
  // the results section mounts.
  await expect(page.locator(".ts-results")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".ts-landing-hero")).toHaveCount(0);
});

test("theme toggle flips the html.dark class", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/); // headless default = light
  await page.locator('[aria-label*="theme" i]').first().click();
  await expect(html).toHaveClass(/dark/);
});
