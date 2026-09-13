-- inventory_movement.related_activity_id references activity(id) with no
-- ON DELETE action at all, which defaults to NO ACTION (i.e. "block the
-- delete"). Every activity that used a tracked inventory product (see
-- writeActivityProductDetails in src/lib/supabase/repo.ts) writes an
-- inventory_movement row stamped with related_activity_id — so deleting
-- ANY such activity, including via "Clear All Field Activity", fails
-- outright with a foreign-key violation the moment it hits one of them.
-- That's almost certainly today's real blocker: the whole bulk delete is
-- one statement, so a single activity with a linked inventory movement
-- fails the entire operation.
--
-- Switching to ON DELETE SET NULL keeps the inventory movement itself
-- (it's a real inventory/quantity record worth keeping) while letting the
-- activity it came from be deleted; the movement's related_activity_id
-- just goes to null, matching how related_job_id/related_transaction_id
-- on this same table already behave as plain nullable references.
alter table inventory_movement
  drop constraint inventory_movement_activity_fk,
  add constraint inventory_movement_activity_fk
    foreign key (related_activity_id) references activity(id) on delete set null;
