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

**There is no staging Supabase project.** The account holds two: production
(`zbymwnfhbpdgfrykwrpd`) and "Trillium Event Rentals", an unrelated product. So
"point Preview at staging" is not a switch to flip — it is ~100 migrations plus
seed data to build first.

**Decision taken: defer the runtime role test, and gate it on the first
non-owner account instead of on this merge.** The reasoning is that the roles it
would exercise do not exist in production. Every account is an owner; no shift
lead or bookkeeper has ever been created, so the role boundary has no live
exposure today. The risk appears the moment someone creates the first non-owner
— and that is the moment to build staging and run the test, not now.

Revisit this the moment either becomes true:
- a non-owner account is about to be created on production, or
- a merchant other than you starts using the dashboard.

## Safe to run against the preview (read-only)

- [ ] Vercel build succeeds; no env-var or Supabase connectivity errors in the log.
- [ ] `/app`, `/app/staff`, `/app/reports`, `/app/settings` → 307 to `/login`
      when signed out.
- [ ] `/robots.txt` disallows `/app`, `/api`, `/login`.

> **On the `OPEN_PREVIEW` guard — read the condition carefully.** Both switches
> are `OPEN_PREVIEW && process.env.NODE_ENV !== "production"`. `next build` sets
> `NODE_ENV="production"` for **every** Vercel deployment, previews included
> (`VERCEL_ENV` is what distinguishes preview from production). So on Vercel the
> second term is **false**, and the switch cannot fire — on a preview or on
> production, even if `true` were committed by accident.
>
> Two consequences. First, the guard is stronger than "production is safe": open
> preview only ever works on a local dev server. Second, that means this
> checkbox is verifying *deployed behaviour*, not the guard's intent — check the
> actual HTTP responses rather than reasoning from the flag.
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

- [ ] Catalog edit, cash movement, staff management per role.
      **Blocked** by the two constraints above.
- [ ] Dashboard access linking creates the association for the intended business
      and account only. This writes — and it writes to `auth.users`.
- [ ] **Exports are not an innocuous read.** A CSV export mutates nothing, so it
      looks safe for a preview, but it hands over real sales, payroll and
      customer data — and a preview URL is easy to paste somewhere it shouldn't
      go. Treat it as a privileged data-access test, not a smoke test.

## Merge only when

- [ ] Preview build green.
- [ ] Auth redirect sweep passes on the preview.
- [ ] An owner can complete the core merchant flow.
- [ ] The dashboard restyle is accepted as immediately visible to merchants.
- [ ] The role-boundary runtime test is either done or **explicitly recorded as
      deferred**, with the unit suite named as the standing evidence.

## Still unverified after the gate passes — with closure criteria

Passing the read-only gate does not close these. Don't describe any of them as
done without the evidence in the right-hand column.

| Item | Evidence today | What would actually close it |
| --- | --- | --- |
| Low-privilege role enforcement | Unit coverage of the route-access matrix | A seeded staging tenant with real manager / staff / trainee / shift-lead / bookkeeper sessions |
| Protected write actions | Code review plus selected test coverage | Write-path testing against a non-production database |
| PIN → login attribution | The schema and linking path exist | Backfilling or deliberately linking existing `staff_members.user_id` rows |
| Register/KDS action authorization | Tenancy enforced; 52 actions ungated by design | New permission keys, then an action-guard migration |
| Silent query failures | New lint rule; ~512 known warnings | `must()` migration for the primary page and data loaders |

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

## Language for the merge commit

Say what was and wasn't validated, so the record doesn't imply more than was done:

> Merged after a clean integration and a read-only Vercel PR-preview check. The
> preview is treated as potentially production-data-connected; no state-changing
> validation was run there.
>
> Runtime role-boundary testing is deferred. No manager, staff, trainee, shift
> lead or bookkeeper web account exists in the tenant — all 11 accounts are
> owners — so an end-to-end session test of middleware, server actions, role
> resolution, RLS and rendered navigation could not be performed.
> `tests/unit/route-access.test.ts` is the automated evidence for the permission
> matrix and route mapping; it is not equivalent to that end-to-end test.
>
> Accepted residual risks: ~52 register/KDS actions have no matching per-action
> permission key (tenancy enforcement remains); `staff_members.user_id` is
> unlinked on every row, so PIN-to-login attribution is incomplete; 512
> silent-query lint findings remain, primary page loaders prioritised for
> migration to `must()`.

## Merge method

`--ff-only` will fail — `main` has three commits the branch doesn't. Use a
normal merge commit. Do **not** rebase 59 already-pushed commits to force linear
history; the merge commit is the more useful record of what production received.
