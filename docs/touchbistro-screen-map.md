# TouchBistro Pro 11.55.0 — screen map

Built by driving the iPad directly rather than reading screenshots, so the map
includes affordances that are invisible in a picture: which labels are actually
buttons, what only appears on a long press, and which controls are disabled.

Device: iPad, iOS 18.7.8, TouchBistro Pro 11.55.0, "TouchBistro Demo Restaurant".

## How to pick this up again

The hard part was getting a UI driver attached. It works, and it takes about a
minute to restore:

```bash
# 1. iPad plugged in and unlocked. Confirm it is seen:
pymobiledevice3 usbmux list           # → 00008020-000508120EF3402E

# 2. Appium (already installed at ~/.appium, xcuitest driver 11.17.3):
npx appium server --port 4723 --relaxed-security

# 3. Session (helpers in /tmp/tbdrive.py, /tmp/tbhelpers.py, /tmp/tbpage.py):
python3 -i
>>> exec(open('/tmp/tbdrive.py').read()); start()
>>> exec(open('/tmp/tbhelpers.py').read()); exec(open('/tmp/tbpage.py').read())
>>> page('name')        # screenshot + every actionable element with coordinates
>>> tap(x, y) / hold(x, y, 1400) / swipe(...) / tapt("text") / holdt("text")
```

Notes that cost time the first go:

- **A sudo RemoteXPC tunnel is not needed.** DVT answers over plain lockdown on
  this device; `pymobiledevice3 developer dvt ls /` returning `/cores` is the
  check.
- **Launching `com.aathis.WebDriverAgentRunner.xctrunner` directly does nothing
  useful.** The process starts and exits — an `.xctrunner` app needs
  `testmanagerd` to host the XCTest bundle. Appium does that; a bare DVT launch
  does not.
- Session creation takes ~35s. `noReset: true` and no `app` capability, so the
  demo data is never touched.

## Floor plan — the landing screen

Every table and every bar stool is a `Button` with accessibility id
`floorPlanScreen.elementById.<name>`, confirming bar seats are first-class
addressable positions and not decoration.

| Control | Where | Type | What it does |
|---|---|---|---|
| Menu / Orders / Register | top left | tap | primary navigation |
| Reservations | top right | tap | reservations modal |
| Admin | top right | tap | admin menu |
| a table | canvas | tap | seat it / open its check |
| a table | canvas | **long press** | Options for Table |
| a bar stool | canvas | tap / **long press** | identical to a table |
| `Admin: Switch` | bottom left | tap | **logs the app out** — see warning |
| `TouchBistro Pro \| Main Floor` | bottom centre | tap | Select Floorplan |
| `Main Device` | bottom right | tap | device info |
| ⓘ More Info | bottom right | tap | device info |

> **`Admin: Switch` is not a menu.** It drops straight to the staff passcode
> lock screen with no cancel, and the app is locked until someone keys a
> passcode. Do not tap it while mapping unless the passcode is to hand.

### Options for Table — long press

The menu differs by state, which a screenshot of one table will not tell you:

**Occupied** (8 rows): Print Preview · Transfer Table To Staff… · Transfer
Entire Party · Rename Party… · Print All On One Bill · Transfer Order to Tab ·
Delete All Items & Close Table · Close Table

**Vacant** (1 row): Transfer Table To Staff…

**Bar stool** (1 row vacant): identical to a vacant table.

### Select Staff — from "Transfer Table To Staff"

The detail worth having. The list is **grouped**, not alphabetical-flat:

```
Section Default (Chris)      ← the section's server, offered explicitly
CLOCKED-IN
  Admin
CLOCKED-OUT
  Alex, Bhavin, Bruce, Chris, Crystal, Darko, Derek, James, …
```

## Reservations

The built-in reservations list is thin and carries an upsell — "New TouchBistro
Reservations is available / Learn More". The real product is a separate module.

