-- Per-floor background: an owner can set each floor plan's POS background to a
-- solid color or a cover image (uploaded to Storage). null = the default dark
-- surface, so every existing plan keeps today's look with no backfill.
alter table public.floor_plans
  add column if not exists background jsonb;
-- background shape: {"type":"color"|"image","value":"#RRGGBB" | "https://…"} | null

-- Public-read bucket for owner-uploaded floor backgrounds (the POS renders by URL).
insert into storage.buckets (id, name, public)
values ('floor-backgrounds', 'floor-backgrounds', true)
on conflict (id) do nothing;

-- Read: public (POS clients render the image by its URL).
drop policy if exists "floor_bg_read" on storage.objects;
create policy "floor_bg_read" on storage.objects
  for select using (bucket_id = 'floor-backgrounds');

-- Write/update/delete: only members of the business whose id is the first path
-- segment (uploads are always <businessId>/<planId>.<ext>). Owner/manager is
-- further enforced in the server action.
drop policy if exists "floor_bg_write" on storage.objects;
create policy "floor_bg_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'floor-backgrounds'
    and public.is_business_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "floor_bg_update" on storage.objects;
create policy "floor_bg_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'floor-backgrounds'
    and public.is_business_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "floor_bg_delete" on storage.objects;
create policy "floor_bg_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'floor-backgrounds'
    and public.is_business_member(((storage.foldername(name))[1])::uuid));
