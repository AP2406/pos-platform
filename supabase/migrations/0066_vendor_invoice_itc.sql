-- F5 / F3 / F10: vendor-invoice tax recoverability + expense classification.
-- itc_eligible flags whether the invoice's GST/HST is a recoverable input tax
-- credit (nets against tax collected on the GST34 worksheet). expense_category
-- groups invoices for the P&L operating-expense breakdown (and a meals-&-
-- entertainment flag for Canadian 50% treatment).
alter table public.vendor_invoices
  add column if not exists itc_eligible boolean not null default true,
  add column if not exists expense_category text,
  add column if not exists meals_entertainment boolean not null default false;
