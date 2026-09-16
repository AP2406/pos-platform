# Deferred until the pilot

Things deliberately not built, each with the reason and the thing that should
make us pick it up again. The format follows `RELEASE-CHECKLIST.md`: a deferral
is only honest if it names the trigger that ends it.

Nothing here is blocking. If an item ever becomes blocking, it moves out of this
file and into the work.

---

## 1. TouchBistro's "Table Code"

**Status:** we do not know what it does.

It sits in TouchBistro Pro's element Properties popover alongside Table Name,
Seats and Section (Pro 11.55.0, seen 16 Sep 2026). It is **undocumented**: the
exact phrase returns zero results across their entire public knowledge base, and
their Chapter 6 floor-plan article lists only Table Name / Seats / Section, so
the field is newer than their docs.

**Best inference, not established fact.** It is a second identifier separate
from the display name, and a second per-table identifier in a POS usually exists
so something *outside* the POS can address the table — a pay-at-table terminal,
a QR / order-at-table link, or an integration mapping.

**Trigger:** tap Table Code on a table in the app and read what the field asks
for. Numeric-only suggests a terminal or guest entry code; free text suggests an
integration key. Five seconds on a device we already have.

**Why it may not matter.** Surge already solves the problem that reading points
at: Settings → Guest ordering prints a per-table QR resolving to
`/order/{businessId}/{elementId}`, and a guest scanning it adds items to that
table's check. A typed short code buys exactly one thing over a URL — a guest
whose camera will not scan can key it in — which is a real but small
accessibility case. If we build it, it belongs as a **fallback to the QR**, not
as a new identity field on the element.

## 2. "Reset" on a floor element

**Status:** understood, judged low value.

Their own Chapter 6 doc: "to reset the table to the original defaults." So it
reverts name, seats and section to the defaults a freshly added table gets.

**Why deferred:** Surge's editor has undo-by-not-saving (changes are local until
Save) and Delete. Reset sits between the two and earns very little. Duplicate,
the other action in that group, we did build — theirs warns you to configure the
properties *before* duplicating; ours copies seats and section, so that trap
does not exist for us.

**Trigger:** an operator asks for it, or we see someone rebuild a table by hand
because they could not revert one.

## 3. Print bill / Print all on one bill, from the floor

**Status:** deliberately absent from the table options menu, though TouchBistro
has both rows there.

**Why deferred:** a bill has to price discounts, comps, service charge and tax,
and only the register holds the live cart. A menu row that looks like a button
and is not one is worse than no row. Today it is one tap further: Open check →
Bill.

**Trigger:** move the bill-rendering path out of `register-client` into
something the floor can call, and this becomes cheap. Not worth doing on its
own; worth doing if the bill path is being refactored anyway.

## 4. Non-owner role runtime test, and a staging project

**Status:** deferred in `RELEASE-CHECKLIST.md`; repeated here so it is not lost.

Every account on production is an `owner` (11 of 11), so the role boundary has
no live exposure, and there is no staging Supabase project to test against
(building one is ~100 migrations plus seed data).

**Trigger — either one:** a non-owner account is about to be created on
production, or a merchant other than us starts using the dashboard. **A pilot
restaurant trips both.** This is the item on this page most likely to stop being
deferred first.

## 5. The demo floor is not a restaurant

**Status:** known, unbuilt.

Lakeview Bistro's floor has 7 elements. Every demo, screenshot and marketing
frame starts from it, and a board of a handful of tables reads as a prototype
next to TouchBistro's 24-table demo room — which is a difference in *seed data*,
not in what either product can draw, but a prospect cannot tell those apart.

Now possible and not yet done: a bar with numbered stools (`e6d89fa`,
`c31946f`), party names on the tiles (`72e39c9`), sections assigned from the
element (`72e39c9`).

**Trigger:** the next time anything is demoed or screenshotted. This is cheap
and it is the highest-leverage item on the page.

## 6. SPF verified end to end

**Status:** record fixed in Hostinger DNS; never confirmed against a real
delivery.

**Trigger:** the first real demo booking from a Gmail address. Check the
received headers for `spf=pass` rather than assuming the record is right because
the record looks right.

---

## Not on this list, on purpose

Features we chose against rather than postponed, so nobody re-opens them as
oversights:

- **Blocking the floor with an end-of-day modal.** TouchBistro does; we show a
  banner. A server ringing a drink should not meet a wall about last night's
  paperwork, and a modal whose safe answer is "Cancel" teaches everyone to
  dismiss modals.
- **Close Table on a check with items rung.** `closeTableTicket` deletes the
  check outright. Offering it on a check with items would destroy unpaid items
  with no void and no audit line. It appears only on an empty check, by design.
- **Deleting fired items from the floor.** Cooked food is a comp or a void with
  a reason code. That lives in the register and should stay there.
