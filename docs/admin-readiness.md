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

### Still open

- **Server actions** still use `role !== "owner" && role !== "manager"` (~60
  files). Fail-closed, so nothing is exposed, but a shift lead can read the
  approvals page and not act on it. Each needs a permission decision.
- **One identity per person** — `staff_members.user_id`, so a web login and a
  PIN are the same human and per-person permission overrides apply everywhere.
- **Reports filters** beyond dates: staff and channel.
- **A real QuickBooks / Xero sync**, versus today's honest CSV.
- **A passive-investor persona**: access is still membership-based, so an
  investor has to be made a manager of each location to see anything.

## Later: the separate admin app

When it's time, the natural split is: **iPad app = service** (floor, register, kitchen, reservations, clock); **admin app = manage** (Today dashboard with alerts, Reports, Books, Team & schedule, Menu/86, Approvals, Locations roll-up, Activity). It can reuse the mobile design system and `@surge/api-contracts`, and every manager action it needs (86 an item, approve, shift-log note, schedule edit) should land as a `POST /api/v1/...` route first — the iPad app already follows that rule for money and kitchen writes.
