-- =====================================================================
-- Row Level Security
-- Every tenant table is scoped to farm_business_id (directly, or via a
-- parent join for line-item tables). Access is granted through
-- farm_membership. Financial visibility additionally checks
-- can_view_financials / can_view_tax_records so an Applicator role can
-- write spray records without ever reading Money/Tax data, per spec.
--
-- This file is safe to re-run: every "create policy" is preceded by a
-- matching "drop policy if exists", so an interrupted or partial
-- earlier run never blocks a later one.
-- =====================================================================

create or replace function is_farm_member(target_farm uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from farm_membership m
    where m.farm_business_id = target_farm
      and m.user_id = auth.uid()
      and m.accepted_at is not null
  );
$$;

create or replace function can_view_financials(target_farm uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from farm_membership m
    where m.farm_business_id = target_farm
      and m.user_id = auth.uid()
      and m.accepted_at is not null
      and m.can_view_financials
  );
$$;

create or replace function can_view_tax(target_farm uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from farm_membership m
    where m.farm_business_id = target_farm
      and m.user_id = auth.uid()
      and m.accepted_at is not null
      and m.can_view_tax_records
  );
$$;

create or replace function can_edit_financials(target_farm uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from farm_membership m
    where m.farm_business_id = target_farm
      and m.user_id = auth.uid()
      and m.accepted_at is not null
      and m.can_edit_financials
  );
$$;

-- app_user: users can read/update their own row
alter table app_user enable row level security;
drop policy if exists app_user_self on app_user;
create policy app_user_self on app_user for select using (id = auth.uid());
drop policy if exists app_user_self_update on app_user;
create policy app_user_self_update on app_user for update using (id = auth.uid());

-- farm_business: visible to members
alter table farm_business enable row level security;
drop policy if exists farm_business_member_select on farm_business;
create policy farm_business_member_select on farm_business for select using (is_farm_member(id));
drop policy if exists farm_business_owner_write on farm_business;
create policy farm_business_owner_write on farm_business for all using (owner_user_id = auth.uid());

-- farm_membership: visible to fellow members; only owner/manager writes
alter table farm_membership enable row level security;
drop policy if exists farm_membership_select on farm_membership;
create policy farm_membership_select on farm_membership for select using (is_farm_member(farm_business_id));

-- Generic operational tables: any accepted member can read & write
-- (write permission further narrowed in application layer by role).
do $$
declare
  t text;
  operational_tables text[] := array[
    'tax_year','field','customer',
    'job','product','inventory_item','activity','vendor',
    'document','asset','mileage_trip','livestock_group',
    'notification','export_job','bank_connection'
  ];
begin
  foreach t in array operational_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_member_all on %I', t, t);
    execute format(
      'create policy %I_member_all on %I for all using (is_farm_member(farm_business_id)) with check (is_farm_member(farm_business_id))',
      t, t
    );
  end loop;
end $$;

-- Tables scoped through a parent (no farm_business_id column of their own)
alter table field_boundary enable row level security;
drop policy if exists field_boundary_all on field_boundary;
create policy field_boundary_all on field_boundary for all using (
  exists (select 1 from field f where f.id = field_boundary.field_id and is_farm_member(f.farm_business_id))
) with check (
  exists (select 1 from field f where f.id = field_boundary.field_id and is_farm_member(f.farm_business_id))
);

alter table crop_year enable row level security;
drop policy if exists crop_year_all on crop_year;
create policy crop_year_all on crop_year for all using (
  exists (select 1 from field f where f.id = crop_year.field_id and is_farm_member(f.farm_business_id))
) with check (
  exists (select 1 from field f where f.id = crop_year.field_id and is_farm_member(f.farm_business_id))
);

alter table customer_field enable row level security;
drop policy if exists customer_field_all on customer_field;
create policy customer_field_all on customer_field for all using (
  exists (select 1 from customer c where c.id = customer_field.customer_id and is_farm_member(c.farm_business_id))
) with check (
  exists (select 1 from customer c where c.id = customer_field.customer_id and is_farm_member(c.farm_business_id))
);

alter table asset_repair enable row level security;
drop policy if exists asset_repair_all on asset_repair;
create policy asset_repair_all on asset_repair for all using (
  exists (select 1 from asset a where a.id = asset_repair.asset_id and can_view_financials(a.farm_business_id))
) with check (
  exists (select 1 from asset a where a.id = asset_repair.asset_id and can_edit_financials(a.farm_business_id))
);

-- farm_category: farm_business_id is null for global defaults, which are
-- readable by any authenticated user but only editable when farm-owned.
alter table farm_category enable row level security;
drop policy if exists farm_category_select on farm_category;
create policy farm_category_select on farm_category for select using (
  farm_business_id is null or is_farm_member(farm_business_id)
);
drop policy if exists farm_category_write on farm_category;
create policy farm_category_write on farm_category for all using (
  farm_business_id is not null and is_farm_member(farm_business_id)
) with check (
  farm_business_id is not null and is_farm_member(farm_business_id)
);

-- report_definition: same null-is-global convention as farm_category.
alter table report_definition enable row level security;
drop policy if exists report_definition_select on report_definition;
create policy report_definition_select on report_definition for select using (
  farm_business_id is null or is_farm_member(farm_business_id)
);
drop policy if exists report_definition_write on report_definition;
create policy report_definition_write on report_definition for all using (
  farm_business_id is not null and is_farm_member(farm_business_id)
) with check (
  farm_business_id is not null and is_farm_member(farm_business_id)
);

-- Financial tables: read requires can_view_financials, write requires can_edit_financials
do $$
declare
  t text;
  financial_tables text[] := array['transaction','receipt','invoice','payment','loan'];
