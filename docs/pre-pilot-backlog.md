# Deferred until the pilot

Things deliberately not built, each with the reason and the thing that should
make us pick it up again. The format follows `RELEASE-CHECKLIST.md`: a deferral
is only honest if it names the trigger that ends it.

Everything below item 0 is non-blocking. **Item 0 is blocking**, and it is at
the top because it is the only thing on this page that a pilot merchant would
hit on their first day.

---

## 0. BLOCKING — Surge cannot serve a merchant who does not use dollars

Found 16 Sep 2026 while comparing the register against TouchBistro, by asking
what a Sri Lankan restaurant would actually see. Not a competitor gap — they
have nothing to do with it.

**Verified, not inferred:**

- `businesses.currency` exists and Settings has a picker for it — offering
  **`["CAD", "USD"]`** and nothing else (`app/app/settings/tax-currency-form.tsx`).
  LKR is not selectable.
- `currency` is **never referenced** anywhere in `app/app/pos/page.tsx`,
  `register-client.tsx` or `tender-sheet.tsx`. The till does not know what money
  it is counting.
- The printed receipt hardcodes it: `money(n) => "$" + n.toFixed(2)` in
  `app/app/pos/receipt-template.ts`.
- `buildQuickAmounts` in `tender-sheet.tsx` hardcodes **2000 / 5000 / 10000**
  cents as the note values a guest might hand over. Those are a $20, $50 and
  $100 bill. LKR notes are 20 / 50 / 100 / 500 / 1000 / 5000 and a 5000-cent
  suggestion is meaningless.
- Roughly **40 files under `app/`** contain a hardcoded `"$"` literal.

**What works already:** the accounting section formats correctly with
`Intl.NumberFormat(..., { style: "currency", currency })`, and the iPad app has
a correct `money(n, currency)` helper — its callers just pass `"CAD"` as a
literal.

**Why this is not a half-fix.** Adding LKR to the picker while the register
still prints `$` is *worse* than today: a merchant would select their own
currency and then watch the till contradict it on every screen and every printed
receipt. Either the whole money-rendering path takes a currency or none of it
does.

**Shape of the fix:** one `formatMoney(amount, currency)` in
`@surge/api-contracts` (both clients need it, and the delivery-channel and
stool-seat precedents say shared money logic belongs there), `business.currency`
plumbed from `pos/page.tsx` through the register to the tender sheet and the
receipt, note values driven by currency rather than hardcoded, and the picker
opened up. The 40 `"$"` sites are then mechanical.

**Trigger: passed.** The stated next move is a Sri Lanka pilot. This is due
before the first non-CAD merchant sees a till, not after.

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

## 6. Pre-assigning a server to a table before anyone sits

**Status:** confirmed gap, needs a migration.

TouchBistro's long press on a *vacant* table offers exactly one thing —
"Transfer Table To Staff" — so a manager can hand out tables at the start of a
shift before a single guest arrives. Surge shows no menu at all on an empty
table.

**Why it is not a UI fix.** Staff attribution in Surge lives on the *check*
(`open_tickets.staff_id`), and an empty table has no check. `floor_elements` has
no staff column, so there is nowhere to put the answer. It needs either a column
on the element or a `table_assignments` table keyed by shift date — the same
shape `section_assignments` already uses, which is the argument for doing it as
a sibling of that rather than inventing a second pattern.

**Also worth deciding at the same time:** whether a per-table assignment should
beat the section's assignment when a check opens, or only fill in where no
section server exists. Today `openTableTicket` reads the section. Two sources of
truth for the same question is how that function starts getting confusing.

**Trigger:** a pilot restaurant that runs sections properly, or the first
operator who asks why they cannot hand out tables at pre-shift.

## 7. Pre-assigning a reservation to specific tables

**Status:** confirmed gap, smaller.

Their booking form has "Specify Tables", which opens the whole floor plan as a
multi-select picker — a booking can name the tables it will use, bar stools
included, at the time it is taken. Surge's reservations carry an `element_id`
but it is set when the party is seated, not when the booking is made.

**Trigger:** any pilot that takes bookings by phone. A host writing "the corner
booth" in the notes field is the workaround, and the moment we see that we
should build the picker.

## 8. SPF verified end to end

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
