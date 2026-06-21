-- B8: kitchen → server (BOH→FOH) messaging. The kitchen can push "delayed / held /
-- 86 mid-course" to the owning server; delivered live via realtime and shown as a
-- banner on the floor/register. A table (not a broadcast) so a server mid-cart
-- still receives it; ack clears it.
create table if not exists public.kitchen_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  element_id uuid,
  to_staff_id uuid,
  to_name text,
  body text not null,
  kind text not null default 'info',
  created_by uuid,
  created_at timestamptz not null default now(),
  acked_at timestamptz
);
alter table public.kitchen_messages enable row level security;
drop policy if exists km_select on public.kitchen_messages;
create policy km_select on public.kitchen_messages for select
  using (exists (select 1 from public.business_members m where m.business_id = kitchen_messages.business_id and m.user_id = auth.uid()));
drop policy if exists km_write on public.kitchen_messages;
create policy km_write on public.kitchen_messages for all
  using (exists (select 1 from public.business_members m where m.business_id = kitchen_messages.business_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.business_members m where m.business_id = kitchen_messages.business_id and m.user_id = auth.uid()));
create index if not exists kitchen_messages_idx on public.kitchen_messages(business_id, created_at);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='kitchen_messages') then
    alter publication supabase_realtime add table public.kitchen_messages;
  end if;
end $$;
