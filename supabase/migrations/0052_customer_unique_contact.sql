-- P0 follow-up (APPLY ONLY AFTER EXISTING DUPLICATES ARE MERGED — this will fail
-- if two customers in a business share an email/phone). DB-level backstop behind
-- the app's create-dedupe guard: at most one customer per business per email
-- (case-insensitive) and per phone. NULL/blank contact fields are exempt, so
-- walk-ins with no contact info are unaffected.
create unique index if not exists customers_unique_email_per_biz
  on public.customers (business_id, lower(email))
  where email is not null and email <> '';

create unique index if not exists customers_unique_phone_per_biz
  on public.customers (business_id, phone)
  where phone is not null and phone <> '';
