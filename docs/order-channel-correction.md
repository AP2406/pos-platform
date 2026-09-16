# Order channel correction — what moves, and why

16 Sep 2026. Read this before shipping: it changes figures on a financial report
that twelve live businesses are already reading.

## The defect

`orders.channel` is free text with no enum and no CHECK. Migration 0074 writes a
delivery's **platform name** — `doordash`, `ubereats`, `grubhub` — and reserves
the literal `delivery` only as the fallback for platforms it does not recognise.
0071 writes `kiosk`, 0072 writes `online`, 0073 writes `qr`. A till writes NULL.

The classifier matched **by substring**:

```ts
if (c.includes("delivery")) return "delivery";
```

So the one value that matched was the fallback. Every real platform missed, and
so did kiosk, online and QR. They all fell through to the default — `in_store`.

**In-store has been absorbing every non-register channel.**

## It was wrong in four places, differently

This is the part worth pausing on. The same question had four implementations
and they disagreed, so the answer a merchant got depended on which screen they
opened:

| Screen | A DoorDash order showed as |
|---|---|
| `/app/reports` + admin home | **In-store** |
| `/app/orders` (web hub) | **Other** |
| `mobile/app/orders` (iPad) | **Dine-in** |
| `/app/insights` | DoorDash (correct — it never collapsed the value) |

The iPad one is the worst of the set: that is the screen a server reads during
service, and a delivery was presenting as a table.

## What changed

One shared list, in `@surge/api-contracts`, because the iPad app classifies
orders too and cannot import from `lib/`:

```ts
DELIVERY_CHANNELS = ["doordash", "ubereats", "grubhub", "delivery"]
```

Each screen keeps its own bucket model — the Orders hubs want Kiosk and QR as
first-class filter tabs, the reports split wants the five service types — but
none of them keeps its own opinion about what a delivery is.

**Naming:** `isDeliveryChannel` (this — values in `orders.channel`) is
deliberately *not* `isDeliveryPlatform`, which already exists in
`lib/services/delivery.ts` and answers a different question: which inbound
webhook senders we serve. That set includes `deliverect`, the aggregator that
fronts Uber Eats, DoorDash and Skip. `deliverect` never reaches `orders.channel`
— 0074 normalises it to `delivery` — so the two lists are correctly different.

`/app/insights` was not merged into this. It answers "which door did the order
come through", in money, per platform; the reports split answers "what kind of
service was this", in counts. Both are legitimate. What was not legitimate was
calling both "channel" and labelling both "In-store" while they counted
differently — so insights is now headed **By ordering surface** and its counter
bucket reads **Counter**.

## The mapping, before and after

| `channel` | `dining_option` | Before | After |
|---|---|---|---|
| `doordash` / `ubereats` / `grubhub` | — | In-store | **Delivery** |
| `delivery` | — | Delivery | Delivery *(unchanged)* |
| `kiosk` | — | In-store | **Takeout** |
| `online` | — | In-store | **Pickup** |
| `qr` | — | In-store | **Dine-in** |
| `doordash` | `takeout` | Takeout | **Delivery** *(precedence change)* |
| NULL | any valid | unchanged | unchanged |
| NULL | — | In-store | In-store *(unchanged)* |
| anything unrecognised | — | In-store | In-store *(see gap below)* |

Placement reasoning: 0072 calls its own flow "an online pickup order" (ordered
ahead, collected), 0071's kiosk tags a togo check placed on-premise, and 0073 is
guest-pay — someone at a table settling their own check. A third-party platform
now outranks `dining_option`, because a DoorDash order is a delivery however the
check was flagged on the way out.

**Direction of travel:** In-store only ever shrinks. Delivery, Takeout, Pickup
and Dine-in only ever grow. No money changes and no order changes — only which
bucket each one is counted in.

## Known gap, left deliberately

An unrecognised non-null channel still reads as In-store. There is no "other"
bucket in the five-key model that would not change the shape of the report's
table. It is pinned by a test so the next person adding an ordering surface has
to come here. `tests/unit/delivery-channels.test.ts` also reads 0074's own
allow-list and fails if SQL gains a platform that this list did not.

## Before you ship: measure it

I could not read production from here. Run this and you will know exactly what
moves, per business, before any merchant sees a different number:

```sql
-- Every distinct channel / dining_option pair, with volume and money.
select
  coalesce(o.channel, '(null)')                    as channel,
  coalesce(o.snapshot->>'dining_option', '(none)') as dining_option,
  count(*)                                         as orders,
  count(distinct o.business_id)                    as businesses,
  round(sum(o.total)::numeric, 2)                  as total_sales,
  min(o.created_at)::date                          as first_seen,
  max(o.created_at)::date                          as last_seen
from public.orders o
group by 1, 2
order by orders desc;
```

Any row whose `channel` is `doordash`, `ubereats`, `grubhub`, `kiosk`, `online`
or `qr` is a row that was being counted as In-store and will not be after this.
If every row comes back NULL, no live figure moves at all and this is purely a
correctness fix ahead of the first delivery integration going live.

Worth also telling any merchant who has been running delivery that their
In-store number was overstated and is about to drop — better from you first than
noticed later.
