# Admin side — readiness by persona (web dashboard, Sept 2026)

Decision: the web dashboard (`app/app/**`) stays the admin surface; a separate
admin app comes later. This is the state of the web today, by who uses it, with
the gaps that matter most. Code-level audit; visual pass still to do.

## What exists (a lot)

~45 merchant routes, all backed by real Supabase queries — no mock data, only
three narrow "coming soon" strings (floor preset image, appointments mode,
receipt sample). Plus `/hq/*` for Surge staff (merchants, onboarding, portfolio,
reps, ops), gated by `platform_admins`.

| Persona | Has today | Biggest gaps |
| --- | --- | --- |
| **Owner / GM** | Dashboard (today/period KPIs, top items, recent sales), Reports, Accounting suite, Labor, Schedule, Attendance, Approvals, Exceptions, Incidents, Shift log, Staff records, Announcements, Insights, Happy hour, Upsells, Integrations, Marketing, Activity log, Settings incl. role matrix | Flat sidebar of ~29 items with no grouping; ~12 built routes (Inventory, Purchasing, Recipes, Waste, Locations, Exports, Live ops, Go-live, QR codes, Customer insights, Menu push, mobile `/m`) aren't in the nav at all — URL-only. Vocabulary drift: Orders / Tickets / Tabs / Sales / Checks all mean the same thing. |
| **Shift lead** | Permission matrix gives void/comp/discount/drawer/reports/close-day | Route gating ignores the matrix: every admin page checks the legacy `owner \|\| manager` enum, so a shift lead is redirected out of Reports extras, Labor, Approvals, etc. |
| **Accountant / bookkeeper** | P&L (prime cost), GST/HST (GST34), income statement (cash/accrual), tenders, liabilities, deposits reconciliation, journal entries + templates, payroll export, settlement, year-end, chart of accounts (`COA_DEFAULTS`, per-business override), DSJE journal CSV | Same gating bug: `bookkeeper` has `access_reports` + `export_data` but **cannot open `/app/accounting`** (`app/app/accounting/page.tsx:27`) or `/app/exports`. Exports are CSV only — button says "Export CSV (QBO/Xero)" but there is no QuickBooks/Xero API sync. Reports: Today / 7d / 30d only, no date picker, no staff/channel filter. |
| **Investor / multi-location owner** | `/app/locations` (7/30/90d KPIs per location + consolidated prime-cost league table), `/app/accounting/consolidated` (per-entity + consolidated statements, intercompany entries), menu push to sibling locations | No passive-investor persona: access is membership-based (owner/manager of each business). No portfolio view outside `/hq` (Surge-internal). `/app/locations` not in nav. |
| **Kitchen expo** | Web `/app/kitchen` is strong: station lock, All / By station / **Expo** views, per-item bump, 86 board with menu search, Rush, "Message the server", channel badges, allergen banners (3 languages), sound, keyboard nav, realtime | iPad KDS is thinner (no Expo lane, no 86 board, no messaging). Threshold vocabulary differs ("Done · ready" vs "Ready"). |
| **Host** | Reservations, Floor, time clock, checklists | Role has zero permissions in the matrix; fine for now. |
| **Everyone** | Dark-first shadcn UI (Hanken Grotesk, OKLCH tokens), responsive off-canvas nav, demo-tenant banner | Web and iPad share the brand blue but not fonts, token names or status vocabulary; nothing on the web imports `@surge/design-tokens`. |

## Fix-first list — DONE (Sept 9, 2026)

All six shipped, plus a schema fix the audit missed. Verified by
`tests/unit/route-access.test.ts` (93/93 unit tests green), a clean typecheck on
both the web and mobile projects, and a 36-route HTTP sweep as a manager.

