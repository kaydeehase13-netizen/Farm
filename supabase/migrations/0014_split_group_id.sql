-- =====================================================================
-- Splitting a receipt/transaction into multiple category lines (added in
-- recent migrations/app code) creates several separate `transaction` rows
-- with no reliable link back to "these all came from the same original
-- receipt/check" — only a shared date+vendor and a description suffix,
-- which is fragile to match on later. This adds an explicit group id so
-- split lines can always be traced back together: for exports that need
-- to show BOTH the itemized category breakdown AND the original combined
-- total on one row, and for anything else that needs to know "these N
-- transactions are really one receipt."
-- =====================================================================

alter table transaction add column if not exists split_group_id uuid;
create index if not exists transaction_split_group_id_idx on transaction (split_group_id) where split_group_id is not null;
