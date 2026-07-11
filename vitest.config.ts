import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for pure logic + server-action helpers (money/tax/tender/refund
// calculations land here in STEP 7). E2E lives separately under tests/e2e via
// Playwright (test:e2e), which Vitest ignores.
export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" path alias so tests can import production modules
    // that use it (e.g. app/app/pos/split-alloc.ts -> @/lib/services/tax-compute).
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/**/*.unit.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
