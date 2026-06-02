import { defineConfig, devices } from "@playwright/test";

// E2E smoke against the built static export (out/). Run: `npm run build` then
// `npm run test:e2e`. The webServer serves out/ (no Pages Functions, so /api/*
// 404s — the smoke ignores those expected errors and asserts the deterministic
// client behavior: render, search-mode transition, theme toggle).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
  },
  webServer: {
    command: "python3 -m http.server 4321 --directory out",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
      },
    },
  ],
});