| Control | Type | Notes |
|---|---|---|
| ＋ | tap | new reservation |
| Show Only Today | switch | filter |
| a reservation row → ⓘ | tap | sheet: **Transfer to Table** · **Edit Info** |
| a reservation row | swipe left | delete |

**New reservation form:** Party Name · Telephone # · Email · Notes · **Specify
Tables** · date picker (day / hour / minute / AM-PM) · party size picker.

- **Specify Tables** opens the whole floor plan as a picker — "Select Tables for
  the Reservation" — so a booking can be pre-assigned to one or more specific
  tables, bar stools included, at booking time.
- It validates first: party name and telephone are required before you can pick
  tables.
- **Tapping Done on the table picker SAVES the reservation.** There is no
  discard; backing out of the form afterwards leaves the record behind.

### The eight rows, opened

| Row | What it actually is |
|---|---|
| Print Preview | full bill: address block, order #, `Table: 201, 4 guests`, **`Party Name: Johnson`**, line items, **Food Total / Alcohol Total**, Sub Total, Tax 1, Total, footer |
| Transfer Table To Staff… | the grouped Select Staff list above |
| Transfer Entire Party | **"Select a Table for the Party"** — the floor plan becomes the picker |
| Rename Party… | one text field + Save |
| Print All On One Bill | un-split print |
| Transfer Order to Tab | bare confirm: "Move Table to Tab? Are you sure…" — Cancel / Continue. **No name is asked for** |
| Delete All Items & Close Table | not opened |
| Close Table | not opened |

### Seating a table — tap a vacant one

`addPartyScreen`: a name field, a 24-cell party-size grid
(`newPartyButtonBySeatCount.1` … `.24`) and "Add to Table".

**The grid arrives with the table's own seat count already selected**, so a
four-top seating four is one tap. Ours starts with nothing selected.

## Floors

`TouchBistro Pro | Main Floor` at the bottom centre opens "Select Floorplan":
Main Floor, Second Floor. The second floor holds tables 600–609 and stools
500–503 — the hundreds digit encodes the floor, which is convention rather than
a feature, but it is how their demo keeps 24 tables legible.

## Main Device — the ⓘ at the bottom right

Not a gap. An architecture disclosure, and the most useful thing found all
session:

> "This iPad is the main device. It is where important POS data is kept within
> the TouchBistro system, including financial, staffing and menu information.
> **Never remove this device from your venue during service. Doing so will
> prevent TouchBistro from functioning.**"

TouchBistro Pro designates one iPad as the store of record; the others are
clients of it. That is a single point of failure that has to physically stay in
the building, and it is their own wording, on their own screen, not a claim we
are making about them. Surge has no main device — every till is a client of the
same cloud, and losing one loses nothing.

Worth keeping for positioning. Worth **not** overstating: a local main device is
also why their floor keeps working when the internet drops, which is a real
trade and the honest version of this comparison says so.

## Order screen — tap an occupied table

The densest screen in the app, and the one worth the most attention.

**Top bar:** Back · Search · View · UPC · `Table: 201` · Course · Edit · Send ·
Checkout

**Menu periods as tabs:** Full Menu / Breakfast / Lunch / Dinner, over a
photo-tiled category grid (Drinks, Appetizers, Breakfast, Lunch, Mains,
Specials, Desserts).

**The check, grouped by seat and colour-coded.** "Shared Order For Table 201",
then `Seat 1` in navy with its three lines, `Seat 2` in amber with its three,
each seat header carrying an ⓘ for seat properties. Then "Order Summary:
Johnson" with **Food $58.96 / Alcohol $16.98** / Sub-Total / Tax 1 / Total.

**A live seat map in the middle of the screen.** A miniature of the table with
numbered circles round it — 1 navy, 2 amber, 3 blue, 4 orange — and **the circle
colours match the check groupings above**. Tap a circle to choose whose order
you are taking. A `+` adds a seat, and the hint reads "Swipe to combine seats".
The section name ("Inside") and order number sit in the corners.

