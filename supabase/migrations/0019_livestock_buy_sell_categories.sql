-- =====================================================================
-- Livestock buying and selling (Schedule F, Line 1a/1b/1c).
--
-- "Cows" (added in migration 0017) covers livestock you raised yourself
-- (Schedule F Line 2). This adds the other side: livestock you buy and
-- later resell. The IRS form nets these on one line (1a sales minus 1b
-- cost = 1c), but there was no expense category for the cost side (1b)
-- at all yet, and no farm-facing bucket for either half -- so this adds
-- both, letting a purchase and a later sale be entered as two ordinary
-- transactions instead of one hand-computed net number.
-- =====================================================================

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order) values
  ('exp_cost_livestock_resale', 'Cost of Livestock/Other Items Purchased for Resale', 'Schedule F, Line 1b', 'expense', 15)
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Livestock Purchased', 'exp_cost_livestock_resale'),
  ('Livestock Sold', 'income_sales_livestock_resale')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
