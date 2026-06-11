-- P0-4 Check-splitting into separate guest checks. Additive. A table can fan
-- into several child open_tickets, each a subset cart that pays independently as
-- its own order/snapshot. The parent stays open (as a container) until every
-- child is paid, then closes. Conservation (Σ children == original) is asserted
-- server-side at split time.

alter table public.open_tickets
  add column if not exists parent_ticket_id uuid references public.open_tickets(id) on delete cascade,
  add column if not exists split_kind text;   -- 'seat' | 'item' | 'even' | 'amount' | null

create index if not exists open_tickets_parent_idx on public.open_tickets(parent_ticket_id);
