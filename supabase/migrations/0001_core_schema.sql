-- =====================================================================
-- FarmLedger core schema
-- "Farm all year. Be ready at tax time."
--
-- Design principles:
--   1. Facts vs. classification vs. tax rules are separate. A transaction
--      NEVER stores a permanent tax determination -- it stores what
--      happened. Tax treatment lives in tax_rule / tax_rule_version and
--      is applied at read time via tax_opportunity records that point
--      back at the fact, never the reverse.
--   2. Money is NUMERIC(14,2), never float. Acres/quantities are
--      NUMERIC(12,3).
--   3. Every financially meaningful table carries created_by/at and
--      updated_by/at. Nothing is hard-deleted -- soft delete via
--      archived_at / deleted_at so financial history is never silently
--      destroyed.
--   4. Row Level Security enforces farm-membership scoping. Every
--      tenant-owned table has a farm_business_id (directly or via a
--      parent) and a matching RLS policy defined in 0002_rls.sql.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "postgis" schema public;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------

create type user_role as enum (
  'owner_admin', 'manager', 'employee', 'equipment_operator',
  'applicator', 'bookkeeper', 'cpa'
);

create type operation_type as enum (
  'grain', 'row_crop', 'livestock', 'dairy', 'custom_application',
  'hay_forage', 'mixed', 'other'
);

create type transaction_type as enum ('income', 'expense', 'transfer');

create type transaction_status as enum (
  'needs_review', 'categorized', 'reconciled', 'excluded_personal'
);

create type allocation_target_type as enum (
  'field', 'customer_job', 'equipment', 'livestock_group',
  'vehicle', 'general_overhead'
);

create type allocation_method as enum ('acres', 'percentage', 'dollar_amount', 'quantity', 'manual');

create type activity_type as enum (
  'plant', 'spray', 'fertilize', 'harvest', 'till', 'disk', 'cultivate',
  'bale', 'mow', 'irrigate', 'graze', 'scout', 'soil_sample', 'lime',
  'manure', 'conservation', 'other'
);

create type field_ownership as enum ('owned', 'rented_cash', 'rented_crop_share', 'rented_flex');

create type product_category as enum ('chemical', 'fertilizer', 'seed', 'feed', 'veterinary', 'fuel', 'parts_supplies', 'other');

create type inventory_movement_type as enum ('purchase', 'use_own_field', 'use_customer_job', 'adjustment', 'waste_loss', 'transfer');

create type product_source as enum ('our_business', 'customer_supplied');

