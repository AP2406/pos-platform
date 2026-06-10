-- Surge register redesign + optional item photos
--
-- This repo has no migrations runner. Run this once in the Supabase SQL editor.
--
-- MANUAL STEP (not expressible here): create the storage bucket.
--   Supabase dashboard -> Storage -> New bucket
--     name:   item-images
--     Public: ON
-- A public bucket makes SELECT (read) public automatically; the policies below
-- only grant write access to signed-in users.
--
-- NOTE: catalog_items.image_url (text) was already added manually and is not
-- re-created here.

-- Business-level settings -----------------------------------------------------

-- Toggle: show item photos on the register. Default ON preserves nothing-changes
-- behavior for existing businesses (e.g. Pearson Limo).
alter table businesses
  add column if not exists show_item_photos boolean not null default true;

-- Merchant-assigned tile colors, a map of { "<category name>": "<palette key>" }.
-- Empty map => neutral tiles, so existing businesses are unaffected.
alter table businesses
  add column if not exists category_colors jsonb not null default '{}'::jsonb;

-- Storage policies for the public "item-images" bucket ------------------------
-- Authenticated users may upload / replace / remove objects in this bucket.
-- Public read is implicit for a public bucket.

drop policy if exists "item-images authenticated insert" on storage.objects;
create policy "item-images authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images');

drop policy if exists "item-images authenticated update" on storage.objects;
create policy "item-images authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'item-images')
  with check (bucket_id = 'item-images');

drop policy if exists "item-images authenticated delete" on storage.objects;
create policy "item-images authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-images');
