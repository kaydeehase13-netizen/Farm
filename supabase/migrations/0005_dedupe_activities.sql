-- FarmLedger: remove duplicate field activities (e.g. from a CSV import that
-- got run more than once), keeping the oldest copy of each duplicate set.
-- Safe to run more than once — it only removes exact duplicates and always
-- keeps the earliest-created copy of each group. Cascades automatically
-- clean up the matching spray_product_line / fertilizer_product_line /
-- planting_activity_detail / harvest_activity_detail rows for anything
-- deleted, since those all have `on delete cascade` back to activity.id.

with signatures as (
  select
    a.id,
    a.farm_business_id,
    a.field_id,
    a.activity_type,
    a.activity_date,
    coalesce(a.acres, -1) as acres_key,
    coalesce(a.notes, '') as notes_key,
    a.created_at,
    coalesce((
      select string_agg(spl.product_id::text || ':' || spl.rate::text || ':' || spl.quantity_used::text, ',' order by spl.product_id)
      from spray_product_line spl where spl.activity_id = a.id
    ), '') as spray_sig,
    coalesce((
      select string_agg(fpl.product_id::text || ':' || fpl.rate::text || ':' || fpl.quantity_used::text, ',' order by fpl.product_id)
      from fertilizer_product_line fpl where fpl.activity_id = a.id
    ), '') as fert_sig,
    coalesce((
      select pad.seeding_rate::text from planting_activity_detail pad where pad.activity_id = a.id
    ), '') as plant_sig,
    coalesce((
      select had.yield_amount::text || ':' || coalesce(had.moisture_pct::text, '')
      from harvest_activity_detail had where had.activity_id = a.id
    ), '') as harvest_sig
  from activity a
),
ranked as (
  select
    s.id,
    row_number() over (
      partition by farm_business_id, field_id, activity_type, activity_date, acres_key, notes_key, spray_sig, fert_sig, plant_sig, harvest_sig
      order by created_at asc, id asc
    ) as rn
  from signatures s
)
delete from activity where id in (select id from ranked where rn > 1);
