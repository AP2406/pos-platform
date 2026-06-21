-- Phase A (live operations). Persist covers + turn-time + section onto the order
-- at close (currently lost when the open ticket is deleted); a check-dropped
-- marker for the live floor state machine; and put open_tickets in the realtime
-- publication so the floor map updates live instead of polling.
alter table public.orders
  add column if not exists guest_count integer,
  add column if not exists seated_at timestamptz,
  add column if not exists section_id uuid;

alter table public.open_tickets
  add column if not exists check_dropped_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'open_tickets'
  ) then
    alter publication supabase_realtime add table public.open_tickets;
  end if;
end $$;
