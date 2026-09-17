// Stub for Next.js's `server-only` marker package, aliased in vitest.config.ts.
//
// The real package has no runtime behaviour at all: it exists so that importing
// a server module from a client bundle fails at BUILD time. Vite does not know
// the package, so without this stub any test touching a module that guards
// itself with `import "server-only"` dies on load, before a single assertion.
//
// Stubbing it does not weaken anything. The guarantee is enforced by
// `next build`, which is in the gate, and a server module's pure exports are
// exactly the part worth unit-testing.
export {};
