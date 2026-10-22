-- Hourly work (harvest): a rate can be per acre or per hour, and the hours
-- worked for each grower are entered per year on the Grower Billing page.
alter table billing_rate add column if not exists unit text not null default 'acre';

create table if not exists billing_hours (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  year int not null,
  grower text not null,
  activity_type text not null,
  hours numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (farm_business_id, year, grower, activity_type)
);

alter table billing_hours enable row level security;
drop policy if exists billing_hours_all on billing_hours;
create policy billing_hours_all on billing_hours for all using (is_farm_member(farm_business_id)) with check (is_farm_member(farm_business_id));
