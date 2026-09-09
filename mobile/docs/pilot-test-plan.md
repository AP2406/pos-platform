# Pilot test plan — iPad app

What has to be proven on real hardware, with real people, before Surge runs a
service for a friendly restaurant. `npx vitest run` and a clean typecheck are
table stakes; none of the scenarios below can be unit-tested. Run them with two
iPads, one kitchen screen and a printer on the same Wi-Fi, against a staging
business — **not** Demo mode (Demo mode never touches the API).

Mark each row Pass / Fail / Not built, with the build number.

## A. Readability on the device (not the Simulator)

| # | Check | Target |
| --- | --- | --- |
| A1 | Table name, state, guests·server, total and elapsed readable at arm's length on the Floor | title ≥ 16pt, metadata ≥ 13pt |
| A2 | Kitchen notes ("One medium, one well done") readable from the pass | ≥ 15pt |
| A3 | Menu tile name + price readable while walking | name ≥ 15pt, price ≥ 14pt |
| A4 | Every tap target on register/KDS ≥ 44pt; primary CTAs ≥ 56pt | — |
| A5 | 60-item menu: density acceptable to a server who has used it for 10 minutes | ask them |

## B. Two devices, one check

| # | Scenario | Expected |
| --- | --- | --- |
| B1 | Two iPads open the same table at once; each adds an item and sends | Both sets of items reach the kitchen once; the check shows all of them on both iPads after refresh |
| B2 | Server A sends; Server B (still on the old cart) sends the same unsent line | No duplicate kitchen ticket; second sender sees the merged check |
| B3 | Kitchen bumps a ticket while the server is moving an item to another table | Floor shows the correct stage for both tables |
| B4 | Host seats a waitlist party onto a table that already has an open check | Blocked or merged deliberately — never two checks on one table |
| B5 | Manager and server both edit a line's seat/discount | Last write wins visibly; no silent loss |

## C. Edits after send

| # | Scenario | Expected |
| --- | --- | --- |
| C1 | Server changes quantity of a sent item | Kitchen sees the delta (re-fire or void notice), never a silent change |
| C2 | Server removes a sent item | Requires manager; kitchen receives a VOID notice |
| C3 | Modifier change on a sent item | Same as C1 |
| C4 | Item moved to another table after being fired | Kitchen ticket follows or a re-fire is issued |

## D. Failure paths

| # | Scenario | Expected |
| --- | --- | --- |
| D1 | App killed mid-order (unsent items) and reopened | Unsent items are either restored or clearly gone — never half-saved |
| D2 | Wi-Fi drops during "Send to kitchen" | Clear failure, nothing marked sent, retry works without duplicates |
| D3 | Printer offline when a chit should print | Fire still succeeds; a visible "didn't print" notice; reprint path exists |
| D4 | Kitchen screen loses connection for 5 minutes | Catches up on reconnect; no ticket lost |
| D5 | Metro/API host unreachable (staging outage) | Reads still work; writes fail loudly; no fake success |
| D6 | Payment started on the external terminal, iPad loses connection | "Payment needs verification" — no automatic retry, no double charge |

## E. Roles and permissions

| # | Scenario | Expected |
| --- | --- | --- |
| E1 | Server tries a comp/discount override/void/refund | Blocked with manager PIN prompt; logged |
| E2 | Server opens Orders | Sees View, not Mark ready |
| E3 | Host-station iPad | Floor + reservations only |
| E4 | Kitchen-station iPad | KDS only; never auto-locks |
| E5 | Staff member clocks out with open tables assigned | Warned; tables remain visible to managers |
| E6 | Idle iPad on the counter for the configured auto-lock time | Returns to PIN pad; reload during a shift does not |

## F. Data hygiene and tenancy

| # | Scenario | Expected |
| --- | --- | --- |
| F1 | Duplicate customer phone/email | Surfaced or merged; never two profiles silently |
| F2 | Second location on the same account | No cross-location customers, orders, settings or reports (RLS) |
| F3 | Reservation seated → open check | Guest name/party carried onto the check |
| F4 | Check partially paid, then reopened | Balance and payment records stay correct |
| F5 | Table moved or merged | Totals, seats and kitchen tickets follow |

## G. Not built yet (don't demo as working)

- Card payments from the iPad (semi-integrated terminal: send amount → await
  approved / declined / cancelled / timeout → close check).
- Manual external-terminal payment recording and reconciliation.
- Hold check, Void, Comp, check-level discounts, refunds — need money-write
  endpoints, role checks, reason codes and an audit log first.
- Re-fire / kitchen update on edits after send (C1–C4).
