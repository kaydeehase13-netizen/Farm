-- =====================================================================
-- Oil & gas / mineral royalty income categorization (Schedule E).
--
-- Royalty income from oil, gas, and mineral interests generally does NOT
-- go on Schedule F with the rest of the farm income — it's reported on
-- Schedule E (Supplemental Income and Loss), Part I. Until now FarmLedger
-- had no categories for this at all, so any receipt covering oil/mineral
-- royalties (even combined with unrelated income on the same receipt) had
-- nowhere correct to go. This adds a third schedule_type, parallel to the
-- existing schedule_f / schedule_c split added in migration 0007.
--
-- Informational only — not a legal or tax determination. Confirm the
-- right category and placement with your CPA.
-- =====================================================================

alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check check (schedule_type in ('schedule_f', 'schedule_c', 'schedule_e'));

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('income_oil_gas_royalty', 'Oil & Gas Royalty Income', 'Schedule E, Part I', 'income', 600, 'schedule_e'),
  ('income_mineral_royalty', 'Mineral Royalty Income (Non-Oil/Gas)', 'Schedule E, Part I', 'income', 605, 'schedule_e'),
  ('income_oil_gas_lease_bonus', 'Oil & Gas Lease Bonus / Delay Rental', 'Schedule E, Part I', 'income', 610, 'schedule_e'),
  ('exp_royalty_related', 'Royalty-Related Expenses (Legal, Admin — Ask Your CPA About Depletion)', 'Schedule E, Part I', 'expense', 615, 'schedule_e')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

-- Plain-language farm_category buckets, prefixed "Royalty:" so they're
-- easy to pick out in dropdowns and easy to tell apart from farm/SE ones.
insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Royalty: Oil & Gas Income', 'income_oil_gas_royalty'),
  ('Royalty: Mineral Income', 'income_mineral_royalty'),
  ('Royalty: Lease Bonus / Delay Rental', 'income_oil_gas_lease_bonus'),
  ('Royalty: Related Expenses', 'exp_royalty_related')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
