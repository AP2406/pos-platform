-- Surge HQ HQ-1: a manual software-plan/tier label per merchant, set from HQ.
-- Null = unset. HQ-2 will price MRR off this until a billing provider is wired.
alter table public.businesses add column if not exists plan text;
