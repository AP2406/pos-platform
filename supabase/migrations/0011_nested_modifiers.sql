-- P0-3 Nested modifiers. Additive. A modifier option may point to a "follow-up"
-- group (e.g. "Add salad" → choose a dressing). The child group is an ordinary
-- catalog_modifier_groups row for the same item; depth is capped in app code.

alter table public.catalog_item_modifiers
  add column if not exists child_group_id uuid references public.catalog_modifier_groups(id) on delete set null;
