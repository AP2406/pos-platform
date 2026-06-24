-- CUST-1 Access & roles. Extends the roles + staff_members tables:
--  • new per-role caps (max discount %, max refund $, void window minutes),
--  • per-role nav visibility (hidden_nav: array of nav keys a role can't see),
--  • per-user permission overrides (grant/revoke one key on top of the role).
-- The approval matrix + PIN/security policy live in config_settings (CUST-0),
-- not here. Everything defaults to current behavior (nulls / empty).

alter table public.roles
  add column if not exists discount_pct_cap numeric,        -- max discount % without approval
  add column if not exists refund_cap numeric,              -- max refund $ without approval
  add column if not exists void_window_min integer,         -- minutes after sale a void is allowed cap-free
  add column if not exists hidden_nav jsonb not null default '[]'::jsonb;

alter table public.staff_members
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;  -- { permission_key: true|false }
