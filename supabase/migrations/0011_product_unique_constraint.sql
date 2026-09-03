-- The product-line writer in createActivity (used by field activity
-- creation and the CSV activity import) has always upserted into `product`
-- with `ON CONFLICT (farm_business_id, name)` — but that constraint was
-- never actually created on the table. Every one of those upserts was
-- failing outright (Postgres rejects an ON CONFLICT with no matching
-- unique/exclusion constraint), which is why field activities imported via
-- CSV never got their spray/fertilizer/seed product attached, even though
-- the activity row itself saved fine. This adds the constraint the code has
-- always assumed existed.

-- Defensive: collapse any accidental duplicate (farm_business_id, name)
-- rows first, in case any product rows were created some other way, so the
-- unique constraint below can't fail to apply.
delete from product a using product b
  where a.id > b.id
    and a.farm_business_id = b.farm_business_id
    and a.name = b.name;

alter table product add constraint product_farm_business_id_name_key unique (farm_business_id, name);
