-- =====================================================================
-- Saving one receipt-and-expense from the app was doing 4+ sequential
-- round trips to Supabase (get/create tax year, get/create vendor, insert
-- receipt, insert transaction, insert split) — each one adds real,
-- user-visible latency on a serverless function. This wraps the whole
-- thing in a single Postgres function so it's ONE round trip.
--
-- SECURITY INVOKER (the default) is deliberate: this runs with the
-- calling user's own privileges, so the existing row-level-security
-- policies on tax_year/vendor/receipt/transaction/transaction_split still
-- apply exactly as if the app had made these calls one at a time.
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

  insert into receipt (
    farm_business_id, file_name, file_data_url, capture_source, ocr_status,
    ocr_vendor_guess, ocr_date_guess, ocr_amount_guess, ocr_tax_guess, sync_status, confirmed_at
  ) values (
    p_farm_business_id, p_file_name, p_file_data_url, p_capture_source, 'confirmed',
    p_vendor_name, p_transaction_date, p_amount, p_sales_tax, 'synced', now()
  ) returning id into v_receipt_id;

  insert into transaction (
    farm_business_id, tax_year_id, transaction_type, status, transaction_date,
    vendor_id, description, amount, sales_tax, farm_category_id, receipt_id,
    is_personal_excluded, cpa_flag, sync_status
  ) values (
    p_farm_business_id, v_tax_year_id, 'expense', 'categorized', p_transaction_date,
    v_vendor_id, 'Receipt — ' || coalesce(p_vendor_name, 'upload'), p_amount, coalesce(p_sales_tax, 0),
    p_farm_category_id, v_receipt_id, false, false, 'synced'
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
