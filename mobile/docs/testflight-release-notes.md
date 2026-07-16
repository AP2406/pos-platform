# Surge POS — TestFlight release notes

Paste the **"What to Test"** section below into App Store Connect for each build.
Keep it short; the full guide is `pilot-tester-guide.md`.

---

## v0.1.0 (pilot build 1)

First Surge POS pilot for iPad. This build runs the **full front-of-house
workflow end to end — without payments**. Please test the flow, not the money.

**What's in**
- Floor map with live table status + aging colors (green → amber → red)
- Order entry: menu browse (categories, photos, item detail), quick-add,
  required/nested modifiers, coursing, per-seat ordering, seat names, allergen
  tags, upsell prompts
- Send/Fire to Kitchen → Kitchen Display (bump / recall) → Orders hub (mark ready)
- Tickets & sales history with full order detail
- Customers (profile, balances, order history), Reservations, Waitlist, Time clock
- Device settings: name this iPad, assign a station (Server / Kitchen / Bar / Host),
  default room, printer target

**Intentionally disabled in this build**
- **Payments** — "Charge" and "Split payment" show *"Payments coming soon"* and do
  nothing. No card is ever charged. This is expected.
- **Printing** — receipts/kitchen chits are prepared but not sent (no printer is
  wired to this build yet).

**Please report**: anything that looks broken, mislabeled, slow, or confusing —
via TestFlight's screenshot feedback. Payments/printing being off is not a bug.

**Known**: the Orders hub shows **today's** orders only (empty if nothing was rung
today). A red "Can't reach the Surge API" banner means the backend is unreachable —
note when it happens.
