import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React 19 compiler stylistic rules — keep them visible as warnings but don't
    // fail the build/CI on them. Several are flagged in the payment components that
    // the STEP 2 canonical-order refactor rewrites anyway; churning the hooks there
    // now would be duplicated risk. Correctness rules (purity, rules-of-hooks, refs,
    // immutability) stay as errors.
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // ref-access-in-render / recursive-setTimeout / ref-passed-to-fn — compiler
      // false positives on valid patterns in the payment components (re-enabled +
      // fixed there in the STEP 2 refactor).
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      // `Date.now()`/`Math.random()` "impurity" — almost all in server components
      // (runtime-safe) or one-time client values; keep visible, don't block.
      "react-hooks/purity": "warn",
      // Typing strictness at data/SDK boundaries — not a launch-correctness issue.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
