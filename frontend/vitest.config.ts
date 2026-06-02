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
      // Non-blocking for now — ratchet thresholds up as adapter/hook/function
      // tests land so coverage can't silently slide.
    },
  },
});
