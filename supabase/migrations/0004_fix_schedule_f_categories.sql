-- =====================================================================
-- Correct the tax-category → Schedule F line-number mapping to match the
-- official 2025 Schedule F (Form 1040).
--
-- 0003_reference_data.sql shipped with several line numbers off by one
-- from "Fertilizers and lime" (Line 17) onward, because it was missing
-- two lines entirely: "Employee benefit programs" (Line 15) and "Feed"
-- (Line 16). It also mapped "Seeds and Plants" to Line 15 instead of the
-- correct Line 26, and never added "Pension and profit-sharing plans"
-- (Line 23).
--
-- This migration is idempotent (upserts by code) so it's safe to run
-- whether or not 0003 has already been applied, and safe to re-run.
-- Category rows are shared reference data (farm_business_id is null), so
-- this is a one-time global fix — it does not need to run per farm.
--
-- Informational only, never a legal/tax determination — "ask your tax
-- professional," per the comment already on the tax_category table.
-- =====================================================================

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order) values
  ('income_sales_livestock_resale', 'Sales of Purchased Livestock and Other Resale Items (Net)', 'Schedule F, Line 1c', 'income', 10),
  ('income_sales_livestock_produce', 'Sales of Livestock, Produce, Grains, and Other Products Raised', 'Schedule F, Line 2', 'income', 20),
  ('income_coop_distributions', 'Cooperative Distributions (Form 1099-PATR)', 'Schedule F, Line 3a', 'income', 25),
  ('income_govt_payments', 'Agricultural Program Payments', 'Schedule F, Line 4a', 'income', 30),
  ('income_ccc_loans', 'Commodity Credit Corporation (CCC) Loans', 'Schedule F, Line 5a', 'income', 35),
  ('income_crop_insurance', 'Crop Insurance Proceeds and Federal Crop Disaster Payments', 'Schedule F, Line 6a', 'income', 40),
  ('income_custom_hire', 'Custom Hire (Machine Work) Income', 'Schedule F, Line 7', 'income', 50),
  ('income_other', 'Other Farm Income', 'Schedule F, Line 8', 'income', 60),
  ('exp_car_truck', 'Car and Truck Expenses', 'Schedule F, Line 10', 'expense', 100),
  ('exp_chemicals', 'Chemicals', 'Schedule F, Line 11', 'expense', 110),
  ('exp_conservation', 'Conservation Expenses', 'Schedule F, Line 12', 'expense', 120),
  ('exp_custom_hire', 'Custom Hire (Machine Work)', 'Schedule F, Line 13', 'expense', 130),
  ('exp_depreciation', 'Depreciation and Section 179 Expense', 'Schedule F, Line 14', 'expense', 140),
  ('exp_employee_benefits', 'Employee Benefit Programs', 'Schedule F, Line 15', 'expense', 145),
  ('exp_feed', 'Feed', 'Schedule F, Line 16', 'expense', 150),
  ('exp_fertilizer', 'Fertilizers and Lime', 'Schedule F, Line 17', 'expense', 160),
  ('exp_freight_trucking', 'Freight and Trucking', 'Schedule F, Line 18', 'expense', 170),
  ('exp_fuel', 'Gasoline, Fuel, and Oil', 'Schedule F, Line 19', 'expense', 180),
  ('exp_insurance', 'Insurance (Other Than Health)', 'Schedule F, Line 20', 'expense', 190),
  ('exp_interest_mortgage', 'Interest — Mortgage (Paid to Banks, Etc.)', 'Schedule F, Line 21a', 'expense', 200),
  ('exp_interest_other', 'Interest — Other', 'Schedule F, Line 21b', 'expense', 210),
  ('exp_labor_hired', 'Labor Hired', 'Schedule F, Line 22', 'expense', 220),
  ('exp_pension', 'Pension and Profit-Sharing Plans', 'Schedule F, Line 23', 'expense', 225),
  ('exp_rent_lease_equipment', 'Rent/Lease — Vehicles, Machinery, Equipment', 'Schedule F, Line 24a', 'expense', 230),
  ('exp_rent_lease_land', 'Rent/Lease — Other (Land, Animals, Etc.)', 'Schedule F, Line 24b', 'expense', 240),
  ('exp_repairs_maintenance', 'Repairs and Maintenance', 'Schedule F, Line 25', 'expense', 250),
  ('exp_seeds', 'Seeds and Plants Purchased', 'Schedule F, Line 26', 'expense', 260),
  ('exp_seed_plants', 'Seeds and Plants Purchased', 'Schedule F, Line 26', 'expense', 260),
  ('exp_storage_warehousing', 'Storage and Warehousing', 'Schedule F, Line 27', 'expense', 270),
  ('exp_supplies', 'Supplies', 'Schedule F, Line 28', 'expense', 280),
  ('exp_taxes', 'Taxes', 'Schedule F, Line 29', 'expense', 290),
  ('exp_utilities', 'Utilities', 'Schedule F, Line 30', 'expense', 300),
  ('exp_vet_breeding_medicine', 'Veterinary, Breeding, and Medicine', 'Schedule F, Line 31', 'expense', 310),
  ('exp_other', 'Other Expenses (Specify)', 'Schedule F, Line 32', 'expense', 320),
  ('personal_excluded', 'Personal / Not a Farm Expense', null, 'expense', 999)
on conflict (code) do update set
  label = excluded.label,
  schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense,
  sort_order = excluded.sort_order;

-- New farm-facing (plain-language) buckets for the two lines that were
-- entirely missing before, plus Pension.
insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Feed', 'exp_feed'),
  ('Employee Benefits', 'exp_employee_benefits'),
  ('Pension & Profit-Sharing', 'exp_pension')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);

-- Re-point the existing "Seed" bucket at the corrected exp_seeds row (a
-- no-op in the common case since exp_seeds itself was fixed above, but
-- guards against a differently-ordered fresh install).
update farm_category set default_tax_category_id = (select id from tax_category where code = 'exp_seeds')
where farm_business_id is null and name = 'Seed';
