-- "Not a duplicate": transactions that look alike (same type, name, date
-- and amount) but are both real, e.g. two identical fuel fills on one day.
-- Marking a group sets this on every copy so the Category Audit stops
-- flagging it; if another matching copy is entered later, that new copy
-- isn't marked, so the group shows up again for review.
alter table transaction add column if not exists not_duplicate boolean not null default false;
