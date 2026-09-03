-- =====================================================================
-- Self-employment (Schedule C) categorization, alongside the existing
-- Schedule F farm categories. Nothing here removes or renames any
-- existing Schedule F category — this only adds a way to tell them
-- apart and a parallel set of Schedule C buckets.
-- =====================================================================

-- Every existing tax_category row is Schedule F today, so default new
-- rows to that and explicitly backfill anything already in the table.
alter table tax_category add column if not exists schedule_type text not null default 'schedule_f';
alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check check (schedule_type in ('schedule_f', 'schedule_c'));
update tax_category set schedule_type = 'schedule_f' where schedule_type is null;

-- Schedule C (Form 1040), self-employment / non-farm business income and
-- expense lines. Informational labels only, not a legal determination —
-- same disclaimer as the Schedule F set above. "Ask your tax professional."
insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('se_income_services', 'Self-Employment Income — Services / Custom Work', 'Schedule C, Line 1', 'income', 400, 'schedule_c'),
  ('se_income_other', 'Self-Employment Income — Other', 'Schedule C, Line 1', 'income', 405, 'schedule_c'),
  ('se_exp_advertising', 'Advertising', 'Schedule C, Line 8', 'expense', 410, 'schedule_c'),
  ('se_exp_car_truck', 'Car and Truck Expenses', 'Schedule C, Line 9', 'expense', 415, 'schedule_c'),
  ('se_exp_commissions_fees', 'Commissions and Fees', 'Schedule C, Line 10', 'expense', 420, 'schedule_c'),
  ('se_exp_contract_labor', 'Contract Labor', 'Schedule C, Line 11', 'expense', 425, 'schedule_c'),
  ('se_exp_depreciation', 'Depreciation and Section 179 Expense', 'Schedule C, Line 13', 'expense', 430, 'schedule_c'),
  ('se_exp_insurance', 'Insurance (Other Than Health)', 'Schedule C, Line 15', 'expense', 435, 'schedule_c'),
  ('se_exp_interest_mortgage', 'Interest — Mortgage (Paid to Banks, Etc.)', 'Schedule C, Line 16a', 'expense', 440, 'schedule_c'),
  ('se_exp_interest_other', 'Interest — Other', 'Schedule C, Line 16b', 'expense', 445, 'schedule_c'),
  ('se_exp_legal_professional', 'Legal and Professional Services', 'Schedule C, Line 17', 'expense', 450, 'schedule_c'),
  ('se_exp_office', 'Office Expense', 'Schedule C, Line 18', 'expense', 455, 'schedule_c'),
  ('se_exp_rent_equipment', 'Rent/Lease — Vehicles, Machinery, Equipment', 'Schedule C, Line 20a', 'expense', 460, 'schedule_c'),
  ('se_exp_rent_other', 'Rent/Lease — Other Business Property', 'Schedule C, Line 20b', 'expense', 465, 'schedule_c'),
  ('se_exp_repairs', 'Repairs and Maintenance', 'Schedule C, Line 21', 'expense', 470, 'schedule_c'),
  ('se_exp_supplies', 'Supplies', 'Schedule C, Line 22', 'expense', 475, 'schedule_c'),
  ('se_exp_taxes_licenses', 'Taxes and Licenses', 'Schedule C, Line 23', 'expense', 480, 'schedule_c'),
  ('se_exp_travel', 'Travel', 'Schedule C, Line 24a', 'expense', 485, 'schedule_c'),
  ('se_exp_meals', 'Meals (50% Limit Generally Applies)', 'Schedule C, Line 24b', 'expense', 490, 'schedule_c'),
  ('se_exp_utilities', 'Utilities', 'Schedule C, Line 25', 'expense', 495, 'schedule_c'),
  ('se_exp_wages', 'Wages', 'Schedule C, Line 26', 'expense', 500, 'schedule_c'),
  ('se_exp_other', 'Other Expenses (Specify)', 'Schedule C, Line 27a', 'expense', 505, 'schedule_c')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

-- Plain-language farm_category buckets for the new Schedule C tax categories,
-- prefixed "SE:" so they're easy to tell apart from the farm ones in dropdowns.
insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('SE: Services / Custom Work Income', 'se_income_services'),
  ('SE: Other Self-Employment Income', 'se_income_other'),
  ('SE: Advertising', 'se_exp_advertising'),
  ('SE: Vehicle', 'se_exp_car_truck'),
  ('SE: Commissions & Fees', 'se_exp_commissions_fees'),
  ('SE: Contract Labor', 'se_exp_contract_labor'),
  ('SE: Depreciation', 'se_exp_depreciation'),
  ('SE: Insurance', 'se_exp_insurance'),
  ('SE: Interest', 'se_exp_interest_other'),
  ('SE: Legal & Professional', 'se_exp_legal_professional'),
  ('SE: Office Expense', 'se_exp_office'),
  ('SE: Equipment Rent/Lease', 'se_exp_rent_equipment'),
  ('SE: Rent — Other Business Property', 'se_exp_rent_other'),
  ('SE: Repairs & Maintenance', 'se_exp_repairs'),
  ('SE: Supplies', 'se_exp_supplies'),
  ('SE: Taxes & Licenses', 'se_exp_taxes_licenses'),
  ('SE: Travel', 'se_exp_travel'),
  ('SE: Meals', 'se_exp_meals'),
  ('SE: Utilities', 'se_exp_utilities'),
  ('SE: Wages', 'se_exp_wages'),
  ('SE: Other', 'se_exp_other')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
