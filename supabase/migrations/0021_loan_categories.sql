-- =====================================================================
-- Loan proceeds & principal repayment — kept OFF Schedule F on purpose.
--
-- Borrowing money isn't income (it has to be paid back), and repaying
-- the principal you borrowed isn't a deductible business expense (it's
-- not a cost of doing business, it's returning money that was never
-- yours). Only the INTEREST portion of a loan payment is deductible,
-- and that already has its own home: exp_interest_mortgage /
-- exp_interest_other (Schedule F, Line 21a/21b) -- use one of those for
-- the interest slice of a payment, same as any other loan interest.
--
-- These two categories exist purely so the principal side of a loan
-- draw or a loan payment can be logged as an actual transaction (so
-- the books balance and the cash movement is on record) without ever
-- being summed into farm income, farm expenses, or Schedule F. Same
-- mechanism as W-2 wages (0018) and the house project (0020): a
-- dedicated schedule_type kept out of every schedule-total filter.
--
-- Informational only -- not a legal or tax determination.
-- =====================================================================

alter table tax_category drop constraint if exists tax_category_schedule_type_check;
alter table tax_category add constraint tax_category_schedule_type_check check (schedule_type in ('schedule_f', 'schedule_c', 'schedule_e', 'w2', 'real_estate', 'loan'));

insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order, schedule_type) values
  ('income_loan_proceeds', 'Loan Proceeds Received (Not Income)', 'Not reported as income — it''s borrowed money, not earnings', 'income', 820, 'loan'),
  ('exp_loan_principal', 'Loan Principal Repayment (Not a Deductible Expense)', 'Not deductible — only the interest portion of a payment is (see Interest — Mortgage / Interest — Other)', 'expense', 825, 'loan')
on conflict (code) do update set
  label = excluded.label, schedule_reference = excluded.schedule_reference,
  income_or_expense = excluded.income_or_expense, sort_order = excluded.sort_order, schedule_type = excluded.schedule_type;

insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Loan Proceeds Received', 'income_loan_proceeds'),
  ('Loan Principal Payment', 'exp_loan_principal')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);
