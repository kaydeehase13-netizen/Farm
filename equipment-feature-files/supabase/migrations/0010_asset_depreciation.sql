-- Adds simple straight-line depreciation inputs to equipment/assets, so the
-- Equipment page can show an annual depreciation amount and current book
-- value alongside purchase price, without requiring a full MACRS schedule.
alter table asset add column if not exists useful_life_years numeric(5,1);
alter table asset add column if not exists salvage_value numeric(14,2) default 0;
