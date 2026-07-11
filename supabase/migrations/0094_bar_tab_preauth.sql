-- Card-not-present pre-auth for bar tabs. A hold is placed at tab open and captured
-- (with the tip, up to the hold) at close, or voided on a walked tab. Nullable +
-- additive: a tab with no hold behaves exactly as before.
alter table public.open_tickets
  add column if not exists finix_authorization_id text,
  add column if not exists finix_auth_amount_cents bigint,
  add column if not exists finix_auth_instrument_id text,
  add column if not exists finix_auth_merchant_id text,
  add column if not exists finix_auth_expires_at timestamptz,
  add column if not exists finix_auth_state text; -- 'held' | 'captured' | 'voided'
