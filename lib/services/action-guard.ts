// Authorization for server actions.
//
// Gating a page is not a security boundary in Next.js: every `"use server"`
// function is compiled into a callable POST endpoint, reachable by anyone with
// a session regardless of what the page that renders the button decided. So the
// route guards in route-access.ts have to be matched by a check inside each
// mutation.
//
// Two entry points, same matrix (lib/services/permissions.ts via
// route-access.ts) that the pages and the sidebar use:
//
//   authorizeAction(perm)                — one line at the top of an existing
//                                          action; returns a discriminated
//                                          union so the action can return its
//                                          own `{ error }` shape.
//   createAuthorizedAction(perm, schema, handler)
//                                        — wraps a new action so the session
//                                          check, the permission check and Zod
//                                          validation all run before the
//                                          handler can touch Supabase.
//
// Both fail closed: no session, unknown role, missing permission, or invalid
// input all stop before the handler runs.

import type { z } from "zod";
import type { PermissionKey } from "./permissions";
import { canAccess } from "./route-access";
import { requireBusiness, assertConfigEditable, type BusinessContext } from "./tenancy";

export type AuthorizedContext = BusinessContext & { ok: true };
export type AuthorizationFailure = { ok: false; error: string };
export type AuthorizationResult = AuthorizedContext | AuthorizationFailure;

/** Human-readable refusal. Deliberately vague about what the permission is. */
function denied(): AuthorizationFailure {
  return { ok: false, error: "Your role doesn't have access to do that." };
}

/**
 * Assert the caller holds `perm` for the active business.
 *
 * ```ts
 * const auth = await authorizeAction("edit_menu");
 * if (!auth.ok) return { error: auth.error };
 * const { business } = auth;
 * ```
 *
 * Pass `configWrite: true` for anything that edits business configuration
 * (menu, floor plan, settings) so demo businesses stay locked — that check used
 * to be a separate `assertConfigEditable(business)` call that was easy to omit.
 */
export async function authorizeAction(
  perm: PermissionKey,
  opts: { configWrite?: boolean } = {}
): Promise<AuthorizationResult> {
  let ctx: BusinessContext;
  try {
    ctx = await requireBusiness();
  } catch {
    // requireBusiness redirects when signed out; a throw here means no
    // usable session, so refuse rather than continuing with an undefined role.
    return { ok: false, error: "Sign in to continue." };
  }

  if (!canAccess(ctx.role, perm)) return denied();

  if (opts.configWrite) {
    try {
      assertConfigEditable(ctx.business);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "This account is locked." };
    }
  }

  return { ...ctx, ok: true };
}

/** Shape every wrapped action returns. */
export type ActionResult<T> = ({ ok: true } & T) | { ok?: false; error: string };

/**
 * Wrap a new server action so authorization and validation are structural
 * rather than remembered. The handler only ever runs with a verified session,
 * a role that holds `permission`, and input that already passed `schema`.
 */
export function createAuthorizedAction<TSchema extends z.ZodType, TOut extends object>(
  permission: PermissionKey,
  schema: TSchema,
  handler: (input: z.infer<TSchema>, ctx: BusinessContext) => Promise<ActionResult<TOut>>,
  opts: { configWrite?: boolean } = {}
): (input: unknown) => Promise<ActionResult<TOut>> {
  return async (input: unknown) => {
    const auth = await authorizeAction(permission, opts);
    if (!auth.ok) return { error: auth.error };

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { ok: _ok, ...ctx } = auth;
    return handler(parsed.data, ctx as BusinessContext);
  };
}
