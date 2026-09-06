-- =====================================================================
-- Farm-facing income categories.
--
-- Every farm_category bucket added so far (0003, 0007, 0012) was an
-- EXPENSE bucket -- there was no plain-language income category at all,
-- so every sale (grain, cattle, custom work, anything else) had nowhere
-- to go but "Uncategorized." This adds the four the user asked for:
-- Grain, Custom Farming, Cows, and Other (income) -- mapped to the
-- existing Schedule F income tax categories from migration 0003.
-- =====================================================================

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Grain', 'income_sales_livestock_produce'),
  ('Custom Farming', 'income_custom_hire'),
  ('Cows', 'income_sales_livestock_produce'),
  ('Other Income', 'income_other')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
