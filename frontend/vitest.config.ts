import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Reset spies + restore any vi.stubGlobal (the Pages Functions tests stub
    // fetch/caches) after every test, so nothing leaks across files and the
    // suite is order-independent.
    restoreMocks: true,
    unstubGlobals: true,
    // The jsdom environment is heavy to spin up; under parallel-worker CPU
    // contention even a trivial render test can blow the default 5s budget
    // (seen intermittently on CardActions). Give tests + hooks generous
    // headroom so the suite is reliable, not flaky, in CI.
    testTimeout: 20000,
    hookTimeout: 20000,
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Measure the logic that matters; UI-only/motion + generated data excluded.
      include: ["src/lib/**", "src/app/useSearch.ts", "functions/**"],
      exclude: [
        "**/*.test.*",
        "src/lib/sources/backtest-queries.ts",
        "src/lib/sources/ranking-fixtures.ts",
      ],
      // Modest ratchet: ~2 points below the measured suite (lines 39.4% on
      // 2026-06-10) so it passes today but `npm run test:coverage` fails in
      // CI if coverage slides. Bump as adapter/hook/function tests land.
      thresholds: {
        lines: 37,
      },
    },
  },
});
