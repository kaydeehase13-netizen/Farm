-- =====================================================================
-- Gift / FCE / Kanza / Agco farm categories.
--
-- Each gets both an income and an expense bucket, per Kaydee's request —
-- money can move either direction with any of these (a gift received vs.
-- given; a payment to or from FCE/Kanza/Agco). All eight map to the same
-- generic Other Income / Other Expense tax lines "Other" already uses —
-- they're separate farm_category rows purely so they show up as their own
-- named category in the dropdown instead of getting lumped under "Other."
-- =====================================================================

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Gift Received', 'income_other'),
  ('Gift Given', 'exp_other'),
  ('FCE (Income)', 'income_other'),
  ('FCE (Expense)', 'exp_other'),
  ('Kanza (Income)', 'income_other'),
  ('Kanza (Expense)', 'exp_other'),
  ('Agco (Income)', 'income_other'),
  ('Agco (Expense)', 'exp_other')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
