-- =====================================================================
-- Interest — Mortgage / Interest — Other farm categories.
--
-- exp_interest_mortgage and exp_interest_other (Schedule F, Line 21a/21b)
-- have existed as tax categories since the app's original category set,
-- but never had a farm-facing bucket in farm_category -- so there was
-- nothing to actually pick in the category dropdown. Same original gap
-- income had before migration 0017. Adding these now since the loan
-- principal payment categories (0021) only work if the interest portion
-- of a loan payment has somewhere real to go.
-- =====================================================================

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Interest — Mortgage', 'exp_interest_mortgage'),
  ('Interest — Other', 'exp_interest_other')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
