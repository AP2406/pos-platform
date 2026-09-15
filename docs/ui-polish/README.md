# Render proof — `ui-polish`, phase 1

Four screenshots of the POS floor screen after the dark-token alignment and the
floor restyle. Compare against `Surge-UI-Polished/01-main-floor.jpg`.

| File | Width | Theme |
| --- | --- | --- |
| `floor-dark-1280.png` | 1280 | dark — the theme the handoff specifies |
| `floor-light-1280.png` | 1280 | light — untouched by this pass, shown to prove it |
| `floor-dark-375.png` | 375 | dark, handheld (list view, action strip hidden) |
| `floor-light-375.png` | 375 | light, handheld |

## How these were taken, and what is synthetic

`/app/pos` is auth-gated and the floor is drawn entirely from live tenant data,
so these were produced the way `docs/menu-builder/` and `docs/nav-slim/` were: a
throwaway route mounted the **real** `<FloorClient />` with static props, the
production build was served locally, `scripts/shot.mjs` photographed it, and the
route was deleted before the commit. No product code imports it.

The sample floor is the handoff's own — Table 1–5, Booth 1–2, Host, Bar, with
its amounts and its two servers (Sam, Alexis) — so the two images line up.

**The durations are deliberately not the mockup's.** `01-main-floor.jpg` shows
"4d 5h" on every table; the handoff README says that is stale source data, not a
design ("the visual redesign does not repair live data"). Reproducing it as
design would be copying a bug, so the open times here are spread across the
states the screen actually has — 6m and 24m (occupied), 52m and 1h 3m (warning,
>45m), 1h 37m to 2h 12m (late, >90m) — which is also the only way to photograph
all four legend entries at once.

## Not in these shots

- **The "day is open" strip.** It lives in `app/app/pos/page.tsx`, above
  `<FloorClient />`, and was restyled in this pass (tinted green bar → small
  green indicator, plain type, blue link). Photographing it needs the real
  authed page, which the throwaway route cannot mount.
- **The action strip in its enabled state.** It is shown disabled with its
  reason ("Pick a table first."), which is the state the handoff README asks
  for; the enabled state opens a dialog and is not a still.
