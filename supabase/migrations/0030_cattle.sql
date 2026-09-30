-- Cattle herd list, kept in sync with a Google Sheet.
--
-- One row per animal, keyed by ear tag. Calf records stay in the same
-- shape as the sheet: one free-text entry per year ("M; 3/16; BMF").
-- status: current | gone (sold/dead, with reason + year) | removed
-- (deleted from the sheet or the website; kept so a sync can't bring it back).
create table if not exists cattle (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  tag text not null,
  name text,
  notes text,
  calves jsonb not null default '{}'::jsonb,
  status text not null default 'current' check (status in ('current', 'gone', 'removed')),
  gone_reason text,
  gone_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_business_id, tag)
);
create index if not exists idx_cattle_farm on cattle (farm_business_id, status);

alter table cattle enable row level security;
drop policy if exists cattle_all on cattle;
create policy cattle_all on cattle for all using (
  is_farm_member(farm_business_id)
) with check (
  is_farm_member(farm_business_id)
);

-- The Google Sheet's sync key. Only a SHA-256 hash is stored; the key itself
-- is shown once when it's made and lives in the sheet's Apps Script.
create table if not exists cattle_sync_key (
  farm_business_id uuid primary key references farm_business(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz
);
alter table cattle_sync_key enable row level security;
drop policy if exists cattle_sync_key_all on cattle_sync_key;
create policy cattle_sync_key_all on cattle_sync_key for all using (
  is_farm_member(farm_business_id)
) with check (
  is_farm_member(farm_business_id)
);
