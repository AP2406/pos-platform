# Floor plan: Surge vs TouchBistro Pro

Captured 16 Sep 2026 from a single iPad (iPad 9th gen, iOS 18.7.8) for
TouchBistro Pro 11.55.0 "Demo Restaurant", and from the iPad simulator in demo
mode for Surge "Lakeview Bistro". Both are the vendor's own demo data.

**Read the caveat before quoting any of this.** TouchBistro's demo room has 24
tables plus 8 bar seats; Lakeview Bistro has 5 tables, 2 booths, a host stand and
a bar. That is a difference in our seed data, not in what either product can
draw. Anything below about density is not a product claim.

---

## What each tile tells a server

| | Surge | TouchBistro Pro |
|---|---|---|
| Table name | yes | yes |
| Seat count when free | yes — "6 seats" above "AVAILABLE" | yes — "4 Seats" |
| Server | yes (`Sam`, `Alexis`, `Marco`) | yes (`Johnson`, or a server number) |
| Covers | yes (`2 guests`) | yes (`: 4`) |
| Check total | yes | yes |
| Time at table | yes | yes |
| **Written state** | **yes — OPEN / SENT / PAYMENT DUE** | no — colour only |
| **Kitchen progress** | **yes — SENT, READY** | no |
| **Lateness, named** | **yes — `LATE 17M`, `LATE 48M`** | no — raw elapsed only |
| **Legend** | **yes, always on screen** | none |

## The three differences that actually matter

**1. TouchBistro has no legend.** Magenta means occupied and navy means free, and
nothing on the screen says so. A new server is told once, by a person. Surge
prints the key along the bottom — Available / Open / Sent / Ready / Payment due,
plus what "over 45 min" and "late" mean in minutes. On a floor with staff
turnover that is a training cost TouchBistro quietly pushes onto the operator.

**2. Surge shows kitchen state on the floor; TouchBistro does not.** A Surge tile
says whether the food has been fired and whether it is ready. TouchBistro's floor
plan shows money and time, so "has table 207 been served?" means leaving the
screen. This is the single most defensible functional gap in our favour.

**3. TouchBistro names the threshold; Surge names the breach.** They print raw
elapsed time and leave the judgement to you. We print `LATE 48M` against a stated
75-minute rule. Ours is more opinionated and more useful to a manager walking the
room; theirs is more neutral. Reasonable people differ — but ours needs no
interpretation.

## Where TouchBistro is genuinely ahead

- **Bar seats are individual, addressable positions** (100–107) with their own
  state. Surge draws one "Bar" block, so a bar tab is not a seat on the map.
  This is real and worth building.
- **The room reads like a room.** Curved wall, plants, a cash register marker,
  tables placed to reflect a real layout. Surge draws a tidy grid in zones.
  Skeuomorphism is out of fashion and it is still easier to recognise your own
  dining room in their picture than in ours.

## The thing worth noticing about their demo

Every occupied table in TouchBistro's demo shows an impossible timer:

```
TABLE 201   Johnson: 4    1,654h 37min    $85.81
TABLE 200   Smith: 3      1,654h 37min    $120.84
TABLE 203   23: 16          73h 14min      $34.02
```

1,654 hours is sixty-nine days. Their shipped demo has been sitting on stale
seed data long enough to be absurd, and nobody caught it.

**Do not use this as a talking point.** Surge's own floor plan was showing
`LATE 208H` this morning for exactly the same reason, and demo staleness says
nothing about either product. It is here as a reminder that a demo is a shop
window: the first thing a prospect sees is whether the numbers look like a real
Wednesday. Ours now do, because demo mode builds timestamps relative to when it
starts. Theirs do not.

## What to do with this

The honest positioning is not "our floor plan is better" — on density and room
realism theirs reads stronger, and a prospect will see that. It is:

> Surge's floor plan tells you what the kitchen is doing and what counts as late.
> TouchBistro's tells you who is sitting where and how much they owe.

That is a real difference in what the screen is *for*, and it stands up to
someone who has used both. It also has nothing to do with the contract and
processing-lock-in argument in `docs/competitor-positioning.md`, which remains
the stronger commercial case.

## Gaps this opens on our side

1. ~~Individual bar seats as addressable positions on the map.~~ **Done** —
   `e6d89fa` draws and numbers them, `c31946f` makes them hold a check.
2. Lakeview Bistro's demo floor needs building out — 7 elements is not a
   restaurant, and every demo and screenshot starts from it.

### Bar stools, 16 Sep 2026

Worth writing down because the gap was not where it looked.

Both live floors — `app/app/pos/floor-client.tsx` and `mobile/app/floor.tsx` —
were **already** written to draw a counter's seats as stools at their real
positions along the bar, with their number printed on them, and mobile already
colours a stool by whether a check is open against it. None of it had ever run,
because the **editor** listed only `table` and `booth` as things you can give a
seat count to. A counter therefore never got a single child seat, so there was
nothing for either floor to draw. The feature was three-quarters built and
unreachable.

