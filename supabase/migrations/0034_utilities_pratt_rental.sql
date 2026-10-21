-- Two utilities categories that are NOT farm utilities:
--   Utilities - Pratt  -> the house being rehabbed (House Project). While
--                         it's being fixed up, its utilities add to the
--                         house's cost basis like rehab costs, so they sit
--                         with the House Project, off Schedule F.
--   Utilities - Rental -> the house you rent and live in. A personal
--                         living cost: not deductible, off every schedule.
insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('flip_utilities', 'House Project — Utilities While Being Fixed Up (Capitalized, Not a Deduction)', 'Adds to cost basis while the house is being rehabbed — confirm with your CPA', 'expense', 807, 'real_estate'),
  ('personal_living', 'Personal Living Expense (Not Deductible)', null, 'expense', 905, 'personal')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Utilities - Pratt', 'flip_utilities'),
  ('Utilities - Rental', 'personal_living')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
