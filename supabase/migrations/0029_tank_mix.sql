-- Tank Mix Calculator: chemical label details on the product record, plus
-- saved tank-mix recipes.
--
-- product gains:
--   restricted_use     - EPA Restricted Use Pesticide (certified applicator
--                        + RUP record keeping required)
--   default_rate/unit  - the label rate you normally run, pre-filled when the
--                        chemical is added to a mix
-- (epa_registration_number, manufacturer, active_ingredient already exist.)
alter table product add column if not exists restricted_use boolean not null default false;
alter table product add column if not exists default_rate numeric(14,4);
alter table product add column if not exists default_rate_unit text;

create table if not exists tank_mix_recipe (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,
  tank_gallons numeric(12,2),
  carrier_gpa numeric(12,3),
  -- [{ productId, name, rate, unit }]
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tank_mix_recipe_farm on tank_mix_recipe (farm_business_id);

alter table tank_mix_recipe enable row level security;
drop policy if exists tank_mix_recipe_all on tank_mix_recipe;
create policy tank_mix_recipe_all on tank_mix_recipe for all using (
  is_farm_member(farm_business_id)
) with check (
  is_farm_member(farm_business_id)
);
