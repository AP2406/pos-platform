// Runs once when a Next.js server instance boots (before it serves requests).
// We use it to validate the environment contract: in production a missing
// required secret throws here, so a misconfigured deploy fails to start instead
// of serving traffic. Guarded to the Node runtime and skipped during the build
// phase (build shouldn't need runtime secrets present).

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { validateEnv } = await import("./lib/env");
  validateEnv();
}
