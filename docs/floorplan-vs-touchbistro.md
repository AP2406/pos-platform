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

1. ~~Individual bar seats as addressable positions on the map.~~ **Half done —
   see "Bar stools, 16 Sep 2026" below.** A bar can now be given numbered
   stools and both floors draw them. Opening a check *on* a stool is still to do.
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

**Still missing:** a stool is not ringable. `RINGABLE` is `["table", "booth",
"counter", "station"]` on web and `["table", "booth"]` on mobile, and neither
includes `seat`, so you can open a check on *the bar* but not on *stool 103* —
which is the thing TouchBistro actually does. That is a change to check-opening,
i.e. a money path, and it gets its own commit rather than riding along with a
layout change.

### Correction, 16 Sep 2026
The first version of this document claimed Surge does not show seat counts on
available tables. It does — the tile reads "6 seats" above "AVAILABLE", which is
the same fact TouchBistro prints as "4 Seats". The claim was wrong, it was
written into a sales-facing comparison, and it was caught by re-reading our own
screenshot rather than by anyone challenging it. Check the picture before
writing the row.

---

Side by side: `docs/floorplan-vs-touchbistro.png`
