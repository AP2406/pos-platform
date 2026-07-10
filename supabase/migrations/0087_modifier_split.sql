-- Half / left-right (position) modifiers — pizza-style. A modifier group flagged
-- allow_split lets each chosen option be placed on the Whole / Left / Right of the
-- item at the register; the position is encoded into the line name + price (like
-- all other modifiers), so no order-schema change is needed. Additive; existing
-- groups default to false and behave exactly as before.
alter table public.catalog_modifier_groups
  add column if not exists allow_split boolean not null default false;

comment on column public.catalog_modifier_groups.allow_split is
  'When true, each selected option can be assigned Whole/Left/Right at the register (½L / ½R pricing).';
