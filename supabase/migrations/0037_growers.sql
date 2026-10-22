-- Growers: who each field is farmed for (AgFiniti's "Grower": Mohler Farms,
-- Dennis Mohler, Gerald...). Used to total field cost per grower and bill
-- the ones you farm for: product at your cost (+ an optional markup) and
-- work at a per-acre rate by job type.
alter table field add column if not exists grower text;

create table if not exists grower (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,
  -- Your own farming: shown for cost, never billed.
  own_farm boolean not null default false,
  -- Buys their own product: their fields are left out of product cost splits.
  supplies_own_inputs boolean not null default false,
  markup_pct numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (farm_business_id, name)
);

create table if not exists billing_rate (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  activity_type text not null,
  rate_per_acre numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (farm_business_id, activity_type)
);

alter table grower enable row level security;
drop policy if exists grower_all on grower;
create policy grower_all on grower for all using (is_farm_member(farm_business_id)) with check (is_farm_member(farm_business_id));

alter table billing_rate enable row level security;
drop policy if exists billing_rate_all on billing_rate;
create policy billing_rate_all on billing_rate for all using (is_farm_member(farm_business_id)) with check (is_farm_member(farm_business_id));
