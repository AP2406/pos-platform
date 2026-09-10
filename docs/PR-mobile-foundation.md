# iPad app + admin hardening: auth, identity, design system

Merges `mobile-foundation` (59 commits) into `main`.
254 files, +27,283 / −381. **No conflicts** — verified with a trial merge in a
scratch worktree, including `app/globals.css`, where the marketing redesign on
`main` and the dark-token work here auto-merge cleanly.

## Why this is bigger than a feature branch

Three security defects were found while doing design work. Each was live.

**1. Two roles could not sign in at all.** `business_members.role` was an enum of
`owner | manager | staff | trainee`, so the `bookkeeper` and `shift_lead` entries
in the permission matrix had no account type to attach to. They existed only as
PIN identities in `staff_members`, a table with no `user_id`. An outside
accountant had to be made a full manager, or emailed CSVs by hand.

**2. 19 of 21 catalog mutations had no authorization check whatsoever.** Any
signed-in member — a server, a trainee — could create, rename, reprice, 86 or
delete menu items and modifier groups by calling the server action directly. A
`"use server"` function compiles to a public POST endpoint; the page guard above
it protects nothing.

**3. The cash drawer failed open.** `if (active && !actorCan(...))` reads as a
permission check but skips entirely when nobody is signed in at the PIN pad —
and `pos/drawer/actions.ts` had no web-role check to catch it. `recordCashMovement`
(pay-in / pay-out / safe drop) and `endDay` were reachable by any signed-in
member. The skip was deliberate, to support tills with no PIN session; the fix
keeps those working by falling back to the member role instead of skipping.

Plus one silent data bug: **`/app/orders` rendered zero orders** for a table
holding hundreds. It selected `dining_option`, which is not a column, PostgREST
rejected the select, and `const { data }` discarded the error.

## What's in it

**Authorization**
- `lib/services/route-access.ts` — web roles → the existing 16-key permission
  matrix; replaced the copy-pasted `owner || manager` check in 29 pages and 4
  export routes.
- `lib/services/action-guard.ts` — `authorizeAction()` and
  `createAuthorizedAction()` (session + permission + Zod, all fail-closed).
  33 of 353 server actions migrated; the rest triaged in `docs/admin-readiness.md`.
- `lib/services/pos-action-guard.ts` — `posAuthorize()` resolves the actor from
  the signed PIN cookie, falling back to the web role rather than skipping.
- `/app/debug` now checks the real `platform_admins` table and refuses in production.

**Identity**
- `0099` adds `shift_lead` + `bookkeeper` to `member_role` (additive).
- `0100` adds `staff_members.user_id` (nullable, unique per business) — the join
  between a PIN and a login.
- `/app/staff → Manage` gains a Dashboard access panel that creates the link.

**Navigation & design**
- `lib/modules/nav.ts` — six mode-aware groups replacing a flat 29-item list;
  ~12 routes that existed but appeared in no menu are mounted; every link is
  permission-filtered.
- Dark theme gets a real surface ladder (canvas `0.145` → card `0.205` → raised
  `0.245` → overlay `0.275`), visible borders, stronger muted text. Done in the
  existing OKLCH tokens, so light mode is unaffected and all ~45 routes inherit it.

**Data safety**
- `lib/supabase/query.ts` — `must()` / `soft()` / `widest()`.
- An ESLint rule flags destructuring `data` without `error` (warning; ~512
  existing sites predate it).
- `app/app/error.tsx` — there was no error boundary anywhere under `/app`.

**iPad app** — three rounds of design review: token rewrite, register
status-vs-action split, floor tiles where colour is a second signal, auto-lock,
seeded demo mode behind a dev flag.

## Migrations

`0097`–`0100`. **`0099` and `0100` are already applied to the Supabase project**,
so there is no drift to resolve on deploy. Both are additive; no existing row
changed.

## Verification

114 tests · clean typecheck on web *and* mobile · 0 ESLint errors · clean
production build · 36-route HTTP sweep as a manager.

`tests/unit/route-access.test.ts` caught two real regressions while it was being
written: granting `staff` the `access_reports` permission to preserve their
Reports link would also have opened `/app/accounting` to them, and core nav
modules were bypassing permission filtering so `/app/staff` showed to servers as
a dead link.

## Reviewer notes

- Both `OPEN_PREVIEW` flags (`lib/supabase/middleware.ts`, `app/robots.ts`) are
  `false`. They are dormant switches for sharing a dev server with an outside
  reviewer, and both carry `NODE_ENV !== "production"` so a committed `true`
  still cannot open the deployed site.
- Merging deploys to `www.surgetechpos.com`. The visible change for existing
  merchants is the dashboard restyle.
- Known gaps, all recorded in `docs/admin-readiness.md`: `staff_members.user_id`
  is populated by nothing yet, invite email needs SMTP on the Supabase project,
  and ~52 register/KDS actions still have no per-action permission (deliberate —
  no matching keys exist, and gating core service would stop servers serving).
