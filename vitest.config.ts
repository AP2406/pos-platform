import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for pure logic + server-action helpers (money/tax/tender/refund
// calculations land here in STEP 7). E2E lives separately under tests/e2e via
// Playwright (test:e2e), which Vitest ignores.
export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" path alias so tests can import production modules
    // that use it (e.g. app/app/pos/split-alloc.ts -> @/lib/services/tax-compute).
    //
    // The @surge/* workspace packages need mirroring for the same reason: they
    // are tsconfig paths, not installed packages, so Vite cannot resolve them on
    // its own. Both are in mobile/tsconfig.json too — anything shared between the
    // web app and the iPad app lives there.
    alias: {
      "@surge/api-contracts": fileURLToPath(
        new URL("./packages/api-contracts/src", import.meta.url)
      ),
      "@surge/design-tokens": fileURLToPath(
        new URL("./packages/design-tokens/src", import.meta.url)
      ),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/**/*.unit.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
