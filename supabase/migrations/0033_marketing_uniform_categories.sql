-- "Marketing" and "Uniforms" farm categories. Schedule F has no line of
-- its own for either, so both map to Other Expenses (Line 32), the same as
-- Gift Given / FCE / Kanza / Agco expenses; they're separate categories so
-- they show under their own names instead of being lumped into "Other."
-- Uniforms = work clothing/gear required for the job and not suitable for
-- everyday wear (ask your tax professional about anything borderline).
insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Marketing', 'exp_other'),
  ('Uniforms', 'exp_other')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
