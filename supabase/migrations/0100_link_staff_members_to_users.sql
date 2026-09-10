-- One person, two identities.
--
-- A web login is a row in business_members (auth.users → business + role); an
-- in-venue identity is a row in staff_members (a 4-6 digit PIN, no user_id).
-- Nothing joined them, so the same human appears twice with no link:
--
--   • the audit trail can't tell that the void approved by PIN on the iPad and
--     the one approved from the dashboard were the same manager;
--   • per-person permission overrides (staff_members.permission_overrides,
--     comp/discount caps on roles) apply at the register but are invisible to
--     the web, which only knows the coarse member_role;
--   • systemRoleForLegacy() has to GUESS the bridge (staff → server,
--     trainee → host), which is why the web could never resolve a shift_lead
--     or bookkeeper before migration 0099.
--
-- This is the join. Nullable on purpose: a line cook who only ever taps a PIN
-- has no web account and never needs one, so user_id stays null for them.
--
-- Additive only — no existing row changes, and every read still works against
-- staff_members.id as before.

alter table public.staff_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- A web user maps to at most ONE staff record per business, so resolving
-- "which PIN identity is this login?" can never be ambiguous. Partial, so the
-- many PIN-only staff (user_id null) are unconstrained.
create unique index if not exists staff_members_business_user_uniq
  on public.staff_members (business_id, user_id)
  where user_id is not null;

-- Lookups go both ways: given a login, find the staff record.
create index if not exists staff_members_user_id_idx
  on public.staff_members (user_id)
  where user_id is not null;

comment on column public.staff_members.user_id is
  'Optional link to the auth.users row for this person''s web login. Null for PIN-only staff. Unique per business.';
