-- 0002_rls.sql set up SELECT/INSERT/UPDATE policies for the financial
-- tables (transaction, receipt, invoice, payment, loan) but never a DELETE
-- policy. Postgres RLS defaults to DENY for any operation with no matching
-- policy — so every delete against these tables (Delete Receipt, deleting a
-- transaction, etc.) has been silently affecting 0 rows this whole time:
-- no error is raised, the row just never actually goes away, which is why
-- "delete" on a receipt looked like it worked but the receipt stayed in the
-- list.
do $$
declare
  t text;
  financial_tables text[] := array['transaction','receipt','invoice','payment','loan'];
begin
  foreach t in array financial_tables loop
    execute format('drop policy if exists %I_delete on %I', t, t);
    execute format(
      'create policy %I_delete on %I for delete using (can_edit_financials(farm_business_id))',
      t, t
    );
  end loop;
end $$;
