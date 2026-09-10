# Release gate — `mobile-foundation` → `main`

Merging deploys to `www.surgetechpos.com`. Run this against the **Vercel PR
preview**, not localhost.

## Read this first — two things that constrain the gate

**1. A preview deployment probably shares the production database.** There is
one Supabase project. Unless preview-scoped env vars point somewhere else, a
write performed while "testing the preview" lands in real merchant data — a test
cash movement becomes a real row in a real drawer session.

> **Check before any write test:** Vercel → Project → Settings → Environment
> Variables → confirm whether `NEXT_PUBLIC_SUPABASE_URL` differs for Preview.
> If it does not, restrict preview testing to reads, or point Preview at a
> separate Supabase project first.

**2. There is no low-privilege account to test with.** Every account on the
project is an `owner` (11 of 11). No manager, staff, trainee, shift_lead or
bookkeeper web login exists, so any step of the form "sign in as X and confirm
they cannot…" cannot be run today.

Options, in order of preference:
- Point Preview at a seeded staging Supabase project and create test accounts there.
- Accept `tests/unit/route-access.test.ts` as the evidence for the permission
  matrix (it asserts the full per-role surface, including that a bookkeeper is
  refused the menu and a server the books) and record the runtime check as
  deferred.
- Create one throwaway low-privilege account on production, test, delete. Least
  good: it is a real account in a real tenant.

## Safe to run against the preview (read-only)

- [ ] Vercel build succeeds; no env-var or Supabase connectivity errors in the log.
- [ ] `/app`, `/app/staff`, `/app/reports`, `/app/settings` → 307 to `/login`
      when signed out.
- [ ] `/robots.txt` disallows `/app`, `/api`, `/login`.
      (Confirms both dormant `OPEN_PREVIEW` switches stayed off. They also carry
      `NODE_ENV !== "production"`, which is true on Vercel, so they cannot fire
      there regardless.)
- [ ] `/app/debug` → not reachable.
- [ ] Signed in as owner: dashboard → orders → register → KDS → reports →
      settings all render.
- [ ] **`/app/orders` shows actual orders.** This is the regression that
      motivated the fix; an empty list here means it is back.
- [ ] Reports: presets and the custom date range both return data; Sales by
      channel populates.
- [ ] Dark and light mode, mobile viewport, sidebar collapse, a dialog, and one
      dense table.
- [ ] Sidebar shows six groups and no dead links.

## Requires a decision first (writes, or needs a test role)

- [ ] Catalog edit, cash movement, export, staff management per role.
      **Blocked** by the two constraints above.
- [ ] Dashboard access linking creates the association for the intended business
      and account only. This writes — and it writes to `auth.users`.

## Merge only when

- [ ] Preview build green.
- [ ] Auth redirect sweep passes on the preview.
- [ ] An owner can complete the core merchant flow.
- [ ] The dashboard restyle is accepted as immediately visible to merchants.
- [ ] The role-boundary runtime test is either done or **explicitly recorded as
      deferred**, with the unit suite named as the standing evidence.

## Residual risk being accepted at merge

State these in the merge commit rather than leaving them implied:

1. **~52 register/KDS server actions have no per-action permission check.**
   Deliberate — no permission key in the matrix fits "open a check" or "bump a
   ticket", and gating them would stop servers serving. Tenancy *is* enforced on
   all of them. This is accepted risk, not "secured".
2. **`staff_members.user_id` is null on every row.** Linking works; nothing is
   linked. Until it is, the audit trail cannot tie a PIN action to a web login,
   so don't describe attribution as complete.
3. **512 sites still trip the silent-query lint rule.** Each can turn a failed
   query into a convincing empty screen, which is exactly how `/app/orders`
   broke. Follow-on PR: migrate primary page loaders to `must()`.

## Merge method

`--ff-only` will fail — `main` has three commits the branch doesn't. Use a
normal merge commit. Do **not** rebase 59 already-pushed commits to force linear
history; the merge commit is the more useful record of what production received.
