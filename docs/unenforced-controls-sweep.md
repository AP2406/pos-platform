# Sweep: controls that exist but enforce nothing

Run 16 Sep 2026, after finding two in one afternoon by accident:
`businesses.currency` (written, had a picker, read by nobody) and the `no_sale`
permission (declared, labelled, granted by role, checked by nothing). Two is a
pattern, so this went looking for the rest on purpose.

## Method, and what it gets wrong

Three passes, each answering "is there a writer with no reader":

1. **Permission keys** — every `PERMISSION_KEYS` entry against every
   `posAuthorize` / `actorCan` / `approverByPin` / `canAccess` call.
2. **Settings jsonb keys** — every key written by a `settings/*actions.ts` merge
   against readers outside `/settings/`.
3. **`businesses` columns** — every column in the migrations against readers
   outside `/settings/`.

**A grep over TypeScript is not the whole system, and this sweep proved it
twice.** `comp` and `discount` looked unenforced because the gate passes a
*variable* permission key rather than a literal. `kiosk_ordering_enabled`,
`online_ordering_enabled` and `guest_ordering_enabled` looked unread because
they are enforced in **SQL**, inside the `get_*_menu` RPCs — and correctly, at
both the menu-read and the order-submit path. Every one of those was a false
positive, and each had to be chased to ground before being dismissed. Anyone
re-running this should expect the same and budget for it.

## Findings

### Fixed in this pass

**`requires_manager_approval` was enforced in the browser only.** The flag is set
per catalog item and exists to stop a cashier ringing a controlled item — a
high-value bottle, a comped staff meal, a gift card — without a manager.
`register-client` gates the add behind a manager-PIN modal. `createOrder`'s
approval gate — the block commented *"Server-side approval gate (P0 security)"* —
checked discount, comp, line void, tax exemption and service-charge waive, and
never looked at whether the cart contained a restricted item at all. Nor did the
split path.

A client gate is not a gate: a server action is a POST to a build-time id that
ships in the client bundle, so anything only the browser refuses can be asked for
directly. Same lesson as `app/app/debug/guard.ts` earlier in the week.

Now looked up server-side on both order paths via
`lib/services/restricted-items.ts`, passed into the same approval gate as a
manager-role action (`permKey: null` — manager or owner may ring it, anyone else
needs a manager PIN, re-verified server-side). Fails closed if the lookup errors.
Pinned by `tests/unit/restricted-items-guarded.test.ts`.

### Dead, but failing closed — left alone deliberately

**`change_tax`** — declared, and `DEFAULT_ROLE_PERMISSIONS` withholds it from
manager. But `updateTaxAndCurrency` hardcodes `if (role !== "owner")` instead of
checking the permission. The effect today is *stricter* than the permission
system describes, so nothing is exposed — but granting `change_tax` to a custom
role does nothing, which will surprise whoever first tries it.

**`edit_price`** — declared, with a label and a row in the approval matrix, and
nothing to gate: there is no price-override path for a fixed-price item. Open-
price items are a different thing (the price is *meant* to be entered at the
till, and those already carry `requires_manager_approval` if the operator wants
a gate). It is a permission for a feature that does not exist.

Both are recorded rather than fixed because neither exposes anything, and
inventing enforcement for `edit_price` would mean inventing the feature first.

### Clean

- The other 12 permission keys are genuinely enforced.
- Every `businesses.settings` jsonb key has a reader.
- All three ordering flags are enforced in SQL, twice each.

## The shape to look for next time

All three real findings this week were the same shape, and none of them looks
like a bug in the file where it lives:

| | Written by | Read by |
|---|---|---|
| `businesses.currency` | settings picker | accounting only — never the till |
| `no_sale` permission | role defaults, approval matrix | nothing |
| `requires_manager_approval` | catalog editor | the browser only |

Each had a UI that told the operator the control was working. That is the
dangerous part: a missing feature is visible, and a control that silently does
nothing is not. Worth re-running this sweep whenever a new permission, settings
field or per-item flag is added — and worth remembering that the answer may be
in SQL.