begin
  foreach t in array financial_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_view on %I', t, t);
    execute format(
      'create policy %I_view on %I for select using (can_view_financials(farm_business_id))',
      t, t
    );
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format(
      'create policy %I_write on %I for insert with check (can_edit_financials(farm_business_id))',
      t, t
    );
    execute format('drop policy if exists %I_update on %I', t, t);
    execute format(
      'create policy %I_update on %I for update using (can_edit_financials(farm_business_id))',
      t, t
    );
  end loop;
end $$;

-- Tax tables: require can_view_tax
do $$
declare
  t text;
  tax_tables text[] := array['tax_opportunity','tax_question','cpa_review'];
begin
  foreach t in array tax_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_tax_view on %I', t, t);
    execute format(
      'create policy %I_tax_view on %I for select using (can_view_tax(farm_business_id))',
      t, t
    );
    execute format('drop policy if exists %I_tax_write on %I', t, t);
    execute format(
      'create policy %I_tax_write on %I for all using (can_view_tax(farm_business_id)) with check (can_view_tax(farm_business_id))',
      t, t
    );
  end loop;
end $$;

-- Reference/lookup tables are world-readable to authenticated users
alter table crop enable row level security;
drop policy if exists crop_read on crop;
create policy crop_read on crop for select using (auth.role() = 'authenticated');
alter table job_service enable row level security;
drop policy if exists job_service_read on job_service;
create policy job_service_read on job_service for select using (auth.role() = 'authenticated');
alter table tax_category enable row level security;
drop policy if exists tax_category_read on tax_category;
create policy tax_category_read on tax_category for select using (auth.role() = 'authenticated');
alter table jurisdiction enable row level security;
drop policy if exists jurisdiction_read on jurisdiction;
create policy jurisdiction_read on jurisdiction for select using (auth.role() = 'authenticated');
alter table tax_rule enable row level security;
drop policy if exists tax_rule_read on tax_rule;
create policy tax_rule_read on tax_rule for select using (auth.role() = 'authenticated');
alter table tax_rule_version enable row level security;
drop policy if exists tax_rule_version_read on tax_rule_version;
create policy tax_rule_version_read on tax_rule_version for select using (auth.role() = 'authenticated');

-- Child/detail tables inherit farm scoping via their parent activity/job/invoice
alter table transaction_split enable row level security;
drop policy if exists transaction_split_all on transaction_split;
create policy transaction_split_all on transaction_split for all using (
  exists (select 1 from transaction t where t.id = transaction_split.transaction_id and can_view_financials(t.farm_business_id))
);

alter table invoice_line enable row level security;
drop policy if exists invoice_line_all on invoice_line;
create policy invoice_line_all on invoice_line for all using (
  exists (select 1 from invoice i where i.id = invoice_line.invoice_id and can_view_financials(i.farm_business_id))
);

alter table spray_activity_detail enable row level security;
drop policy if exists spray_detail_all on spray_activity_detail;
create policy spray_detail_all on spray_activity_detail for all using (
  exists (select 1 from activity a where a.id = spray_activity_detail.activity_id and is_farm_member(a.farm_business_id))
);
alter table spray_product_line enable row level security;
drop policy if exists spray_line_all on spray_product_line;
create policy spray_line_all on spray_product_line for all using (
  exists (select 1 from activity a where a.id = spray_product_line.activity_id and is_farm_member(a.farm_business_id))
);
alter table planting_activity_detail enable row level security;
drop policy if exists planting_detail_all on planting_activity_detail;
create policy planting_detail_all on planting_activity_detail for all using (
  exists (select 1 from activity a where a.id = planting_activity_detail.activity_id and is_farm_member(a.farm_business_id))
);
alter table fertilizer_activity_detail enable row level security;
drop policy if exists fert_detail_all on fertilizer_activity_detail;
create policy fert_detail_all on fertilizer_activity_detail for all using (
  exists (select 1 from activity a where a.id = fertilizer_activity_detail.activity_id and is_farm_member(a.farm_business_id))
);
alter table fertilizer_product_line enable row level security;
drop policy if exists fert_line_all on fertilizer_product_line;
create policy fert_line_all on fertilizer_product_line for all using (
  exists (select 1 from activity a where a.id = fertilizer_product_line.activity_id and is_farm_member(a.farm_business_id))
);
alter table harvest_activity_detail enable row level security;
drop policy if exists harvest_detail_all on harvest_activity_detail;
create policy harvest_detail_all on harvest_activity_detail for all using (
  exists (select 1 from activity a where a.id = harvest_activity_detail.activity_id and is_farm_member(a.farm_business_id))
);

alter table inventory_movement enable row level security;
drop policy if exists inventory_movement_all on inventory_movement;
create policy inventory_movement_all on inventory_movement for all using (
  exists (select 1 from inventory_item ii where ii.id = inventory_movement.inventory_item_id and is_farm_member(ii.farm_business_id))
);

alter table livestock_transaction enable row level security;
drop policy if exists livestock_txn_all on livestock_transaction;
create policy livestock_txn_all on livestock_transaction for all using (
  exists (select 1 from livestock_group g where g.id = livestock_transaction.livestock_group_id and is_farm_member(g.farm_business_id))
);

alter table loan_payment enable row level security;
drop policy if exists loan_payment_all on loan_payment;
create policy loan_payment_all on loan_payment for all using (
  exists (select 1 from loan l where l.id = loan_payment.loan_id and can_view_financials(l.farm_business_id))
);

alter table bank_import_transaction enable row level security;
drop policy if exists bank_import_all on bank_import_transaction;
create policy bank_import_all on bank_import_transaction for all using (
  exists (select 1 from bank_connection c where c.id = bank_import_transaction.bank_connection_id and can_view_financials(c.farm_business_id))
);

alter table audit_log enable row level security;
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select using (is_farm_member(farm_business_id));
