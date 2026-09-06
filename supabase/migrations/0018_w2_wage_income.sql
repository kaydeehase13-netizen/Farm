-- =====================================================================
-- W-2 wage income — kept OFF Schedule F and Schedule C on purpose.
--
-- Wages already have income tax and FICA (Social Security/Medicare)
-- withheld by the employer. They are NOT self-employment income and are
-- never subject to self-employment tax, so they must not be summed into
-- farm (Schedule F) or self-employment (Schedule C) income -- doing so
-- would misstate farm/SE profit and could read as taxing the same money
-- twice (ordinary withholding, then self-employment tax on top).
--
-- This adds a fourth schedule_type, parallel to schedule_f / schedule_c /
-- schedule_e from migrations 0007 and 0012, plus a single tax category
-- and a matching plain-language farm_category bucket so W-2 income can
-- still be entered and shows up in reports/exports, just never mixed
-- into farm or self-employment totals.
--
-- Informational only -- not a legal or tax determination.
-- =====================================================================

alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check check (schedule_type in ('schedule_f', 'schedule_c', 'schedule_e', 'w2'));

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('income_w2_wages', 'W-2 Wage Income (Not Self-Employment)', 'Form 1040, Line 1a', 'income', 700, 'w2')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Wages (W-2)', 'income_w2_wages')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
