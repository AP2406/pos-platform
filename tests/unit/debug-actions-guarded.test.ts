import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Every server action under /app/debug must call assertDebugAllowed() first.
//
// This is a structural test rather than a behavioural one on purpose. The risk
// is not that one of today's actions loses its guard — it is that someone adds
// a SEVENTH action next to them and does not know the rule, because the rule is
// invisible: the layout gates the pages, so the folder looks protected. It is
// not. A server action is a POST to a build-time id that ships in the client
// bundle, and layouts do not run for it.
//
// These actions hold createAdminClient() (service role, bypasses RLS) and move
// money through Finix. An unguarded one is a stranger's card charge.

const DEBUG_DIR = join(process.cwd(), "app/app/debug");

function serverActionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...serverActionFiles(full));
      continue;
    }
    if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
    const src = readFileSync(full, "utf8");
    if (/^\s*["']use server["']/m.test(src)) out.push(full);
  }
  return out;
}

describe("debug server actions", () => {
  const files = serverActionFiles(DEBUG_DIR);

  it("finds the action files at all, so this test cannot pass vacuously", () => {
    // If the folder is renamed or emptied, this should fail loudly rather than
    // quietly assert nothing.
    expect(files.length).toBeGreaterThan(0);
  });

  it("guards every exported action", () => {
    // Body-scoped, not line-scoped. Several of these have multi-line parameter
    // lists and multi-line return types, so "the line after the export" is not
    // the first statement and a naive regex reports false failures — it did.
    // Take each function's body and require the guard to come before anything
    // that touches a tenant, the service-role client, or a payment rail.
    const DANGEROUS = ["requireBusiness", "createAdminClient", "finix", "supabase"];
    const unguarded: string[] = [];

    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const rel = f.replace(process.cwd() + "/", "");
      const re = /export\s+async\s+function\s+(\w+)/g;
      let m: RegExpExecArray | null;

      while ((m = re.exec(src)) !== null) {
        const name = m[1];
        if (rel.endsWith("guard.ts")) continue;

        // Walk from the declaration to the brace that opens the BODY: the first
        // "{" at nesting depth 0 with respect to the parens of the parameter
        // list. Return-type braces sit inside a `Promise<...>`, so track "<" too.
        let i = m.index, paren = 0, angle = 0, bodyStart = -1;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === "(") paren++;
          else if (c === ")") paren--;
          else if (c === "<") angle++;
          else if (c === ">") angle--;
          else if (c === "{" && paren === 0 && angle === 0) { bodyStart = i + 1; break; }
        }
        if (bodyStart < 0) { unguarded.push(rel + " -> " + name + " (unparseable)"); continue; }

        const body = src.slice(bodyStart, bodyStart + 1200);
        const guardAt = body.indexOf("assertDebugAllowed");
        if (guardAt < 0) { unguarded.push(rel + " -> " + name); continue; }

        for (const risky of DANGEROUS) {
          const at = body.indexOf(risky);
          if (at >= 0 && at < guardAt) {
            unguarded.push(rel + " -> " + name + " (guard runs after " + risky + ")");
            break;
          }
        }
      }
    }

    expect(
      unguarded,
      "these /app/debug actions run without the platform-admin gate:\n  " +
        unguarded.join("\n  ")
    ).toEqual([]);
  });

  it("keeps the guard's own production check, which is the load-bearing line", () => {
    const guard = readFileSync(join(DEBUG_DIR, "guard.ts"), "utf8");
    expect(guard).toContain('process.env.NODE_ENV === "production"');
    // And it must throw rather than return a falsy "denied" the caller could
    // ignore by not checking it.
    expect(guard).toMatch(/throw new Error\("not_found"\)/);
  });
});
