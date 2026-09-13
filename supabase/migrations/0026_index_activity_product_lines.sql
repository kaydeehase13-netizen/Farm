-- spray_product_line and fertilizer_product_line reference activity(id) with
-- ON DELETE CASCADE, but neither had an index on that foreign-key column
-- (unlike every 1:1 detail table, whose activity_id is itself the primary
-- key). Postgres does NOT auto-create an index for a plain foreign key, so
-- every cascade delete off the activity table had to sequentially scan both
-- of these tables for matching rows. On a farm with a lot of imported
-- activities (each spray/fertilize event can have several product lines),
-- that's what was making "Clear All Field Activity" crash/time out even
-- after the request itself was slimmed down to a single farm-scoped delete.
create index if not exists idx_spray_product_line_activity on spray_product_line (activity_id);
create index if not exists idx_fertilizer_product_line_activity on fertilizer_product_line (activity_id);
