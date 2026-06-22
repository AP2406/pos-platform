-- E2 guest-facing signature capture. A compact signature (SVG-path / data-URL
-- string) drawn on the customer-facing display, stored on the order. Optional;
-- non-financial; decoupled from any card processor.
alter table public.orders
  add column if not exists signature_data text;
