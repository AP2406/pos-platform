# Surge POS — admin dashboard screens for review

22 full-page screenshots of the back office, captured at 1440×900 (2× DPI, dark
theme, full scroll height). Tenant is **Aathy Bistro**, a full-service
restaurant, viewed as a **manager**.

Read them in numbered order — it follows how a restaurant actually uses the
product: service → money → team → menu → guests → settings.

## What's already been reviewed, and what hasn't

An earlier review of this dashboard was **text-only** — it read the codebase and
the audit notes but never saw a screen. Its findings were about information
architecture, and they are all implemented:

- flat 29-item sidebar → six mode-aware groups (visible in every screenshot)
- ~12 routes that existed but appeared in no menu → now mounted
- route access moved from `owner || manager` role checks to a permission matrix
- two new roles, **Shift lead** and **Bookkeeper**, that previously could not
  sign in at all
- honest export labels ("Journal CSV for QuickBooks / Xero", not a fake sync)

**So please don't re-derive the IA critique.** These images exist so the review
can finally be about what's on the screen.

## What to look at

| # | Screen | Worth judging |
| --- | --- | --- |
| 01 | Dashboard | First thing an owner sees each morning. Is the hierarchy right? Too many equal-weight KPI tiles? |
| 02–04 | Live ops, Kitchen/Expo, Orders | Density and scannability under service pressure |
| 05–06 | Reports, Reports with a custom date range | 06 is new. Does the date control read clearly beside the Today/7d/30d presets? |
| 07–08 | Accounting, Exports | Read as a bookkeeper: is it obvious what each export gives you? |
| 09–10 | Approvals, Exceptions | These are mostly empty here — judge the empty states |
| 11 | Staff | Role list and PIN management |
| **22** | **Staff → Manage, expanded** | **The newest surface.** "Dashboard access" links a PIN identity to a web login. Is the copy clear to a restaurant GM? Is "Access level" understandable without docs? |
| 12–14 | Schedule, Labor, Attendance | |
| 15–17 | Menu, Inventory, Purchasing | |
| 18–19 | Customers, Insights | |
| 20–21 | Activity log, Settings | 21 is long — the settings page may be doing too much |

## Known, already on the list — don't report these

- Most screens show **$0.00 / empty tables**: this tenant has no live sales
  data. Judge the empty states, not the absence of numbers.
- The blue **sparkle button** bottom-right is an assistant widget, intentional.
- A small dark circle overlaps the **Staff** sidebar icon in some shots — that's
  the Next.js dev-mode indicator, not product UI.
- Screens are captured from a dev server, so nothing is performance-tuned.

## Suggested prompt

> These are 22 screenshots of the Surge POS back office (restaurant admin),
> viewed as a manager. A previous review covered information architecture and
> those changes are done — don't repeat that analysis. Judge what you can see:
> visual hierarchy, density, typography, empty states, copy, and whether each
> screen tells a restaurant owner, bookkeeper or shift lead what they need at a
> glance. Pay particular attention to image 22, the Dashboard access panel,
> which is new and unreviewed. Be concrete — name the screen, the element, and
> the change. If a screen is already good, say so rather than inventing a
> finding.
