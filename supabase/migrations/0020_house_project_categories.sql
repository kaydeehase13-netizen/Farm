-- =====================================================================
-- House flip / real estate project — kept OFF Schedule F and Schedule C.
--
-- This is a real estate activity, not a farm activity. The user's plan
-- for this specific property has already shifted once (flip -> intended
-- future primary residence), which is a THIRD possible tax outcome
-- beyond the usual flip fork:
--   - Sold as a "dealer" business property -> ordinary income, Schedule C
--   - Sold as an occasional/investment sale -> capital gain, Schedule D
--   - Lived in 2+ of the 5 years before an eventual sale -> Section 121
--     personal-residence exclusion may shield up to $250k/$500k of gain
-- Which applies depends on facts that only shake out later, so this
-- stays in its own schedule_type ('real_estate') until that's settled
-- with a CPA -- never assumed to be Schedule F or Schedule C.
--
-- Purchase price and rehab/improvement costs are NOT ordinary deductible
-- expenses as they're paid under any of the three outcomes above -- they
-- capitalize into the property's cost basis and only matter at an
-- eventual sale (reducing taxable gain, or growing the tax-free amount
-- under Section 121). This just tracks the money; it claims no
-- deduction anywhere else in the app.
-- =====================================================================

alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check check (schedule_type in ('schedule_f', 'schedule_c', 'schedule_e', 'w2', 'real_estate'));

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('flip_purchase_price', 'House Project — Purchase Price (Capitalized, Not a Deduction)', 'Adds to cost basis', 'expense', 800, 'real_estate'),
  ('flip_rehab_cost', 'House Project — Rehab / Materials / Contractor Labor (Capitalized, Not a Deduction)', 'Adds to cost basis', 'expense', 805, 'real_estate'),
  ('flip_selling_cost', 'House Project — Selling Costs (Commission, Closing Costs)', 'Reduces sale proceeds if/when sold', 'expense', 810, 'real_estate'),
  ('flip_sale_proceeds', 'House Project — Sale Proceeds (if/when sold)', 'Schedule C, Schedule D, or Section 121 personal-residence exclusion — confirm with your CPA', 'income', 815, 'real_estate')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('House Project: Purchase Price', 'flip_purchase_price'),
  ('House Project: Rehab / Materials', 'flip_rehab_cost'),
  ('House Project: Selling Costs', 'flip_selling_cost'),
  ('House Project: Sale Proceeds', 'flip_sale_proceeds')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
