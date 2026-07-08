-- Finix in-person (PAX) terminal support.
-- Per-location device id so each merchant/location can push card-present sales
-- to its own activated terminal. NULL falls back to the env FINIX_DEVICE_ID
-- (the single currently-activated A800) at runtime, so this is additive.
alter table public.businesses
  add column if not exists finix_device_id text;

comment on column public.businesses.finix_device_id is
  'Finix cloud device id (e.g. DVxxxx) for this location''s card-present terminal. NULL uses env FINIX_DEVICE_ID.';