That colour tie between a physical position and its lines on the check is the
best single idea on the screen, and it costs them nothing.

**Bottom quick-tender bar:** Exact · **$86 · $90 · $100** · Cash · Debit ·
Credit · Tab · No Sale (disabled) · Print · Takeout · Delivery. The three dollar
amounts are the next round notes above the $85.81 total.

### Checked against Surge — almost all already present

Per-seat ordering with seat names, menu dayparting (migration 0075), courses,
barcode scanning, No Sale, quick cash amounts *with* an "Exact" button — all
shipped. Surge additionally has price windows, upsell prompts, service charges,
split settings and device profiles, which this screen has no equivalent of.

Two real differences:

- **Their seat map.** Surge has seat tabs; they have a diagram that matches the
  room. Worth considering, not urgent.
- **Our quick amounts skip the next-dollar-up.** `buildQuickAmounts` rounds to
  the next $5 and $10 and then offers flat $20/$50/$100, so an $85.81 total
  gives Exact / $90 / $100 where theirs gives Exact / $86 / $90 / $100.

And one thing this screen surfaced that has nothing to do with TouchBistro: the
hardcoded dollar values in `buildQuickAmounts` led to
**`docs/pre-pilot-backlog.md` item 0** — Surge's register does not know what
currency it is counting. That is now the blocking item on that page.

## Checkout — the Checkout button on the order screen

Left column of options over a live bill preview. The preview adds two lines the
order screen does not show: `Party Name: Johnson` and `Admin: Admin` (the server).

| Group | Rows |
|---|---|
| Options | All on One (ticked) · Split by Seating · Split Evenly by # |
| Adjustments | Include Gratuity · Discount/Comp All Items · Tax Exclusion · Add Note |
| Payment Options | Cash · Non-Integrated Payments · Pay on Account · Chase Pay · Edit / Undo Payments |
| Receipt Options | Print Bill to Receipt Printer · Reprint Credit Card Slips · Close Table |
| Header | **Open Cash Drawer** |

### Checked against Surge — this one goes our way

Every row above has a Surge equivalent, and several are richer:

- **Split by seating** and **split evenly by #** — both present, plus per-item
  seat sharing ("which seats are sharing this item") and two settlement modes
  (each seat paid separately, or one payment itemised per seat).
- **Tax Exclusion** → `tax_exempt` with `TAX_EXEMPT_REASONS` and a customer-level
  exemption flag. Theirs is a row; ours carries a reason code.
- **Include Gratuity** → service charge / auto-gratuity that auto-applies by
  party size, with a waive path, reason codes and manager approval.
- **Pay on Account** → house accounts, with the remaining balance enforced.
- **Reprint** → `ReprintButton`, from the sale's stored snapshot.
- **Discount/Comp All Items** → both, with reason codes.

**The one real gap was Open Cash Drawer**, and fixing it turned up something
worse — see below.

## The thing the cash-drawer button uncovered

Wiring "Open drawer" into the register meant reading `recordCashMovement`, and
its authorization block was wrapped in `if (kind !== "no_sale")`. So a no-sale —
the action that physically opens the till with **no transaction to account for
it** — was the only cash movement in the system requiring no permission and no
approval. Pay-in, pay-out and drop were all gated.

The intent had been written down and never wired up. `no_sale` is a declared
`PermissionKey` with its own label, a declared approval action in the config
registry, and `DEFAULT_ROLE_PERMISSIONS` grants it to owner, manager and
shift_lead while deliberately withholding it from server, host and bookkeeper.
Every part of the design existed except the line that enforces it — so a server
could open the cash drawer while the permissions screen said they could not.

Gated now, on its own key rather than borrowing `open_drawer` (the two are
separately grantable by design), and pinned by `tests/unit/no-sale-guarded.test.ts`.

