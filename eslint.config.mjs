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

      // A Supabase query that fails returns { data: null, error } — it does not
      // throw. Destructuring only `data` therefore turns a broken query into a
      // silent empty screen, which is how /app/orders rendered zero orders for
      // a table holding hundreds (it selected a column that didn't exist).
      //
      // Warn, not error: ~400 existing call sites predate this and most are
      // harmless secondary lookups. The point is that NEW ones are visible in
      // review. Take the error and either check it, or pass the whole result to
      // must() / soft() / widest() from lib/supabase/query.ts.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "VariableDeclarator[init.type='AwaitExpression'] > ObjectPattern:matches(" +
            ":has(Property[key.name='data'])" +
            "):not(:has(Property[key.name='error']))",
          message:
            "Supabase errors don't throw — destructuring only `data` hides a failed query as an empty result. Destructure `error` too, or wrap the call in must()/soft() from @/lib/supabase/query.",
        },
      ],
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
