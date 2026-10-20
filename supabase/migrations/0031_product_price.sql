-- Prices Paid: every purchase of a chemical (or fertilizer / seed) with its
-- quantity, so the Chemicals tab can show the average, lowest and highest
-- price paid per unit for billing breakdowns.
--
-- This is a price record only. It does not create an expense transaction
-- (those already come from receipts, statements and Allocate Product Cost),
-- so importing purchase history here never double-counts a cost.
create table if not exists product_price (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  product_name text not null,
  category text,
  purchase_date date,
  vendor text,
  quantity numeric(14,4) not null,
  unit text not null,
  total_amount numeric(14,2) not null,
  invoice text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_price_farm on product_price (farm_business_id, lower(product_name));

alter table product_price enable row level security;
drop policy if exists product_price_all on product_price;
create policy product_price_all on product_price for all using (
  is_farm_member(farm_business_id)
) with check (
  is_farm_member(farm_business_id)
);
