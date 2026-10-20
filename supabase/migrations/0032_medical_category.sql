-- "Medical" category for your own doctor, dental, pharmacy and other
-- health costs. Not a farm expense: it never counts toward Schedule F or
-- the farm's income/expense totals, but it gets its own sheet in the CPA
-- export because personal medical costs can be an itemized deduction on
-- Schedule A. Same off-Schedule-F mechanism as W-2 wages and loans.
alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check
  check (schedule_type in ('schedule_f', 'schedule_c', 'schedule_e', 'w2', 'real_estate', 'loan', 'personal'));

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('personal_medical', 'Medical — Personal (Not a Farm Expense)', 'Form 1040, Schedule A (itemized deductions) — ask your tax professional', 'expense', 900, 'personal')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Medical', 'personal_medical')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