0. **The two roles couldn't log in at all.** The audit said the gating bug
   "locked bookkeepers out of `/app/accounting`". The real problem was one layer
   down: `business_members.role` was an enum of `owner | manager | staff |
   trainee`, so **there was no bookkeeper or shift-lead web account to lock
   out**. Those roles live only in `staff_members` (PIN identities), a table
   with no `user_id` — the two identity systems have never been joined, and
   `systemRoleForLegacy()` bridges them by guessing (`staff → server`).
   Migration `0099` adds `shift_lead` and `bookkeeper` to the enum (additive; no
   existing row changed). Joining web logins to staff records is still the
   better long-term model and remains open.
1. **Route gating → permission matrix.** New `lib/services/route-access.ts` maps
   each web role onto the 16-key matrix and each route onto the permission it
   needs; `requirePermission()` / `canAccess()` replaced the copy-pasted role
   check in 29 pages and the 4 accounting export routes. Write actions were
   deliberately left on `owner || manager` — they fail closed for the new roles
   until each is reviewed on its own.
   *A naive swap would have caused a regression:* `staff` maps to `server`,
   which has no `access_reports`, and `/app/reports` has no guard at all — so
   granting staff that permission to "keep" Reports would instead have opened
   the accounting pages to them. Reports stays an open route; the test suite
   pins this.
2. **Grouped sidebar.** `lib/modules/nav.ts` now declares every destination in
   one of six groups, with mode-specific headings (a limo dispatcher gets
   "Dispatch", not "Service"), permission-filtered so no role is shown a link
   that would bounce it. The ~12 URL-only routes — live ops, inventory,
   purchasing, recipes, waste, locations, exports, customer insights, menu push
   — are mounted. Core modules are filtered too: `/app/staff` was showing to
   servers as a dead link.
3. **One word per thing.** `full_service` was seeding `labels.orders =
   "Tickets"` and `bar` `"Tabs"`, so the same destination read three different
   ways by mode while the screens inside said Check and Order. Both overrides
   removed at the source and cleared from the two businesses that carried them.
   Check = open table, Order = settled or off-premise.
4. **Reports date picker.** Custom `from`/`to` on `/app/reports`, with the
   31-day query window widened to follow the range and one shared window
   definition for the orders, labor and audit queries (they each re-derived it
   and could disagree). *Accounting already had a working custom range* — that
   half of the finding was wrong. Export labels now read "Journal CSV for
   QuickBooks / Xero", with a tooltip stating it's a download, not a sync.
5. **`/app/debug`.** Also already gated (env email allowlist, 404 on failure) —
   this audit item was stale. Hardened anyway: now checks the real
   `platform_admins` table and refuses outright when `NODE_ENV === production`.
6. **Shared tokens.** `lib/ui/service-status.ts` re-exports `STAGE_LABEL` /
   `AGING_LABEL` from `@surge/design-tokens` with web chip classes. The web KDS
   said "Done · ready" where the iPad says "Ready"; both now read the same
   constant.

## Server actions — partly done (Sept 9, 2026)

Gating a page is not a security boundary in Next.js: every `"use server"`
function compiles to a callable POST endpoint, reachable with a session
regardless of what the page that renders the button decided. So each mutation
needs its own check.

`lib/services/action-guard.ts` provides both: `authorizeAction(perm)` for
retrofitting an existing action in one line, and `createAuthorizedAction(perm,
schema, handler)` — the HOF — so new actions get session, permission and Zod
validation structurally. Both fail closed, and both check the permission
*before* the demo lock and before validation, so a refusal leaks neither account
state nor the input schema. 12 tests in `tests/unit/action-guard.test.ts`.

**The audit's premise was half wrong.** The claim was that write actions are
uniformly `owner || manager` — safe but mismatched. In fact:

- **19 of 21 catalog mutations had no role check at all.** Any signed-in member
  — a server, a trainee — could create, rename, reprice, 86 or delete menu
  items, modifiers and variations. Only `saveCategoryColors` and
  `setCatalogItemTaxes` were guarded. Now all 21 require `edit_menu`.
- Several files *did* guard, via a local `canManage(role)` helper that a naive
  grep misses (schedule, recipes, waste, purchasing, staff, roles, menu push).
  Those weren't holes; their helper now delegates to `canAccess`, so the new
  roles work without restructuring the actions.
