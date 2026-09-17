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

## Where Surge is ahead, from the same pass

- **Reservations are built in, not an upsell.** Waitlist count and the next
  booking show on the floor toolbar itself.
- **Their reservation form has no discard.** Tapping Done on the table picker
  commits the record; there is no cancel that undoes it. Surge's dialogs cancel.
- **Floor switching is visible.** Surge draws plan tabs in the toolbar; theirs
  is a button you have to know to press.
