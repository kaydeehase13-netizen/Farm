-- =====================================================================
-- "Program Payment" farm category.
--
-- income_govt_payments ("Agricultural Program Payments", Schedule F Line
-- 4a) has existed as a tax category since the app's original category
-- set, but never had a farm-facing bucket in farm_category — same gap
-- Interest and Loan had before migrations 0021/0023. Adding it now so
-- USDA/FSA program payments (e.g. ARC/PLC, CRP, disaster assistance) have
-- somewhere to go, separate from W-2 wages on the same income screen.
-- =====================================================================

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Program Payment', 'income_govt_payments')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
