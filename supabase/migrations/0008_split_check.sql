-- Split check by item — Pass C feature 3. Additive (settings only).
-- Two settlement modes, selectable per business:
--   'separate'      each sub-check is finalized as its own paid order/receipt
--   'informational' one payment, with an itemized per-person breakdown printed
-- `split_allow_units` additionally enables splitting a line's quantity across
-- checks and sharing an item evenly (otherwise: whole lines + even split only).
-- Sub-checks are guaranteed to sum to the original to the cent via
-- largest-remainder allocation of tax / service charge / discount / comp; the
-- split grouping is recorded on each order's immutable snapshot (no new orders
-- columns, so create_pos_order is unchanged).

alter table public.businesses
  add column if not exists split_settlement_mode text not null default 'separate',
  add column if not exists split_allow_units boolean not null default false;
