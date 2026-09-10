-- =====================================================================
-- "Mark duplicate" — for a lump-sum expense/income entered from a
-- year-end summary with no dates, which will also be covered later by
-- the real dated check/bank transaction. Excludes the marked copy from
-- income, expense, and Schedule F totals (same mechanism as
-- is_personal_excluded) without mislabeling it "personal" -- it's a
-- real farm cost, just represented twice in the records on purpose, and
-- only one copy should count. duplicate_note is a free-text pointer to
-- what it matches, so both copies can be found again later.
-- =====================================================================

alter table transaction add column if not exists is_duplicate_excluded boolean not null default false;
alter table transaction add column if not exists duplicate_note text;