create type job_status as enum ('scheduled', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled');

create type invoice_status as enum ('draft', 'sent', 'partial', 'paid', 'overdue', 'void');

create type asset_type as enum ('equipment', 'vehicle', 'building', 'land_improvement', 'other');

create type livestock_purpose as enum ('breeding', 'dairy', 'draft', 'resale', 'feeding_production', 'other');

create type livestock_txn_type as enum ('purchase', 'sale', 'birth', 'death_loss', 'transfer_in', 'transfer_out');

create type document_category as enum (
  'receipt', 'invoice', 'tax', 'equipment', 'land', 'insurance',
  'usda_fsa', 'chemical_label', 'sds', 'income', 'loan', 'contract',
  'livestock', 'other'
);

create type sync_status as enum ('saved_offline', 'syncing', 'synced', 'sync_error');

create type cpa_review_status as enum ('open', 'answered', 'reviewed', 'dismissed');

-- ---------------------------------------------------------------------
-- IDENTITY & TENANCY
-- ---------------------------------------------------------------------

-- app_user mirrors auth.users (Supabase-managed) 1:1 by id, adding
-- product-level profile fields.
create table app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table farm_business (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_user(id),
  name text not null,
  legal_entity_type text,               -- LLC, Sole Prop, S-Corp, Partnership...
  operation_type operation_type not null default 'mixed',
  state text,                            -- primary jurisdiction, e.g. 'KS'
  ein text,                              -- optional, never SSN
  address text,
  county text,
  logo_url text,
  current_tax_year int not null default extract(year from now())::int,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table farm_membership (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role user_role not null,
  -- fine-grained overrides layered on top of role defaults
  can_view_financials boolean not null default true,
  can_edit_financials boolean not null default false,
  can_view_tax_records boolean not null default false,
  can_edit_operational_records boolean not null default true,
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (farm_business_id, user_id)
);

create table tax_year (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  year int not null,
  is_closed boolean not null default false,
  closed_at timestamptz,
  notes text,
  unique (farm_business_id, year)
);

-- ---------------------------------------------------------------------
-- FIELDS & CROP YEARS
-- ---------------------------------------------------------------------

create table field (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,
  acres numeric(12,3) not null,
  tillable_acres numeric(12,3),
  ownership field_ownership not null default 'owned',
  landowner_name text,
  rent_arrangement text,
  county text,
  legal_description text,
  fsa_farm_number text,
  fsa_tract_number text,
  fsa_field_number text,
  irrigated boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table field_boundary (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references field(id) on delete cascade,
  boundary geometry(Polygon, 4326),
  calculated_acres numeric(12,3),
  source text not null default 'manual',  -- manual | gps_walk | import
  created_at timestamptz not null default now()
);

create table crop (
  id uuid primary key default gen_random_uuid(),
  name text not null unique  -- Corn, Soybeans, Milo, Wheat, Alfalfa, etc.
);

create table crop_year (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references field(id) on delete cascade,
  tax_year_id uuid not null references tax_year(id),
  crop_id uuid references crop(id),
  planted_acres numeric(12,3),
  expected_yield numeric(12,3),
  yield_unit text,
  actual_yield numeric(12,3),
  notes text,
  created_at timestamptz not null default now(),
  unique (field_id, tax_year_id)
);

-- ---------------------------------------------------------------------
-- CUSTOMERS & CUSTOM WORK
-- ---------------------------------------------------------------------

create table customer (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  billing_address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table customer_field (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customer(id) on delete cascade,
  name text not null,
  acres numeric(12,3),
  county text,
  boundary geometry(Polygon, 4326),
  notes text,
  created_at timestamptz not null default now()
);

create table job_service (
  id uuid primary key default gen_random_uuid(),
  name text not null unique  -- Spraying, Fertilizer App, Planting, Harvest, Baling, Swathing, Tillage, Trucking, Manure, Conservation, Equipment Rental, Other
);

create table job (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  customer_id uuid not null references customer(id),
  customer_field_id uuid references customer_field(id),
  job_service_id uuid not null references job_service(id),
  status job_status not null default 'scheduled',
  scheduled_date date,
  completed_date date,
  acres numeric(12,3),
  rate numeric(14,2),
  rate_unit text default 'per_acre',     -- per_acre | flat | per_hour
  operator_user_id uuid references app_user(id),
  equipment_id uuid,                      -- fk added after asset table
  product_source product_source not null default 'our_business',
  notes text,
  created_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUCTS & INVENTORY
-- ---------------------------------------------------------------------

create table product (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  category product_category not null,
  name text not null,
  manufacturer text,
  epa_registration_number text,          -- chemical only
  default_unit text not null default 'gal',
  active_ingredient text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table inventory_item (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  product_id uuid not null references product(id),
  unit text not null,
  quantity_on_hand numeric(14,3) not null default 0,
  average_unit_cost numeric(14,4) default 0,
  reorder_threshold numeric(14,3),
  storage_location text,
  updated_at timestamptz not null default now(),
  unique (farm_business_id, product_id, unit)
);

create table inventory_movement (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_item(id) on delete cascade,
  movement_type inventory_movement_type not null,
  quantity numeric(14,3) not null,        -- positive = in, negative = out
  unit_cost numeric(14,4),
  related_transaction_id uuid,            -- fk added after transaction table
  related_activity_id uuid,               -- fk added after activity table
  related_job_id uuid references job(id),
  note text,
  created_by uuid references app_user(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FIELD ACTIVITIES (plant / spray / fertilize / harvest / other)
-- ---------------------------------------------------------------------

create table activity (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  activity_type activity_type not null,
  -- exactly one of field_id or customer_field_id should be set
  field_id uuid references field(id),
  crop_year_id uuid references crop_year(id),
  customer_field_id uuid references customer_field(id),
  job_id uuid references job(id),
  activity_date date not null,
  start_time time,
  end_time time,
  acres numeric(12,3),
  equipment_id uuid,                      -- fk added after asset table
  operator_user_id uuid references app_user(id),
  notes text,
  gps_location geometry(Point, 4326),
  weather jsonb,                          -- {temp, wind_speed, wind_dir, humidity, conditions} -- editable
  sync_status sync_status not null default 'synced',
  created_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spray/application-specific detail (1:1 with activity where activity_type='spray')
create table spray_activity_detail (
  activity_id uuid primary key references activity(id) on delete cascade,
  applicator_user_id uuid references app_user(id),
  applicator_certification text,
  carrier text,
  carrier_rate numeric(12,3),
  carrier_rate_unit text,
  tank_mix_notes text,
  label_document_id uuid,                 -- fk added after document table
  sds_document_id uuid
);

create table spray_product_line (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity(id) on delete cascade,
  product_id uuid not null references product(id),
  rate numeric(14,4) not null,
  rate_unit text not null,
  quantity_used numeric(14,4) not null,
  quantity_unit text not null,
  inventory_movement_id uuid references inventory_movement(id)
);

create table planting_activity_detail (
  activity_id uuid primary key references activity(id) on delete cascade,
  crop_id uuid references crop(id),
  seed_product_id uuid references product(id),
  seeding_rate numeric(14,4),
  seeding_rate_unit text,
  population numeric(14,2),
  depth_inches numeric(6,2)
);

create table fertilizer_activity_detail (
  activity_id uuid primary key references activity(id) on delete cascade,
  method text                             -- broadcast, banded, foliar, fertigation
);

create table fertilizer_product_line (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activity(id) on delete cascade,
  product_id uuid not null references product(id),
  rate numeric(14,4) not null,
  rate_unit text not null,
  quantity_used numeric(14,4) not null,
  quantity_unit text not null,
  inventory_movement_id uuid references inventory_movement(id)
);

create table harvest_activity_detail (
  activity_id uuid primary key references activity(id) on delete cascade,
  crop_id uuid references crop(id),
  yield_amount numeric(14,3),
  yield_unit text,
  moisture_pct numeric(6,2),
  destination text                        -- bin, elevator, customer
);

-- ---------------------------------------------------------------------
-- VENDORS, TRANSACTIONS, RECEIPTS
-- ---------------------------------------------------------------------

create table vendor (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,
  category_hint text,
  created_at timestamptz not null default now(),
  unique (farm_business_id, name)
);

create table tax_category (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,             -- e.g. 'schf_seed', 'schf_chemicals'
  label text not null,                    -- "Seeds & Plants (Sch F Line 15)"
  schedule_reference text,                -- e.g. "Schedule F, Line 15"
  income_or_expense text not null default 'expense',
  sort_order int not null default 0
);

create table farm_category (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid references farm_business(id) on delete cascade,  -- null = global default
  name text not null,                     -- "Chemical", "Seed", "Fuel", "Rent", "Insurance", ...
  parent_category_id uuid references farm_category(id),
  default_tax_category_id uuid references tax_category(id)
);

create table document (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  category document_category not null,
  file_name text not null,
  storage_path text not null,             -- Supabase Storage object path
  mime_type text,
  file_size_bytes bigint,
  related_field_id uuid references field(id),
  related_equipment_asset_id uuid,
  related_livestock_group_id uuid,
  tags text[] default '{}',
  uploaded_by uuid references app_user(id),
  created_at timestamptz not null default now()
);

alter table spray_activity_detail
  add constraint spray_activity_detail_label_fk foreign key (label_document_id) references document(id),
  add constraint spray_activity_detail_sds_fk foreign key (sds_document_id) references document(id);

create table receipt (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  document_id uuid references document(id),
  captured_by uuid references app_user(id),
  capture_source text not null default 'mobile_camera',  -- mobile_camera | web_upload | web_drag_drop
  ocr_status text not null default 'pending',             -- pending | processed | confirmed | failed
  ocr_raw jsonb,                          -- raw model output, never authoritative until confirmed
  ocr_vendor_guess text,
  ocr_date_guess date,
  ocr_amount_guess numeric(14,2),
  ocr_tax_guess numeric(14,2),
  ocr_line_items jsonb,
  confirmed_at timestamptz,
  sync_status sync_status not null default 'synced',
  created_at timestamptz not null default now()
);

create table transaction (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  tax_year_id uuid not null references tax_year(id),
  transaction_type transaction_type not null,
  status transaction_status not null default 'needs_review',
  transaction_date date not null,
  vendor_id uuid references vendor(id),
  customer_id uuid references customer(id),
  description text,
  amount numeric(14,2) not null,          -- gross amount, always positive; type carries sign
  sales_tax numeric(14,2) default 0,
  payment_method text,
  farm_category_id uuid references farm_category(id),
  tax_category_id uuid references tax_category(id),
  receipt_id uuid references receipt(id),
  bank_import_id uuid,                    -- fk added after bank_import_transaction table
  is_personal_excluded boolean not null default false,
  cpa_flag boolean not null default false,
  cpa_note text,
  sync_status sync_status not null default 'synced',
  created_by uuid references app_user(id),
  created_at timestamptz not null default now(),
  updated_by uuid references app_user(id),
  updated_at timestamptz not null default now()
);

alter table inventory_movement
  add constraint inventory_movement_txn_fk foreign key (related_transaction_id) references transaction(id),
  add constraint inventory_movement_activity_fk foreign key (related_activity_id) references activity(id);

-- A transaction may be split across multiple allocation targets
-- (fields, jobs, equipment, livestock, or general overhead).
create table transaction_split (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transaction(id) on delete cascade,
  target_type allocation_target_type not null,
  field_id uuid references field(id),
  crop_year_id uuid references crop_year(id),
  job_id uuid references job(id),
  equipment_asset_id uuid,
  livestock_group_id uuid,
  vehicle_asset_id uuid,
  allocation_method allocation_method not null default 'manual',
  allocated_amount numeric(14,2) not null,
  allocated_percentage numeric(6,3),
  farm_category_id uuid references farm_category(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INVOICING & PAYMENTS
-- ---------------------------------------------------------------------

create table invoice (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  customer_id uuid not null references customer(id),
  invoice_number text not null,
  status invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null default 0,
  additional_charges numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  pdf_document_id uuid references document(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (farm_business_id, invoice_number)
);

create table invoice_line (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoice(id) on delete cascade,
  job_id uuid references job(id),
  description text not null,
  quantity numeric(14,3) default 1,
  unit_rate numeric(14,2) not null,
  amount numeric(14,2) not null,
  sort_order int not null default 0
);

create table payment (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  invoice_id uuid references invoice(id),
  customer_id uuid not null references customer(id),
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_method text,
  income_transaction_id uuid references transaction(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ASSETS: EQUIPMENT, VEHICLES, BUILDINGS
-- ---------------------------------------------------------------------

create table asset (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  asset_type asset_type not null,
  name text not null,
  make text,
  model text,
  year int,
  vin_or_serial text,
  purchase_date date,
  purchase_price numeric(14,2),
  placed_in_service_date date,
  business_use_percent numeric(5,2) default 100,
  vendor_id uuid references vendor(id),
  financing_notes text,
  trade_in_asset_id uuid references asset(id),
  status text not null default 'active',   -- active | sold | traded | retired
  sold_date date,
  sold_price numeric(14,2),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table job add constraint job_equipment_fk foreign key (equipment_id) references asset(id);
alter table activity add constraint activity_equipment_fk foreign key (equipment_id) references asset(id);
alter table transaction_split add constraint split_equipment_fk foreign key (equipment_asset_id) references asset(id);
alter table transaction_split add constraint split_vehicle_fk foreign key (vehicle_asset_id) references asset(id);
alter table document add constraint document_equipment_fk foreign key (related_equipment_asset_id) references asset(id);

create table asset_repair (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references asset(id) on delete cascade,
  repair_date date not null,
  description text not null,
  cost numeric(14,2),
  transaction_id uuid references transaction(id),
  vendor_id uuid references vendor(id),
  odometer_or_hours numeric(14,2),
  created_at timestamptz not null default now()
);

create table mileage_trip (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  vehicle_asset_id uuid not null references asset(id),
  trip_date date not null,
  miles numeric(10,2) not null,
  purpose text,
  field_id uuid references field(id),
  customer_id uuid references customer(id),
  job_id uuid references job(id),
  source text not null default 'manual',   -- manual | gps
  notes text,
  sync_status sync_status not null default 'synced',
  created_by uuid references app_user(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- LIVESTOCK
-- ---------------------------------------------------------------------

create table livestock_group (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  name text not null,                     -- "Cow-Calf Herd", "2026 Feeder Steers"
  species text not null default 'cattle',
  purpose livestock_purpose not null default 'other',
  head_count int not null default 0,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table document add constraint document_livestock_fk foreign key (related_livestock_group_id) references livestock_group(id);

create table livestock_transaction (
  id uuid primary key default gen_random_uuid(),
  livestock_group_id uuid not null references livestock_group(id) on delete cascade,
  txn_type livestock_txn_type not null,
  txn_date date not null,
  head_count int not null default 1,
  total_amount numeric(14,2),
  weight_lbs numeric(12,2),
  transaction_id uuid references transaction(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- LOANS
-- ---------------------------------------------------------------------

create table loan (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  lender_name text not null,
  original_principal numeric(14,2),
  origination_date date,
  interest_rate numeric(6,3),
  term_months int,
  related_asset_id uuid references asset(id),
  current_balance numeric(14,2),
  notes text,
  created_at timestamptz not null default now()
);

create table loan_payment (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loan(id) on delete cascade,
  payment_date date not null,
  principal_amount numeric(14,2) not null default 0,
  interest_amount numeric(14,2) not null default 0,
  transaction_id uuid references transaction(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- BANK INTEGRATION
-- ---------------------------------------------------------------------

create table bank_connection (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  provider text not null default 'plaid',
  institution_name text,
  provider_item_id text,                  -- Plaid item_id, encrypted at rest by provider
  status text not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table bank_import_transaction (
  id uuid primary key default gen_random_uuid(),
  bank_connection_id uuid not null references bank_connection(id) on delete cascade,
  provider_transaction_id text not null,
  posted_date date not null,
  raw_description text,
  amount numeric(14,2) not null,
  suggested_vendor_id uuid references vendor(id),
  suggested_farm_category_id uuid references farm_category(id),
  matched_receipt_id uuid references receipt(id),
  matched_transaction_id uuid references transaction(id),
  status text not null default 'unmatched', -- unmatched | matched | ignored | duplicate
  created_at timestamptz not null default now(),
  unique (bank_connection_id, provider_transaction_id)
);

alter table transaction add constraint transaction_bank_import_fk foreign key (bank_import_id) references bank_import_transaction(id);

-- ---------------------------------------------------------------------
-- TAX RULE ENGINE (separate from facts!)
-- ---------------------------------------------------------------------

create table jurisdiction (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 'US-FEDERAL', 'US-KS', ...
  name text not null
);

create table tax_rule (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- 'section_179', 'bonus_depreciation', 'prepaid_input_limit', ...
  title text not null,
  description text not null,
  trigger_event text not null,            -- 'equipment_purchase' | 'equipment_sale' | 'vehicle' | ... (RuleTrigger)
  jurisdiction_id uuid references jurisdiction(id)
);

create table tax_rule_version (
  id uuid primary key default gen_random_uuid(),
  tax_rule_id uuid not null references tax_rule(id) on delete cascade,
  effective_tax_year int not null,
  summary text not null,
  official_reference text,                -- citation / URL, informational only
  required_questions jsonb not null default '[]'::jsonb,
  required_documents document_category[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tax_rule_id, effective_tax_year)
);

-- Generated (or user-triggered) flag linking a fact to a potential rule,
-- WITHOUT asserting any tax treatment.
create table tax_opportunity (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  tax_year_id uuid not null references tax_year(id),
  tax_rule_version_id uuid not null references tax_rule_version(id),
  source_transaction_id uuid references transaction(id),
  source_asset_id uuid references asset(id),
  source_livestock_txn_id uuid references livestock_transaction(id),
  status text not null default 'open',    -- open | info_needed | ready_for_cpa | dismissed
  info_collected jsonb not null default '{}'::jsonb,
  info_missing text[] not null default '{}',
  documents_collected uuid[] not null default '{}',  -- document ids
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tax_question (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  tax_year_id uuid not null references tax_year(id),
  related_tax_opportunity_id uuid references tax_opportunity(id),
  question text not null,
  raised_by uuid references app_user(id),
  status cpa_review_status not null default 'open',
  cpa_response text,
  responded_by uuid references app_user(id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table cpa_review (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  tax_year_id uuid not null references tax_year(id),
  transaction_id uuid references transaction(id),
  reviewed_by uuid references app_user(id),
  reviewed_at timestamptz not null default now(),
  comment text,
  is_flagged_changed boolean not null default false
);

-- ---------------------------------------------------------------------
-- SYSTEM: NOTIFICATIONS, AUDIT, EXPORTS
-- ---------------------------------------------------------------------

create table notification (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  user_id uuid references app_user(id),
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null,                   -- insert | update | delete | archive
  changed_by uuid references app_user(id),
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table export_job (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid not null references farm_business(id) on delete cascade,
  requested_by uuid references app_user(id),
  export_type text not null,              -- 'full_workbook' | 'cpa_workbook' | 'field_report' | 'custom_work_report' | 'spray_export' | 'cpa_package'
  tax_year int,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'pending', -- pending | processing | complete | failed
  storage_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table report_definition (
  id uuid primary key default gen_random_uuid(),
  farm_business_id uuid references farm_business(id) on delete cascade,
  name text not null,
  report_key text not null,
  saved_filters jsonb not null default '{}'::jsonb,
  created_by uuid references app_user(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------

create index idx_transaction_farm_year on transaction (farm_business_id, tax_year_id);
create index idx_transaction_date on transaction (transaction_date);
create index idx_transaction_status on transaction (status) where status = 'needs_review';
create index idx_split_field on transaction_split (field_id);
create index idx_split_job on transaction_split (job_id);
create index idx_activity_field_date on activity (field_id, activity_date);
create index idx_activity_customer_field on activity (customer_field_id);
create index idx_field_farm on field (farm_business_id);
create index idx_job_farm_status on job (farm_business_id, status);
create index idx_invoice_farm_status on invoice (farm_business_id, status);
create index idx_asset_farm on asset (farm_business_id);
create index idx_mileage_farm_date on mileage_trip (farm_business_id, trip_date);
create index idx_tax_opportunity_farm_year on tax_opportunity (farm_business_id, tax_year_id, status);
create index idx_document_farm_category on document (farm_business_id, category);
create index idx_inventory_movement_item on inventory_movement (inventory_item_id);
create index idx_receipt_farm_status on receipt (farm_business_id, ocr_status);
