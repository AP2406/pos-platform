# Pick up here — Sept 9, 2026 (paused)

## 1. REMIND AAT: send the updated screens to Perplexity

**Say this first thing:** *"You wanted a reminder to send the updated screenshots
to Perplexity."*

The 22 screenshots have been re-captured since Perplexity last saw them and now
include the restyled dark theme, the fixed Orders hub, and the new Sales-by-channel
table. Same URLs as before — nothing to regenerate:

- Briefing: https://raw.githubusercontent.com/AP2406/pos-platform/mobile-foundation/docs/review-screens/README.md
- Images: `.../docs/review-screens/01-dashboard.png` … `22-staff-manage-dashboard-access.png`

Worth telling it explicitly what changed since its last look, or it will review
the old version from memory:
- surface ladder + border/contrast fix (its own critique, implemented in OKLCH)
- `/app/orders` now actually renders orders (was silently empty)
- Reports has a Sales-by-channel table + Channel column in the CSV

## 2. Two things still switched off / open

- **Login is disabled in code.** `OPEN_PREVIEW = true` in
  `lib/supabase/middleware.ts` AND `app/robots.ts`. Set both to `false` to
  restore the sign-in page. **These two files are uncommitted on purpose** — do
  not commit them.
- **Reviewer account + tunnel still live.** Delete auth user
  `reviewer+a053feaf@surgetechpos.com` (`acda2164-2cae-4d04-8f75-84a84d9e6289`),
  strip the three `PREVIEW_*` lines from `.env.local`, Ctrl-C the `cloudflared`
  terminal, delete `docs/admin-review-links.md` (gitignored).

## 3. Where the work stands

Branch `mobile-foundation`, pushed through `bc88b7c`. 114 tests, clean typecheck,
clean production build. `docs/admin-readiness.md` has the full record.

Open items, roughly in order:
1. **Backfill `staff_members.user_id`** — linking works but every existing row is
   still null. Link real people once via `/app/staff → Manage`.
2. **SMTP for invites** — `inviteUserByEmail` needs SMTP on the Supabase project.
   Linking an email that *already* has a login works without it.
3. **~52 register/KDS server actions** still have no per-action permission check
   (deliberate — no matching permission keys; see the triage table in the doc).
4. **Hardware phase** — ESC/POS printing is partly built (`mobile/src/lib/printing`,
   `SurgePrinter` pod); card payments from the iPad are still "don't demo as
   working" in `mobile/docs/pilot-test-plan.md`.

## 4. Watch out

Perplexity has invented API names and file paths in every round —
`access_accounting`, `canStaff`, `void_item`, `web/src/styles/globals.css`,
`AppSidebar.tsx`, `ui/table.tsx`. It also reviewed screens it had not seen and
scored them 9.5/10. Its architectural reasoning has been good; treat its code
blocks as sketches and verify names against the repo before implementing.
