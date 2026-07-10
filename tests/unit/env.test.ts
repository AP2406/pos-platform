import { describe, it, expect, vi, afterEach } from "vitest";
import { validateEnv } from "../../lib/env";

// Smoke coverage for the startup env contract (STEP 1). The full money/tax/tender
// suites arrive in STEP 7 under tests/unit.
describe("validateEnv (env contract)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not throw outside production even when required vars are missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws in production when a required var is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => validateEnv()).toThrow(/required production environment/i);
  });
});
