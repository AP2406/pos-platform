# Surge POS — Pilot Tester Guide (one page)

Thanks for testing the Surge POS iPad pilot. It runs the **entire front-of-house
workflow except payments**. Your job: run real service flows and tell us what
feels off. **No real card is ever charged in this build.**

Best on an **iPad in landscape**.

---

## 1. Sign in
1. Open **Surge POS** (from TestFlight).
2. Enter your **email + password** (the Surge login we gave you).
3. Pick your **business/location**.
4. Enter your **staff PIN** (4–6 digits) to start a shift on the device.

**First-time device setup** (owner/manager): tap **More → Device settings** to name
this iPad, set its **Station** (Server / Kitchen / Bar / Host / Owner-all — this
controls which screens the device shows), and its **default room**.

## 2. What works — please exercise these
- **Floor** — tap a table to open it; watch the status/aging colors (green under
  ~1h, amber, red past ~90 min). Switch rooms; try the List view.
- **Register / order entry** — browse the menu (categories on the left, tap a tile
  for details, or the **+** to quick-add). Add an item with **required options** or
  **sizes** (the picker blocks until you choose). Try **coursing**, **per-seat**
  ordering, **seat names**, **allergen tags**, and an **upsell** prompt.
- **Scan to add** — on the Register tap **Scan**. Point the camera at a product
  barcode, or **type/paste** a code in the field (also works with a USB/Bluetooth
  wedge scanner). Demo codes seeded on the Aathy Bistro menu you can type:
  `049000000443` → Soda (a real Coca-Cola can UPC — a physical can scans too),
  `010000000108` → Burger, `020000000206` → Fries. An unknown code shows
  "No item for …".
- **Send to Kitchen** — fire the order; confirm it appears on the **Kitchen**
  display, then **bump** it; check it in the **Orders** hub and **Mark ready**.
- **Tickets / Sales** — open a past sale → full detail (timeline, items by seat,
  totals). Try **Reprint** (see note below).
- **Customers** — search, open a profile (balances, order history, account ledger).
- **Reservations / Waitlist** — add a walk-in, page a guest, seat/cancel.
- **Time clock** — clock in/out, start/end a break.

## 3. Intentionally OFF (not bugs)
- **Payments** — **Charge** is greyed with a 🔒 "Payments coming soon"; tapping just
  explains. **Split** opens a per-seat *preview* only — finalizing a split is
  disabled. Discount / Comp / Tax-exempt verify permissions but don't apply yet.
- **Printing** — **Reprint** and kitchen chits are prepared but **not physically
  printed** (no printer is bound to this build). You'll see "printing not enabled
  in this build yet."

## 4. What to report
Use **TestFlight's built-in feedback**: screenshot → annotate → send. Please note:
- **Which screen** and **what you tapped**, and what you expected vs. saw.
- Anything mislabeled, cut off, slow, or that makes the app feel "not one product."
- If you see a red **"Can't reach the Surge API"** banner, note roughly when.

Don't report: payments or printing being disabled — that's by design for the pilot.

---

*Questions or a blocking issue? Contact your Surge pilot lead.*