- `inventory/actions.ts` (3) had no check; now `edit_menu`.

Counted honestly: **353 server actions across 68 files.** 33 are now on the
matrix. The rest are triaged, not done:

| Group | Actions | Why not yet |
| --- | --- | --- |
| `pos/ticket-actions` (28), `kitchen/actions` (12), `pos/drawer` (4), `pos/split`, `pos/saved-ticket`, `pos/staff-session` | ~52 | Register and KDS operations. Authorization here is the staff PIN at the till, not the web role — gating them on `business_members.role` would break the iPad. These need the *staff* matrix, which is the identity-unification work below. |
| Money path: `pos/finix-*`, `pos/*-refund`, `accounting/deposit-actions`, `tips` | ~25 | Each needs a reason code and audit decision, not just a permission key. Do these one at a time. |
| `trips/*`, `vehicles`, `drivers`, `partners` | ~30 | Transportation vertical; separate review. |
| Everything else | remainder | Lower risk, mostly already `canManage`-guarded. |

`settings/notifications-actions.ts` is deliberately ungated: it registers the
caller's *own* browser for push, so every member must be able to call it. The
typechecker caught that one when a bulk pass gated it by mistake.

## Reviewer preview — how to reopen it, and the trap in it

Sharing this dashboard with an outside reviewer twice ran into the same wall, so
it's written down. Two switches, both `false`, flip together:

- `OPEN_PREVIEW` in `lib/supabase/middleware.ts` — signs every `/app` request in
  as a throwaway reviewer account, no sign-in page.
- `OPEN_PREVIEW` in `app/robots.ts` — **this is the one that isn't obvious.**
  `Disallow: /app/` means a well-behaved fetcher refuses the dashboard on *any*
  host. It reads as "the tunnel is broken" when it's really the crawler obeying
  robots.txt. Two different tunnels were blamed before this was found.

Both carry `NODE_ENV !== "production"`, so even committed `true` cannot open the
deployed site. `scripts/create-preview-reviewer.mjs` mints the account (RLS keeps
it to one business); delete the `PREVIEW_*` lines from `.env.local` and the auth
user to revoke.

If the fetcher still won't load it, stop fighting the transport: publish
screenshots instead. `docs/review-screens/` holds 22 of them, regenerated with
Playwright against a local dev server, and raw GitHub URLs are fetchable by
everything.

## Register authorization + identity link (Sept 9, 2026)

### A fail-open check in the cash drawer

The register's money-sensitive actions guard on the *cashier's* PIN identity,
not the web role. The shape was:

```ts
const active = await getActiveStaff();
if (active && !(await actorCan(supabase, biz, active.id, "open_drawer"))) {
  ...require an approver PIN...
}
```

Read quickly, that is a permission check. It is not: when nobody is signed in
at the PIN pad `active` is null, the branch is skipped, and the mutation
proceeds **unauthorized**. The skip was deliberate — quick-service, retail and
transportation tills have no PIN session and must still work — but a
`"use server"` function is a public POST endpoint, so dropping the cookie was
enough to walk past it.

Four sites had the shape. Three (`voidOrder`, refunds, reopen) gate on
`owner || manager` earlier in the function, so the fail-open was not reachable.
**`pos/drawer/actions.ts` has no web-role check at all**, which made two actions
genuinely exploitable by any signed-in member — including a server, a trainee,
or the new bookkeeper:

- `recordCashMovement` — record a pay-in / pay-out / safe drop against the till
- `endDay` — close out the drawer, including the open-checks override

`lib/services/pos-action-guard.ts` replaces the pattern. `posAuthorize()`
resolves the actor from the signed PIN cookie when there is one (staff matrix,
caps and per-person overrides all apply, and `needsApproval` preserves the
approver-PIN flow), and **falls back to the web member role when there is not**,
rather than skipping. Non-staffed tills keep working; the hole closes. 9 tests
in `tests/unit/pos-action-guard.test.ts`.