Worth noticing that this is the same shape as the currency bug found an hour
earlier: a setting that existed, had a UI, and was read by nobody. Two in one
session suggests it is a pattern worth looking for on purpose rather than
stumbling into.

## Staff lock screen — `Admin: Switch`

Numeric passcode pad, plus:

- **QR icon** — scan a staff badge instead of typing a passcode.
- **Clock In/Out** — clock in or out without logging in first.
- **View menu** — browse the menu while logged out.
- Status line: `Main Device • iPad • Running 10h • BELL303, 192.168.2.182 •
  11.55.0` — device role, uptime, network, IP and app version on one line.

---

# Diff against Surge

## Closed in this pass

**Staff picker had no idea who was working.** Surge listed every active staff
member in one flat alphabetical list, so assigning a check to someone who went
home at four was exactly as easy as assigning it to the person in front of you.
`time_clock_entries` has known who is clocked in since migration 0019 — an open
row, `clock_out is null`, guaranteed unique per staff by a partial index — and
the floor had simply never asked. Now grouped **On shift** / **Off shift**, with
off-shift staff still listed because reassigning yesterday's check to whoever
actually served it is a real thing to need.

**No way back to the section's server.** Opening a check auto-attributes it to
whoever has that section today, but once someone changed it by hand there was no
route back to that answer. The assign dialog now offers **Section default**,
named, at the top — the same idea as their "Section Default (Chris)".

**The party name stopped at the floor tile.** We started taking a name at the
door in `72e39c9`, but opening the check threw it away: a to-go order has always
read "Takeout · Ana" and a bar tab "Tab · Jake", while a table check read
"Table 4". Their bill prints `Party Name: Johnson`, and a server handing over a
check should be able to read whose it is without walking back to the map. The
name now rides into the register header and, through `tableName`, onto the
printed bill.

## Checked and NOT a gap

Worth writing down, because both looked like gaps and building either would have
been duplicate work:

- **Food / Alcohol subtotals on the bill.** Their print preview splits them and
  ours appeared not to. It does: `showCategoryTotals` in the receipt settings,
  fed by `categorySubtotals`, driven by the `sales_category` column added in
  migration 0088. It ships **off by default**, which is the real finding — turn
  it on for any venue with a bar.
- **Multiple floors.** Theirs is a button at the bottom you have to know to
  press; ours draws plan tabs in the toolbar.

## Confirmed gaps, not yet built

- **Pre-assigning a server to a vacant table.** Theirs is the only row a vacant
  table offers. Surge shows no menu at all on an empty table
  (`pressHandlers` returns `{}` when there is no open check), and the deeper
  problem is that Surge has nowhere to put the answer: staff attribution lives
  on the *check*, and `floor_elements` has no staff column. Needs a migration,
  so it goes to the backlog rather than riding along with a UI change.
- **Pre-assigning a reservation to specific tables.** Surge's reservations carry
  an `element_id`, but it is set when seating, not when booking. Their flow
  turns the floor plan into a multi-select picker at booking time.
- **QR staff badge sign-in.** Surge is PIN-only.
- **Device status line.** Device role, uptime, network, IP and version in one
  place is a genuine support aid — the first question on any support call is
  "which iPad, on what network, running what version".
- **Party size pre-selected to the table's seat count.** One tap to seat a full
  four-top. Ours opens with nothing chosen. Small, and the kind of thing that
  only shows up by actually using the screen.
- **Transfer party picks the destination on the map.** Ours lists candidate
  tables in a dialog. On a busy floor, pointing at the table you mean is faster
  and harder to get wrong than reading a list of names.

## Where Surge is ahead, from the same pass

- **Reservations are built in, not an upsell.** Waitlist count and the next
  booking show on the floor toolbar itself.
- **Their reservation form has no discard.** Tapping Done on the table picker
  commits the record; there is no cancel that undoes it. Surge's dialogs cancel.
- **Floor switching is visible.** Surge draws plan tabs in the toolbar; theirs
  is a button you have to know to press.
