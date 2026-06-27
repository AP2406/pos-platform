-- Go-live hardening P0: enable RLS on four public tables flagged by the Supabase
-- security advisor (rls_disabled_in_public ERROR — readable/writable via anon key).
-- Policies mirror the canonical per-business pattern (public.is_business_member).

-- finix_payments: members READ their own business's payment rows; WRITES are
-- service-role only (no write policy → inserts/updates only via the service-role
-- client or SECURITY DEFINER RPCs: the charge path, webhook, and settle_guest_check).
alter table public.finix_payments enable row level security;
drop policy if exists finix_payments_select_for_members on public.finix_payments;
create policy finix_payments_select_for_members on public.finix_payments
  for select to authenticated
  using (public.is_business_member(business_id));

-- tags: business-scoped read + write for members.
alter table public.tags enable row level security;
drop policy if exists tags_all_for_members on public.tags;
create policy tags_all_for_members on public.tags
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- customer_tags has no business_id of its own; scope it through the parent tag's
-- business (a member may only touch tags in their own business).
alter table public.customer_tags enable row level security;
drop policy if exists customer_tags_all_for_members on public.customer_tags;
create policy customer_tags_all_for_members on public.customer_tags
  for all to authenticated
  using (exists (select 1 from public.tags t where t.id = customer_tags.tag_id and public.is_business_member(t.business_id)))
  with check (exists (select 1 from public.tags t where t.id = customer_tags.tag_id and public.is_business_member(t.business_id)));

-- trip_line_items (transportation): mirror trips_all_for_members exactly so Pearson
-- members keep full read/write on their own trips' line items.
alter table public.trip_line_items enable row level security;
drop policy if exists trip_line_items_all_for_members on public.trip_line_items;
create policy trip_line_items_all_for_members on public.trip_line_items
  for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