What was actually missing:

- `SEATABLE` in `app/app/settings/floor-card.tsx` did not include `counter`.
- Geometry. `chairPositions` wraps a rectangle on four sides, which is right for
  a table and wrong for a bar — run over a 220×40 counter it seats two guests on
  the short ends and a row *behind* the bartender. `stoolPositions` lays them in
  one row along the long edge instead, and `seatPositions` picks between the two
  by parent kind. Tested in `tests/unit/floor-seats.test.ts`, including a test
  that pins the old wrapping behaviour so nobody collapses the two back together.
- Numbering. Stools are labelled from 101, continuing across a second bar rather
  than restarting, so two bars on one floor can never both own "103".

### Second pass, 16 Sep 2026 — the layout editor and the two action menus

Eight more screenshots: their layout editor, the seating dialog, the long-press
table menu, and the Admin menu. Feature by feature, against what we actually
have rather than what the earlier version of this document assumed.

**Closed in `72e39c9`:**

| Their feature | What we had | What we shipped |
|---|---|---|
| Party Name + Party Size at seating, tile reads "Johnson: 4" | guest count only, in a number field; tile showed the server | name + a 24-target tap grid; tile reads "Okafor · 4 guests"; find-a-check searches the name |
| Rename Party… | nothing | `renameParty`, on the table's options menu |
| Long-press → Options for Table | a strip with a dropdown to re-pick a table you had already touched | press-and-hold (or right-click) any tile; the strip survives as one keyboard-accessible button |
| Section on the element's Properties | only the separate Server sections card | both; the element is where the decision is made |
| Duplicate | nothing | copies the element and its seats, next free table number |

Two of theirs we chose **not** to copy. *Print Preview* and *Print All On One
Bill* need the live cart — a bill has to price discounts, comps, service charge
and tax — and the register is what holds it; a menu row that looks like a
button and isn't one is worse than no row. *Close Table* / *Delete All Items &
Close Table* exist server-side (`closeTableTicket`, `discardTicket`) but are
money-path and get their own change.

**Closed in `c31946f`:**

- **Transfer Order to Tab** → `transferTicketToTab`. The cart is untouched and
  the row keeps its id, so a pre-auth, a split or a fired chit that already
  points at the check still does; kitchen tickets are re-pointed off the element
  onto the tab's name so a chit on the rail does not end up naming a table
  someone else is now sitting at.
- **Close Table / Delete All Items & Close Table.** Split by what is safe.
  "Close table" only appears on a check with nothing rung — `closeTableTicket`
  deletes the check outright, so pointing it at one with items would destroy
  unpaid items with no void and no audit line. "Delete all items & close" uses
  `discardTicket`, which already requires `delete_item_prepay`. Once anything is
  fired, neither appears and the row says why: a comp or a void needs a reason
  code and lives in the register.
- **End of Day warning** → an amber banner, not their blocking modal. A server
  ringing a drink should not meet a wall about last night's paperwork, and a
  modal whose safe answer is "Cancel" teaches everyone to dismiss modals. It
  stays silent for a business that has never closed a drawer — a card-only shop
  is not behind on anything, and a banner every shift trains the floor to ignore
  banners. `lib/services/day-open.ts`, thresholds tested.

**Still open:**

- **Table Code.** Still unresolved. Their public floor-plan documentation does
  not describe it and their help centre renders client-side, so a fetch returns
  an empty shell. Not building a guess at a field in a POS — find out first.
- **Reset** on an element. Semantics unclear from a screenshot alone.

Worth recording about their build: two of the eight screenshots are error
states — a cloud auth failure whose only control is "Dismiss", and the stale
end-of-day warning. Neither is a product claim about TouchBistro and neither
belongs in a pitch.

**Closed in `c31946f`:** stool 103 holds its own check on both floors. It stays
stool-sized rather than becoming a table tile — eight bar seats drawn as eight
four-tops would misrepresent the room — and it does not replace the named bar
tab. They are different shapes for different guests: a stool check for someone
sitting at 103, a tab for someone who moves around, optionally with a card held.
`transferTicketToTab` is the bridge between them.

### Correction, 16 Sep 2026
The first version of this document claimed Surge does not show seat counts on
available tables. It does — the tile reads "6 seats" above "AVAILABLE", which is
the same fact TouchBistro prints as "4 Seats". The claim was wrong, it was
written into a sales-facing comparison, and it was caught by re-reading our own
screenshot rather than by anyone challenging it. Check the picture before
writing the row.

---

Side by side: `docs/floorplan-vs-touchbistro.png`
