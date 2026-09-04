-- =====================================================================
-- create_receipt_and_expense() (added in migration 0009) never set
-- tax_category_id on the transaction it inserts — only farm_category_id.
-- That's true of every insert path in the old app code too (fixed
-- separately in the JS layer), but this one runs entirely in the
-- database, so it needs its own fix: derive tax_category_id from the
-- chosen farm category's own default_tax_category_id, same as everywhere
-- else now does.
-- =====================================================================

create or replace function create_receipt_and_expense(
  p_farm_business_id uuid,
  p_file_name text,
  p_file_data_url text,
  p_capture_source text,
  p_vendor_name text,
  p_transaction_date date,
  p_amount numeric,
  p_sales_tax numeric,
  p_farm_category_id uuid,
  p_field_id uuid
) returns table (receipt_id uuid, transaction_id uuid)
language plpgsql
security invoker
as $$
declare
  v_tax_year_id uuid;
  v_vendor_id uuid;
  v_receipt_id uuid;
  v_transaction_id uuid;
  v_tax_category_id uuid;
  v_year int := extract(year from p_transaction_date)::int;
begin
  insert into tax_year (farm_business_id, year)
  values (p_farm_business_id, v_year)
  on conflict (farm_business_id, year) do update set year = excluded.year
  returning id into v_tax_year_id;

  if p_vendor_name is not null and length(trim(p_vendor_name)) > 0 then
    insert into vendor (farm_business_id, name)
    values (p_farm_business_id, p_vendor_name)
    on conflict (farm_business_id, name) do update set name = excluded.name
    returning id into v_vendor_id;
  end if;

  if p_farm_category_id is not null then
    select default_tax_category_id into v_tax_category_id
    from farm_category where id = p_farm_category_id;
  end if;

  insert into receipt (
    farm_business_id, file_name, file_data_url, capture_source, ocr_status,
    ocr_vendor_guess, ocr_date_guess, ocr_amount_guess, ocr_tax_guess, sync_status, confirmed_at
  ) values (
    p_farm_business_id, p_file_name, p_file_data_url, p_capture_source, 'confirmed',
    p_vendor_name, p_transaction_date, p_amount, p_sales_tax, 'synced', now()
  ) returning id into v_receipt_id;

  insert into transaction (
    farm_business_id, tax_year_id, transaction_type, status, transaction_date,
    vendor_id, description, amount, sales_tax, farm_category_id, tax_category_id, receipt_id,
    is_personal_excluded, cpa_flag, sync_status
  ) values (
    p_farm_business_id, v_tax_year_id, 'expense', 'categorized', p_transaction_date,
    v_vendor_id, 'Receipt — ' || coalesce(p_vendor_name, 'upload'), p_amount, coalesce(p_sales_tax, 0),
    p_farm_category_id, v_tax_category_id, v_receipt_id, false, false, 'synced'
  ) returning id into v_transaction_id;

  insert into transaction_split (
    transaction_id, target_type, field_id, allocation_method, allocated_amount, farm_category_id
  ) values (
    v_transaction_id, case when p_field_id is not null then 'field' else 'general_overhead' end,
    p_field_id, 'manual', p_amount, p_farm_category_id
  );

  return query select v_receipt_id, v_transaction_id;
end;
$$;

grant execute on function create_receipt_and_expense(
  uuid, text, text, text, text, date, numeric, numeric, uuid, uuid
) to authenticated;

-- Immediate relief for every already-uploaded transaction that has a farm
-- category but is still missing its tax category — the same backfill the
-- in-app "Fix Missing Tax Categories" button (Settings) runs, available
-- here too since this is exactly the kind of thing worth fixing the moment
-- this migration is applied, not waiting on a button click.
update transaction t
set tax_category_id = fc.default_tax_category_id
from farm_category fc
where t.farm_category_id = fc.id
  and fc.default_tax_category_id is not null
  and t.tax_category_id is distinct from fc.default_tax_category_id;
