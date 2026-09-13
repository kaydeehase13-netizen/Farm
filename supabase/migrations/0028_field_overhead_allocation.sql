-- Field Overhead Allocation: a manual, per-field dollar figure for costs
-- that are real farm expenses but aren't naturally tied to one field on
-- their own (insurance premiums, equipment ownership cost, equipment
-- repairs/maintenance) — recorded elsewhere as the REAL deductible expense
-- transaction. This table exists purely so a field's displayed margin can
-- reflect a fair share of that overhead without double-counting it as a
-- second real expense: nothing here is a `transaction` row, so it never
-- touches Schedule F, the dashboard income/expense totals, or any tax
-- export — it only feeds allFieldProfitability's per-field margin math.
-- Deliberately opt-in per field (never auto-applied to "every field") since
-- not every field is actually owned/operated the same way.
create table field_overhead_allocation (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  field_id uuid not null references field(id) on delete cascade,
  tax_year int not null,
  category text not null check (category in ('insurance', 'equipment_ownership', 'equipment_repairs')),
  amount numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_field_overhead_allocation_field on field_overhead_allocation (field_id, tax_year);
create index idx_field_overhead_allocation_farm_year on field_overhead_allocation (farm_business_id, tax_year);

alter table field_overhead_allocation enable row level security;
drop policy if exists field_overhead_allocation_view on field_overhead_allocation;
drop policy if exists field_overhead_allocation_write on field_overhead_allocation;
create policy field_overhead_allocation_view on field_overhead_allocation for select using (
  can_view_financials(farm_business_id)
);
create policy field_overhead_allocation_write on field_overhead_allocation for all using (
  can_edit_financials(farm_business_id)
) with check (
  can_edit_financials(farm_business_id)
);
