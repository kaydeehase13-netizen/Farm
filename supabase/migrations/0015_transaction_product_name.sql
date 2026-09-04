-- A transaction (usually a Seed/Chemical/Fertilizer expense) can optionally
-- carry the specific product/variety it was for, so it doesn't have to be
-- typed again separately in the field's activity record. See
-- src/lib/actions.ts (createExpenseOrIncome) for where this also gets used
-- to auto-tag a matching field activity.
alter table transaction add column if not exists product_name text;
