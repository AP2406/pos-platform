-- Web logins could only ever be owner | manager | staff | trainee, so two roles
-- that exist in the permission matrix (lib/services/permissions.ts) had no way
-- to sign in to the dashboard at all:
--
--   • bookkeeper  — has access_reports + export_data, but every accounting page
--     guards on `role !== "owner" && role !== "manager"`, and there was no
--     bookkeeper value to hold anyway. An outside accountant therefore had to be
--     made a full manager (or emailed CSVs by hand).
--   • shift_lead  — same story for approvals / reports / close-day.
--
-- This is purely additive: it widens the enum. No existing row changes, no
-- default changes, and every current owner/manager/staff/trainee membership
-- keeps the exact access it has today. Route access is decided in
-- lib/services/route-access.ts, which maps these roles onto the existing
-- 16-key permission matrix.
--
-- NOTE: `alter type ... add value` cannot run inside a transaction block in
-- older Postgres, hence `if not exists` and no explicit begin/commit here.

alter type public.member_role add value if not exists 'shift_lead';
alter type public.member_role add value if not exists 'bookkeeper';