The drawer's audit metadata now also records `pin_session`, so the log
distinguishes "Sam ended the day at the till" from "an owner ended it remotely".

### Migration 0100 — one person, two identities

`staff_members.user_id` (nullable, `on delete set null`) with a partial unique
index on `(business_id, user_id)`. Nullable on purpose: a line cook who only
taps a PIN never needs a web account.

This is the join that lets the audit trail attribute a PIN-approved void and a
dashboard-approved void to the same person, and lets per-person overrides reach
both surfaces.

**Linking (Sept 9, later):** `/app/staff` → Manage now has a *Dashboard access*
panel. Enter an email and an access level and it resolves an existing Surge
login (looked up through `public.profiles`, because `auth.admin.listUsers` 500s
on this project) or sends an invite, upserts the `business_members` row, and
sets `staff_members.user_id`. Unlink is separate from revoking access, so
"they've stopped using the dashboard" and "they've left" are different actions —
and removing the last owner's membership is refused outright.

Both `/app/staff` and `/app/settings` were building the staff query by hand, so
adding `user_id` meant editing it twice; they now share `loadStaffList()`.

**On retiring `systemRoleForLegacy()`:** only one of its two call sites was
wrong. `app/app/layout.tsx` passed a *business_members* role through a mapper
built for the *staff* enum — harmless for owner/manager, meaningless for the
rest, and after 0099 it would have collapsed shift_lead and bookkeeper onto
"server", handing them a server's hidden-nav config. That site now uses
`roleKeyForWebRole()`. The other call, in `resolvePermissions()`, is correct and
stays: a PIN-only staff member with no `role_id` has no login to consult, so the
legacy enum genuinely is the only signal.

### Register actions: what got gated, and what deliberately didn't

Two of `pos/ticket-actions.ts` map to real permission keys and now go through
`posAuthorize`: `discardTicket` (deletes a held check, so `delete_item_prepay`)
and `sendVoidNotice` (tells the line to bin fired food, so `void`).

The other ~45 register and KDS actions are **intentionally left open**, and
"wrap them all in `posAuthorize`" would be the wrong change. Opening a table
check, adding an item, firing a course, bumping a ticket, marking an item ready
— these are the job. There is no permission key for them and there shouldn't
be; inventing one is a product decision, not a refactor, and gating them would
stop servers serving. All 28 already call `requireBusiness()` and filter on
`business_id`, so tenancy is enforced; what's absent is intra-tenant privilege,
which for core service is correct.

### Still open
- **Backfill existing staff.** Linking works going forward, but every current
  `staff_members` row still has `user_id = null`, including people who already
  have a dashboard login. Someone has to link them once, by hand, from
  `/app/staff` → Manage.
- **Invite email delivery.** `linkStaffToWebAccount` calls
  `inviteUserByEmail()`, which needs SMTP configured on the Supabase project. If
  it isn't, linking an address that has no account yet returns "Couldn't send
  the invitation" — linking an address that *already* has a Surge login works
  regardless.
- **`systemRoleForLegacy()` in `resolvePermissions`.** Still the right call for
  a PIN-only staff member with no `role_id` — there is no login to consult. It
  can only retire once every staff row has either a `role_id` or a `user_id`.
- **Reports filters** beyond dates: staff and channel.
- **A real QuickBooks / Xero sync**, versus today's honest CSV.
- **A passive-investor persona**: access is still membership-based, so an
  investor has to be made a manager of each location to see anything.

## Later: the separate admin app

When it's time, the natural split is: **iPad app = service** (floor, register, kitchen, reservations, clock); **admin app = manage** (Today dashboard with alerts, Reports, Books, Team & schedule, Menu/86, Approvals, Locations roll-up, Activity). It can reuse the mobile design system and `@surge/api-contracts`, and every manager action it needs (86 an item, approve, shift-log note, schedule edit) should land as a `POST /api/v1/...` route first — the iPad app already follows that rule for money and kitchen writes.
