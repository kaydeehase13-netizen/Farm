import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "./server";
import { requireActiveFarm } from "./auth";
import type {
  Field, CropYear, Transaction, TransactionSplit, Receipt, Activity, Customer,
  CustomerField, Job, Invoice, Payment, Asset, AssetRepair, MileageTrip,
  LivestockGroup, LivestockTransaction, Loan, InventoryItem, DocumentRecord,
  TaxOpportunity, TaxQuestion, FarmCategory, FieldProfitability,
} from "@/types/domain";
import type { DB } from "@/lib/data/store";

// -----------------------------------------------------------------------
// Real Supabase-backed repository. Every function scopes to the caller's
// active farm (requireActiveFarm(), which reads the authenticated session)
// and relies on Postgres RLS as the actual security boundary — a bug here
// can't leak another farm's rows because the database itself refuses the
// query for a farm the session isn't a member of.
// -----------------------------------------------------------------------

async function ctx() {
  const [supabase, farm] = await Promise.all([createServerSupabaseClient(), requireActiveFarm()]);
  return { supabase, farm };
}

function mapField(r: any): Field {
  return {
    id: r.id, farmBusinessId: r.farm_business_id, name: r.name, acres: Number(r.acres),
    tillableAcres: r.tillable_acres != null ? Number(r.tillable_acres) : undefined,
    ownership: r.ownership, landownerName: r.landowner_name ?? undefined, county: r.county ?? undefined,
    fsaFarmNumber: r.fsa_farm_number ?? undefined, fsaTractNumber: r.fsa_tract_number ?? undefined,
    fsaFieldNumber: r.fsa_field_number ?? undefined, irrigated: r.irrigated, notes: r.notes ?? undefined,
  };
}

export async function getFarm() {
  const { farm } = await ctx();
  return farm;
}

export async function listFields(): Promise<Field[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("field").select("*").eq("farm_business_id", farm.id).is("archived_at", null).order("name");
  return (data ?? []).map(mapField);
}

export async function getField(fieldId: string): Promise<Field | null> {
  const { supabase } = await ctx();
  const { data } = await supabase.from("field").select("*").eq("id", fieldId).maybeSingle();
  return data ? mapField(data) : null;
}

export async function createField(input: Omit<Field, "id" | "farmBusinessId">): Promise<Field> {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase
    .from("field")
    .insert({
      farm_business_id: farm.id,
      name: input.name,
      acres: input.acres,
      tillable_acres: input.tillableAcres ?? null,
      ownership: input.ownership,
      landowner_name: input.landownerName ?? null,
      county: input.county ?? null,
      fsa_farm_number: input.fsaFarmNumber ?? null,
      fsa_tract_number: input.fsaTractNumber ?? null,
      fsa_field_number: input.fsaFieldNumber ?? null,
      irrigated: input.irrigated,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create field");
  return mapField(data);
}

export async function listCropYears(fieldId?: string): Promise<CropYear[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("crop_year").select("id, field_id, planted_acres, actual_yield, yield_unit, crop:crop_id(name), tax_year:tax_year_id(year, farm_business_id)");
  if (fieldId) q = q.eq("field_id", fieldId);
  const { data } = await q;
  return (data ?? [])
    .filter((r: any) => r.tax_year?.farm_business_id === farm.id)
    .map((r: any) => ({
      id: r.id, fieldId: r.field_id, year: r.tax_year?.year, cropName: r.crop?.name,
      plantedAcres: r.planted_acres != null ? Number(r.planted_acres) : undefined,
      actualYield: r.actual_yield != null ? Number(r.actual_yield) : undefined, yieldUnit: r.yield_unit ?? undefined,
    }));
}

// Both tax_year and vendor are unique on (farm_business_id, year|name), so a
// single upsert (insert-or-merge) gets the row's id in ONE round trip instead
// of the old select-then-maybe-insert (up to 2 round trips) — this runs on
// every transaction/receipt save, so it's a real chunk of the "why does
// saving a receipt take forever" latency.
async function getOrCreateTaxYear(supabase: any, farmId: string, year: number) {
  const { data, error } = await supabase
    .from("tax_year")
    .upsert({ farm_business_id: farmId, year }, { onConflict: "farm_business_id,year" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function getOrCreateVendor(supabase: any, farmId: string, name?: string) {
  if (!name) return null;
  const { data, error } = await supabase
    .from("vendor")
    .upsert({ farm_business_id: farmId, name }, { onConflict: "farm_business_id,name" })
    .select("id")
    .single();
  if (error) return null;
  return data?.id ?? null;
}

function mapTransaction(r: any, splits: TransactionSplit[]): Transaction {
  return {
    id: r.id, farmBusinessId: r.farm_business_id, taxYear: r.tax_year?.year ?? 0,
    transactionType: r.transaction_type, status: r.status, transactionDate: r.transaction_date,
    vendorId: r.vendor_id ?? undefined, vendorName: r.vendor?.name ?? undefined, customerId: r.customer_id ?? undefined,
    description: r.description ?? undefined, amount: Number(r.amount), salesTax: r.sales_tax != null ? Number(r.sales_tax) : 0,
    paymentMethod: r.payment_method ?? undefined, farmCategoryId: r.farm_category_id ?? undefined,
    taxCategoryCode: r.tax_category?.code ?? undefined, receiptId: r.receipt_id ?? undefined,
    splitGroupId: r.split_group_id ?? undefined,
    isPersonalExcluded: r.is_personal_excluded, cpaFlag: r.cpa_flag, cpaNote: r.cpa_note ?? undefined,
    syncStatus: r.sync_status, splits, createdAt: r.created_at,
  };
}

export async function listTaxYears(): Promise<number[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("tax_year").select("year").eq("farm_business_id", farm.id);
  const years = new Set((data ?? []).map((r: any) => r.year));
  // Always offer the current year and the year before it, even before any
  // data exists for them — the switcher should show 2025/2026 out of the
  // gate, not only appear once a transaction happens to get entered. Any
  // later year (2027, ...) shows up automatically once something is
  // recorded for it, since that creates a tax_year row.
  years.add(farm.currentTaxYear);
  years.add(farm.currentTaxYear - 1);
  return Array.from(years).sort((a, b) => b - a);
}

const TXN_SELECT = "*, vendor:vendor_id(name), tax_year:tax_year_id(year), tax_category:tax_category_id(code)";

export async function listTransactions(filters: {
  taxYear?: number; type?: string; status?: string; fieldId?: string; customerId?: string; vendorId?: string; search?: string;
} = {}): Promise<Transaction[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("transaction").select(TXN_SELECT).eq("farm_business_id", farm.id).order("transaction_date", { ascending: false });
  if (filters.type) q = q.eq("transaction_type", filters.type);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.customerId) q = q.eq("customer_id", filters.customerId);
  if (filters.vendorId) q = q.eq("vendor_id", filters.vendorId);
  if (filters.search) q = q.ilike("description", `%${filters.search}%`);
  const { data: rows, error } = await q;
  if (error || !rows) return [];

  const filtered = filters.taxYear ? rows.filter((r: any) => r.tax_year?.year === filters.taxYear) : rows;
  const ids = filtered.map((r: any) => r.id);
  if (ids.length === 0) return [];
  const { data: splitRows } = await supabase.from("transaction_split").select("*").in("transaction_id", ids);

  let result = filtered.map((r: any) => mapTransaction(r, mapSplits(splitRows ?? [], r.id)));
  if (filters.fieldId) result = result.filter((t) => t.splits.some((s) => s.fieldId === filters.fieldId));
  return result;
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { supabase, farm } = await ctx();
  const { data: r } = await supabase.from("transaction").select(TXN_SELECT).eq("id", id).eq("farm_business_id", farm.id).maybeSingle();
  if (!r) return null;
  const { data: splitRows } = await supabase.from("transaction_split").select("*").eq("transaction_id", id);
  return mapTransaction(r, mapSplits(splitRows ?? [], id));
}

function mapSplits(rows: any[], transactionId: string): TransactionSplit[] {
  return rows.filter((s) => s.transaction_id === transactionId).map((s) => ({
    id: s.id, transactionId: s.transaction_id, targetType: s.target_type, fieldId: s.field_id ?? undefined,
    cropYearId: s.crop_year_id ?? undefined, jobId: s.job_id ?? undefined, equipmentAssetId: s.equipment_asset_id ?? undefined,
    allocationMethod: s.allocation_method, allocatedAmount: Number(s.allocated_amount),
    farmCategoryId: s.farm_category_id ?? undefined, notes: s.notes ?? undefined,
  }));
}

/**
 * A transaction's Schedule/tax-category placement (Sch F vs Sch C vs Sch E,
 * and which line) always comes from `tax_category_id`, but nothing was ever
 * writing that column — every insert path only ever set `farm_category_id`.
 * The result: every transaction's tax category has silently been null this
 * whole time, which is why "Expenses by Tax Category" was always empty and
 * why the SE (Schedule C) / royalty (Schedule E) sheets never got anything
 * even when the right farm category was picked. This resolves the real
 * tax_category.id to write, from either an explicit code override or the
 * chosen farm category's own default_tax_category_id.
 */
async function resolveTaxCategoryId(
  supabase: any,
  opts: { taxCategoryCode?: string | null; farmCategoryId?: string | null }
): Promise<string | null> {
  if (opts.taxCategoryCode) {
    const { data } = await supabase.from("tax_category").select("id").eq("code", opts.taxCategoryCode).maybeSingle();
    if (data?.id) return data.id;
  }
  if (opts.farmCategoryId) {
    const { data } = await supabase.from("farm_category").select("default_tax_category_id").eq("id", opts.farmCategoryId).maybeSingle();
    if (data?.default_tax_category_id) return data.default_tax_category_id;
  }
  return null;
}

export async function createTransaction(input: Omit<Transaction, "id" | "createdAt" | "splits"> & { splits?: Omit<TransactionSplit, "id" | "transactionId">[] }) {
  const { supabase, farm } = await ctx();
  const [taxYearId, vendorId, taxCategoryId] = await Promise.all([
    getOrCreateTaxYear(supabase, farm.id, input.taxYear),
    input.vendorId ? Promise.resolve(input.vendorId) : getOrCreateVendor(supabase, farm.id, input.vendorName),
    resolveTaxCategoryId(supabase, { taxCategoryCode: input.taxCategoryCode, farmCategoryId: input.farmCategoryId }),
  ]);

  const { data: txn, error } = await supabase.from("transaction").insert({
    farm_business_id: farm.id, tax_year_id: taxYearId, transaction_type: input.transactionType,
    status: input.status, transaction_date: input.transactionDate, vendor_id: vendorId,
    customer_id: input.customerId ?? null, description: input.description ?? null, amount: input.amount,
    sales_tax: input.salesTax ?? 0, payment_method: input.paymentMethod ?? null,
    farm_category_id: input.farmCategoryId ?? null, tax_category_id: taxCategoryId, receipt_id: input.receiptId ?? null,
    split_group_id: input.splitGroupId ?? null,
    is_personal_excluded: input.isPersonalExcluded, cpa_flag: input.cpaFlag ?? false, sync_status: "synced",
  }).select("id").single();
  if (error || !txn) throw error;

  const splits = input.splits ?? [{ targetType: "general_overhead" as const, allocationMethod: "manual" as const, allocatedAmount: input.amount, farmCategoryId: input.farmCategoryId }];
  await supabase.from("transaction_split").insert(splits.map((s) => ({
    transaction_id: txn.id, target_type: s.targetType, field_id: s.fieldId ?? null, job_id: s.jobId ?? null,
    equipment_asset_id: s.equipmentAssetId ?? null, allocation_method: s.allocationMethod,
    allocated_amount: s.allocatedAmount, farm_category_id: s.farmCategoryId ?? null, notes: s.notes ?? null,
  })));

  return { ...input, id: txn.id, createdAt: new Date().toISOString(), splits: splits.map((s) => ({ ...s, id: randomUUID(), transactionId: txn.id })) };
}

/**
 * One-off repair: transactions created before a fix to how the tax year was
 * assigned can have a tax_year_id that doesn't match their actual
 * transaction_date (e.g. a receipt dated in 2025 filed under 2026). Walk
 * every transaction and re-point it at the tax_year row matching its date.
 */
export async function fixMisfiledTaxYears(): Promise<{ checked: number; fixed: number; failed: number; sample: string[] }> {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.from("transaction").select("id, transaction_date, tax_year_id, tax_year:tax_year_id(year)").eq("farm_business_id", farm.id);
  if (error) throw new Error(`Couldn't read transactions: ${error.message}`);
  const rows = (data ?? []) as any[];
  let fixed = 0;
  let failed = 0;
  const sample: string[] = [];
  for (const r of rows) {
    const correctYear = Number(String(r.transaction_date).slice(0, 4));
    const currentYear = Array.isArray(r.tax_year) ? r.tax_year[0]?.year : r.tax_year?.year;
    if (!Number.isFinite(correctYear) || currentYear === correctYear) continue;
    try {
      const correctTaxYearId = await getOrCreateTaxYear(supabase, farm.id, correctYear);
      const { error: updateError } = await supabase.from("transaction").update({ tax_year_id: correctTaxYearId }).eq("id", r.id);
      if (updateError) throw updateError;
      fixed++;
    } catch (e) {
      failed++;
      if (sample.length < 3) sample.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { checked: rows.length, fixed, failed, sample };
}

/**
 * One-off repair, same idea as fixMisfiledTaxYears() above: every existing
 * transaction that already has a farm_category_id but is still missing its
 * tax_category_id (see resolveTaxCategoryId's comment) gets it filled in
 * from that farm category's own default. Safe to run any time, and safe to
 * run more than once — it only ever changes rows whose tax_category_id
 * doesn't already match their farm category's default.
 */
export async function backfillTaxCategories(): Promise<{ checked: number; fixed: number }> {
  const { supabase, farm } = await ctx();
  const { data: txns, error } = await supabase
    .from("transaction")
    .select("id, farm_category_id, tax_category_id")
    .eq("farm_business_id", farm.id)
    .not("farm_category_id", "is", null);
  if (error) throw new Error(error.message);
  const rows = (txns ?? []) as { id: string; farm_category_id: string; tax_category_id: string | null }[];
  if (rows.length === 0) return { checked: 0, fixed: 0 };

  const farmCatIds = Array.from(new Set(rows.map((r) => r.farm_category_id)));
  const { data: cats } = await supabase.from("farm_category").select("id, default_tax_category_id").in("id", farmCatIds);
  const defaultByCat = new Map((cats ?? []).map((c: any) => [c.id, c.default_tax_category_id]));

  let fixed = 0;
  for (const r of rows) {
    const correct = defaultByCat.get(r.farm_category_id) ?? null;
    if (!correct || r.tax_category_id === correct) continue;
    const { error: updErr } = await supabase.from("transaction").update({ tax_category_id: correct }).eq("id", r.id);
    if (!updErr) fixed++;
  }
  return { checked: rows.length, fixed };
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const { supabase, farm } = await ctx();
  const update: Record<string, unknown> = {};
  if (patch.farmCategoryId !== undefined) update.farm_category_id = patch.farmCategoryId;
  if (patch.farmCategoryId !== undefined || patch.taxCategoryCode !== undefined) {
    update.tax_category_id = await resolveTaxCategoryId(supabase, { taxCategoryCode: patch.taxCategoryCode, farmCategoryId: patch.farmCategoryId });
  }
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.transactionType !== undefined) update.transaction_type = patch.transactionType;
  if (patch.splitGroupId !== undefined) update.split_group_id = patch.splitGroupId;
  if (patch.isPersonalExcluded !== undefined) update.is_personal_excluded = patch.isPersonalExcluded;
  if (patch.cpaFlag !== undefined) update.cpa_flag = patch.cpaFlag;
  if (patch.cpaNote !== undefined) update.cpa_note = patch.cpaNote;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.salesTax !== undefined) update.sales_tax = patch.salesTax;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.vendorName !== undefined) update.vendor_id = await getOrCreateVendor(supabase, farm.id, patch.vendorName);
  if (patch.transactionDate !== undefined) {
    update.transaction_date = patch.transactionDate;
    update.tax_year_id = await getOrCreateTaxYear(supabase, farm.id, Number(patch.transactionDate.slice(0, 4)));
  }
  if (Object.keys(update).length > 0) await supabase.from("transaction").update(update).eq("id", id);

  if (patch.splits) {
    for (const s of patch.splits) {
      if (!s.id) continue;
      const splitUpdate: Record<string, unknown> = { field_id: s.fieldId ?? null, target_type: s.targetType };
      if (s.allocatedAmount !== undefined) splitUpdate.allocated_amount = s.allocatedAmount;
      if (s.farmCategoryId !== undefined) splitUpdate.farm_category_id = s.farmCategoryId;
      await supabase.from("transaction_split").update(splitUpdate).eq("id", s.id);
    }
  } else if (patch.amount !== undefined || patch.farmCategoryId !== undefined) {
    // Keep a single-split transaction's allocated amount (and category) in
    // sync with the edited total — most receipt/expense transactions have
    // exactly one split. Transactions deliberately split across multiple
    // targets are left alone; edit those from the transaction detail view.
    const { data: splits } = await supabase.from("transaction_split").select("id").eq("transaction_id", id);
    if (splits && splits.length === 1) {
      const splitUpdate: Record<string, unknown> = {};
      if (patch.amount !== undefined) splitUpdate.allocated_amount = patch.amount;
      if (patch.farmCategoryId !== undefined) splitUpdate.farm_category_id = patch.farmCategoryId;
      await supabase.from("transaction_split").update(splitUpdate).eq("id", splits[0].id);
    }
  }
  return null;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { supabase, farm } = await ctx();
  // transaction_split rows cascade on delete (see schema), so this alone is enough.
  const { error } = await supabase.from("transaction").delete().eq("id", id).eq("farm_business_id", farm.id);
  if (error) throw new Error(error.message);
}

export async function deleteReceipt(id: string): Promise<void> {
  const { supabase, farm } = await ctx();
  // Unlink rather than delete any transaction created from this receipt —
  // removing the photo/entry shouldn't silently delete the expense too.
  await supabase.from("transaction").update({ receipt_id: null }).eq("receipt_id", id).eq("farm_business_id", farm.id);
  const { error } = await supabase.from("receipt").delete().eq("id", id).eq("farm_business_id", farm.id);
  if (error) throw new Error(error.message);
}

// Every column EXCEPT file_data_url — that column holds the whole receipt
// photo as base64 text (often several hundred KB, sometimes multi-MB), and
// listReceipts() is called on nearly every page via dashboardSummary() just
// to count unconfirmed/missing receipts. Pulling every photo, every time,
// on every page load was the single biggest thing bloating this app —
// see getReceipt() below for fetching one receipt's actual photo.
// NOTE: "file_name" is deliberately NOT in this list — it isn't a real
// column on the receipt table (see 0001_core_schema.sql), only document_id
// is. Naming a column here that doesn't exist makes PostgREST reject the
// whole query, and since callers below don't check `error`, that used to
// come back as a silent EMPTY receipt list instead of a visible failure —
// exactly what happened here once before. listReceipts() now falls back to
// select("*") if this list ever drifts from the schema again, so a typo
// here degrades to "slower" rather than "receipts vanish."
const RECEIPT_LIST_COLUMNS =
  "id, farm_business_id, document_id, capture_source, ocr_status, ocr_vendor_guess, " +
  "ocr_date_guess, ocr_amount_guess, ocr_tax_guess, ocr_line_items, confirmed_at, sync_status, created_at";

export async function listReceipts(): Promise<Receipt[]> {
  const { supabase, farm } = await ctx();
  let { data, error } = await supabase.from("receipt").select(RECEIPT_LIST_COLUMNS).eq("farm_business_id", farm.id).order("created_at", { ascending: false });
  if (error) {
    ({ data, error } = await supabase.from("receipt").select("*").eq("farm_business_id", farm.id).order("created_at", { ascending: false }));
  }
  const { data: linked } = await supabase.from("transaction").select("id, receipt_id").eq("farm_business_id", farm.id).not("receipt_id", "is", null);
  return (data ?? []).map((r: any): Receipt => ({
    id: r.id, farmBusinessId: r.farm_business_id, fileName: r.document_id ? r.file_name ?? "receipt" : r.file_name ?? "receipt",
    captureSource: r.capture_source, ocrStatus: r.ocr_status, ocrVendorGuess: r.ocr_vendor_guess ?? undefined,
    ocrDateGuess: r.ocr_date_guess ?? undefined, ocrAmountGuess: r.ocr_amount_guess != null ? Number(r.ocr_amount_guess) : undefined,
    ocrTaxGuess: r.ocr_tax_guess != null ? Number(r.ocr_tax_guess) : undefined, ocrLineItems: r.ocr_line_items ?? undefined,
    // Deliberately NOT selected here — see getReceipt() for the photo itself.
    fileDataUrl: undefined,
    confirmedAt: r.confirmed_at ?? undefined, linkedTransactionId: linked?.find((t: any) => t.receipt_id === r.id)?.id,
    syncStatus: r.sync_status, createdAt: r.created_at,
  }));
}

/** One receipt, INCLUDING its photo (file_data_url) — use this instead of
 * listReceipts().find(...) whenever you need the actual image, so you're
 * only ever paying for one photo's worth of data, not every receipt's. */
export async function getReceipt(id: string): Promise<Receipt | null> {
  const { supabase, farm } = await ctx();
  const { data: r } = await supabase.from("receipt").select("*").eq("id", id).eq("farm_business_id", farm.id).maybeSingle();
  if (!r) return null;
  const { data: linkedTxn } = await supabase.from("transaction").select("id").eq("receipt_id", id).eq("farm_business_id", farm.id).maybeSingle();
  return {
    id: r.id, farmBusinessId: r.farm_business_id, fileName: r.file_name ?? "receipt",
    captureSource: r.capture_source, ocrStatus: r.ocr_status, ocrVendorGuess: r.ocr_vendor_guess ?? undefined,
    ocrDateGuess: r.ocr_date_guess ?? undefined, ocrAmountGuess: r.ocr_amount_guess != null ? Number(r.ocr_amount_guess) : undefined,
    ocrTaxGuess: r.ocr_tax_guess != null ? Number(r.ocr_tax_guess) : undefined, ocrLineItems: r.ocr_line_items ?? undefined,
    fileDataUrl: r.file_data_url ?? undefined,
    confirmedAt: r.confirmed_at ?? undefined, linkedTransactionId: linkedTxn?.id,
    syncStatus: r.sync_status, createdAt: r.created_at,
  };
}

export async function createReceipt(input: Omit<Receipt, "id" | "createdAt">) {
  const { supabase, farm } = await ctx();
  const baseRow = {
    farm_business_id: farm.id, capture_source: input.captureSource, ocr_status: input.ocrStatus,
    ocr_vendor_guess: input.ocrVendorGuess ?? null, ocr_date_guess: input.ocrDateGuess ?? null,
    ocr_amount_guess: input.ocrAmountGuess ?? null, ocr_tax_guess: input.ocrTaxGuess ?? null,
    ocr_line_items: input.ocrLineItems ?? null, sync_status: "synced",
  };
  // Only ask Postgres to hand back id/created_at — echoing the whole row
  // (including the multi-hundred-KB base64 photo we just sent it) back over
  // the wire is pure wasted latency on every single receipt save.
  let { data, error } = await supabase.from("receipt")
    .insert({ ...baseRow, file_data_url: input.fileDataUrl ?? null })
    .select("id, created_at").single();
  if (error?.message?.includes("file_data_url")) {
    // Migration 0006 (adds the file_data_url column) hasn't been run yet on
    // this database — fall back to saving everything except the photo so
    // receipt entry still works, rather than hard-failing the whole save.
    ({ data, error } = await supabase.from("receipt").insert(baseRow).select("id, created_at").single());
  }
  if (error || !data) throw error;
  return { ...input, id: data.id, createdAt: data.created_at };
}

/**
 * Single-photo "save receipt & create expense" flow, collapsed into ONE
 * network round trip via the create_receipt_and_expense() Postgres function
 * (migration 0009) instead of the previous 4+ sequential calls (get/create
 * tax year, get/create vendor, insert receipt, insert transaction, insert
 * split). Falls back to the old multi-step path if that function hasn't
 * been created yet on this database (migration not run) — slower, but the
 * save still works.
 */
export async function createReceiptAndExpense(input: {
  fileName: string; fileDataUrl?: string; captureSource: string;
  vendorName?: string; transactionDate: string; amount: number; salesTax?: number;
  farmCategoryId?: string; fieldId?: string;
}): Promise<{ receiptId: string; transactionId: string }> {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.rpc("create_receipt_and_expense", {
    p_farm_business_id: farm.id,
    p_file_name: input.fileName,
    p_file_data_url: input.fileDataUrl ?? null,
    p_capture_source: input.captureSource,
    p_vendor_name: input.vendorName ?? null,
    p_transaction_date: input.transactionDate,
    p_amount: input.amount,
    p_sales_tax: input.salesTax ?? 0,
    p_farm_category_id: input.farmCategoryId ?? null,
    p_field_id: input.fieldId ?? null,
  });
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.receipt_id && row?.transaction_id) return { receiptId: row.receipt_id, transactionId: row.transaction_id };
  }

  // Fallback: the create_receipt_and_expense() function isn't on this
  // database yet (migration 0009 hasn't been run) — do it the slower,
  // multi-round-trip way so saving still works.
  const receipt = await createReceipt({
    farmBusinessId: farm.id, fileName: input.fileName, fileDataUrl: input.fileDataUrl,
    captureSource: input.captureSource as any, ocrStatus: "confirmed",
    ocrVendorGuess: input.vendorName, ocrDateGuess: input.transactionDate,
    ocrAmountGuess: input.amount, ocrTaxGuess: input.salesTax, syncStatus: "synced",
  });
  const txn = await createTransaction({
    farmBusinessId: farm.id, taxYear: Number(input.transactionDate.slice(0, 4)) || farm.currentTaxYear,
    transactionType: "expense", status: "categorized", transactionDate: input.transactionDate,
    vendorName: input.vendorName, description: `Receipt — ${input.vendorName ?? "upload"}`,
    amount: input.amount, salesTax: input.salesTax ?? 0, farmCategoryId: input.farmCategoryId,
    receiptId: receipt.id, isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
    splits: [{
      targetType: input.fieldId ? "field" : "general_overhead", fieldId: input.fieldId,
      allocationMethod: "manual", allocatedAmount: input.amount, farmCategoryId: input.farmCategoryId,
    }],
  });
  return { receiptId: receipt.id, transactionId: txn.id };
}

/**
 * Same idea as createReceiptAndExpense, but for a receipt that covers more
 * than one category (or type) — one receipt photo, N expense/income lines,
 * all sharing one splitGroupId so exports can always show either the
 * itemized breakdown or the original combined total. Only the FIRST line
 * gets linked to the receipt photo itself (receiptId) — the rest are
 * ordinary transactions dated/vendored the same as the receipt.
 */
export async function createReceiptAndSplitExpenses(input: {
  fileName: string; fileDataUrl?: string; captureSource: string;
  vendorName?: string; transactionDate: string; salesTax?: number; fieldId?: string;
  lines: { type: "income" | "expense"; farmCategoryId: string; amount: number }[];
}): Promise<{ receiptId: string; transactionIds: string[] }> {
  const { farm } = await ctx();
  const receipt = await createReceipt({
    farmBusinessId: farm.id, fileName: input.fileName, fileDataUrl: input.fileDataUrl,
    captureSource: input.captureSource as any, ocrStatus: "confirmed",
    ocrVendorGuess: input.vendorName, ocrDateGuess: input.transactionDate,
    syncStatus: "synced",
  });

  const farmCategories = await listFarmCategories();
  const nameById = new Map(farmCategories.map((c) => [c.id, c.name]));
  const splitGroupId = randomUUID();
  const taxYear = Number(input.transactionDate.slice(0, 4)) || farm.currentTaxYear;
  const firstExpenseIdx = input.lines.findIndex((l) => l.type === "expense");

  const transactionIds: string[] = [];
  for (const [i, line] of input.lines.entries()) {
    const txn = await createTransaction({
      farmBusinessId: farm.id, taxYear, transactionType: line.type, status: "categorized",
      transactionDate: input.transactionDate, vendorName: input.vendorName,
      description: `Receipt — ${input.vendorName ?? "upload"} — ${nameById.get(line.farmCategoryId) ?? "Split"}`,
      amount: line.amount, salesTax: i === firstExpenseIdx ? input.salesTax ?? 0 : 0,
      farmCategoryId: line.farmCategoryId, splitGroupId,
      receiptId: i === 0 ? receipt.id : undefined,
      isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
      splits: [{
        targetType: input.fieldId ? "field" : "general_overhead", fieldId: input.fieldId,
        allocationMethod: "manual", allocatedAmount: line.amount, farmCategoryId: line.farmCategoryId,
      }],
    });
    transactionIds.push(txn.id);
  }
  return { receiptId: receipt.id, transactionIds };
}

export async function updateReceipt(id: string, patch: Partial<Receipt>) {
  const { supabase } = await ctx();
  const update: Record<string, unknown> = {};
  if (patch.ocrVendorGuess !== undefined) update.ocr_vendor_guess = patch.ocrVendorGuess;
  if (patch.ocrDateGuess !== undefined) update.ocr_date_guess = patch.ocrDateGuess;
  if (patch.ocrAmountGuess !== undefined) update.ocr_amount_guess = patch.ocrAmountGuess;
  if (patch.ocrTaxGuess !== undefined) update.ocr_tax_guess = patch.ocrTaxGuess;
  if (Object.keys(update).length > 0) await supabase.from("receipt").update(update).eq("id", id);
}

export async function confirmReceipt(id: string, patch: Partial<Receipt> & { createTransaction?: boolean; farmCategoryId?: string; fieldId?: string }) {
  const { supabase, farm } = await ctx();
  await supabase.from("receipt").update({
    ocr_vendor_guess: patch.ocrVendorGuess ?? null, ocr_date_guess: patch.ocrDateGuess ?? null,
    ocr_amount_guess: patch.ocrAmountGuess ?? null, ocr_tax_guess: patch.ocrTaxGuess ?? null,
    ocr_status: "confirmed", confirmed_at: new Date().toISOString(),
  }).eq("id", id);

  if (patch.createTransaction) {
    const transactionDate = patch.ocrDateGuess ?? new Date().toISOString().slice(0, 10);
    const taxYear = Number(transactionDate.slice(0, 4)) || farm.currentTaxYear;
    await createTransaction({
      farmBusinessId: farm.id, taxYear, transactionType: "expense", status: "categorized",
      transactionDate, vendorName: patch.ocrVendorGuess,
      description: `Receipt — ${patch.ocrVendorGuess ?? "upload"}`, amount: patch.ocrAmountGuess ?? 0,
      salesTax: patch.ocrTaxGuess ?? 0, farmCategoryId: patch.farmCategoryId, receiptId: id,
      isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
      splits: [{ targetType: patch.fieldId ? "field" : "general_overhead", fieldId: patch.fieldId, allocationMethod: "manual", allocatedAmount: patch.ocrAmountGuess ?? 0, farmCategoryId: patch.farmCategoryId }],
    });
  }
  return null;
}

export async function listActivities(filters: { fieldId?: string; activityType?: string; customerId?: string; year?: number } = {}): Promise<Activity[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("activity").select("*, field:field_id(name), customer_field:customer_field_id(name), spray_product_line(*, product:product_id(name, epa_registration_number)), fertilizer_product_line(*, product:product_id(name)), planting_activity_detail(seeding_rate, seed_product:seed_product_id(name)), harvest_activity_detail(yield_amount, yield_unit, moisture_pct)")
    .eq("farm_business_id", farm.id).order("activity_date", { ascending: false });
  if (filters.fieldId) q = q.eq("field_id", filters.fieldId);
  if (filters.activityType) q = q.eq("activity_type", filters.activityType);
  if (filters.customerId) q = q.eq("customer_id", filters.customerId);
  if (filters.year) q = q.gte("activity_date", `${filters.year}-01-01`).lt("activity_date", `${filters.year + 1}-01-01`);
  const { data } = await q;
  return (data ?? []).map((r: any): Activity => {
    const planting = Array.isArray(r.planting_activity_detail) ? r.planting_activity_detail[0] : r.planting_activity_detail;
    const harvest = Array.isArray(r.harvest_activity_detail) ? r.harvest_activity_detail[0] : r.harvest_activity_detail;
    return {
    id: r.id, farmBusinessId: r.farm_business_id, activityType: r.activity_type, fieldId: r.field_id ?? undefined,
    fieldName: r.field?.name, customerFieldId: r.customer_field_id ?? undefined, customerFieldName: r.customer_field?.name,
    customerId: r.customer_id ?? undefined, jobId: r.job_id ?? undefined, cropYearId: r.crop_year_id ?? undefined,
    activityDate: r.activity_date, startTime: r.start_time ?? undefined, endTime: r.end_time ?? undefined,
    acres: r.acres != null ? Number(r.acres) : undefined, applicatorName: undefined, notes: r.notes ?? undefined,
    weather: r.weather ?? undefined, syncStatus: r.sync_status, createdAt: r.created_at,
    seedProductName: planting?.seed_product?.name ?? undefined,
    seedingRate: planting?.seeding_rate != null ? Number(planting.seeding_rate) : undefined,
    yieldAmount: harvest?.yield_amount != null ? Number(harvest.yield_amount) : undefined,
    yieldUnit: harvest?.yield_unit ?? undefined,
    moisturePct: harvest?.moisture_pct != null ? Number(harvest.moisture_pct) : undefined,
    sprayProducts: (r.spray_product_line ?? []).map((p: any) => ({
      productId: p.product_id, productName: p.product?.name ?? "Product", rate: Number(p.rate), rateUnit: p.rate_unit,
      quantityUsed: Number(p.quantity_used), quantityUnit: p.quantity_unit, epaRegistrationNumber: p.product?.epa_registration_number,
    })),
    fertilizerProducts: (r.fertilizer_product_line ?? []).map((p: any) => ({
      productName: p.product?.name ?? "Product", rate: Number(p.rate), rateUnit: p.rate_unit,
      quantityUsed: Number(p.quantity_used), quantityUnit: p.quantity_unit,
    })),
  };
  });
}

type ProductLineInput = { productId?: string; productName: string; rate: number; rateUnit: string; quantityUsed: number; quantityUnit: string };

/**
 * Writes the spray/fertilizer/seed product-line rows for an activity that
 * already exists. Shared by createActivity (brand-new activity) and
 * repairActivityProductDetails (an activity that got created — e.g. by a
 * CSV import — without its product lines actually landing, because every
 * step here used to be fire-and-forget with no error check: a failed
 * `product` upsert (RLS, a bad unique-constraint match, whatever) meant
 * `productId` came back undefined and the whole line was silently dropped,
 * with the activity itself still showing up fine in the field's timeline.
 * Every upsert here now throws on error instead of swallowing it.
 */
async function writeActivityProductDetails(
  supabase: any, farm: { id: string }, activityId: string, jobId: string | undefined,
  details: { sprayProducts?: ProductLineInput[]; fertilizerProducts?: ProductLineInput[]; seedProductName?: string; seedingRate?: number }
) {
  async function upsertProductLine(line: ProductLineInput, category: string, table: "spray_product_line" | "fertilizer_product_line") {
    let productId = line.productId;
    if (!productId || productId.startsWith("prod-")) {
      const { data: prod, error: prodErr } = await supabase.from("product").upsert(
        { farm_business_id: farm.id, category, name: line.productName, default_unit: line.quantityUnit },
        { onConflict: "farm_business_id,name" }
      ).select("id").maybeSingle();
      if (prodErr) throw new Error(`Product "${line.productName}": ${prodErr.message}`);
      productId = prod?.id;
    }
    if (!productId) throw new Error(`Product "${line.productName}" — could not resolve a product id.`);
    const { data: item } = await supabase.from("inventory_item").select("id, quantity_on_hand, average_unit_cost")
      .eq("farm_business_id", farm.id).eq("product_id", productId).eq("unit", line.quantityUnit).maybeSingle();
    let inventoryItemId = item?.id;
    if (!inventoryItemId) {
      const { data: created, error: invErr } = await supabase.from("inventory_item").insert({ farm_business_id: farm.id, product_id: productId, unit: line.quantityUnit, quantity_on_hand: 0 }).select("id").single();
      if (invErr) throw new Error(`Inventory item for "${line.productName}": ${invErr.message}`);
      inventoryItemId = created?.id;
    } else {
      await supabase.from("inventory_item").update({ quantity_on_hand: Math.max(0, Number(item?.quantity_on_hand ?? 0) - line.quantityUsed) }).eq("id", inventoryItemId);
    }
    const { error: lineErr } = await supabase.from(table).insert({ activity_id: activityId, product_id: productId, rate: line.rate, rate_unit: line.rateUnit, quantity_used: line.quantityUsed, quantity_unit: line.quantityUnit });
    if (lineErr) throw new Error(`${table} for "${line.productName}": ${lineErr.message}`);
    if (inventoryItemId) {
      await supabase.from("inventory_movement").insert({ inventory_item_id: inventoryItemId, movement_type: jobId ? "use_customer_job" : "use_own_field", quantity: -line.quantityUsed, related_activity_id: activityId, related_job_id: jobId ?? null });
    }
  }

  for (const line of details.sprayProducts ?? []) {
    await upsertProductLine(line, "chemical", "spray_product_line");
  }
  for (const line of details.fertilizerProducts ?? []) {
    await upsertProductLine({ ...line, productId: undefined }, "fertilizer", "fertilizer_product_line");
  }

  if (details.seedProductName || details.seedingRate != null) {
    let seedProductId: string | undefined;
    if (details.seedProductName) {
      const { data: prod, error: seedErr } = await supabase.from("product").upsert(
        { farm_business_id: farm.id, category: "seed", name: details.seedProductName, default_unit: "seeds" },
        { onConflict: "farm_business_id,name" }
      ).select("id").maybeSingle();
      if (seedErr) throw new Error(`Seed product "${details.seedProductName}": ${seedErr.message}`);
      seedProductId = prod?.id;
    }
    await supabase.from("planting_activity_detail").upsert({
      activity_id: activityId, seed_product_id: seedProductId ?? null, seeding_rate: details.seedingRate ?? null,
    }, { onConflict: "activity_id" });
  }
}

export async function createActivity(input: Omit<Activity, "id" | "createdAt">) {
  const { supabase, farm } = await ctx();
  // The schema has no free-text "applicator name" column (only a FK to a
  // real app_user), so fold it into notes rather than silently dropping it.
  const notes = input.applicatorName ? `Applicator: ${input.applicatorName}${input.notes ? ` — ${input.notes}` : ""}` : (input.notes ?? null);
  const { data: activity, error } = await supabase.from("activity").insert({
    farm_business_id: farm.id, activity_type: input.activityType, field_id: input.fieldId ?? null,
    customer_field_id: input.customerFieldId ?? null, job_id: input.jobId ?? null, crop_year_id: input.cropYearId ?? null,
    activity_date: input.activityDate, acres: input.acres ?? null, notes, sync_status: "synced",
  }).select("id").single();
  if (error || !activity) throw error;
  const activityId = activity.id;

  await writeActivityProductDetails(supabase, farm, activityId, input.jobId, input);

  if (input.yieldAmount != null || input.moisturePct != null) {
    await supabase.from("harvest_activity_detail").upsert({
      activity_id: activityId, yield_amount: input.yieldAmount ?? null, yield_unit: input.yieldUnit ?? null, moisture_pct: input.moisturePct ?? null,
    }, { onConflict: "activity_id" });
  }

  return { ...input, id: activityId, createdAt: new Date().toISOString() };
}

/**
 * Backfills the product-line details onto an activity that already exists
 * (e.g. one a CSV import created before this file's error-swallowing bug
 * was fixed, so its spray/fertilizer/seed line never actually landed).
 * Used by the "re-run the same import" repair path in importActivitiesAction.
 */
export async function repairActivityProductDetails(activityId: string, details: {
  sprayProducts?: ProductLineInput[]; fertilizerProducts?: ProductLineInput[]; seedProductName?: string; seedingRate?: number;
}) {
  const { supabase, farm } = await ctx();
  await writeActivityProductDetails(supabase, farm, activityId, undefined, details);
}

export async function listCustomers(): Promise<Customer[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("customer").select("*").eq("farm_business_id", farm.id).is("archived_at", null).order("name");
  const { data: invoices } = await supabase.from("invoice").select("customer_id, total, amount_paid").eq("farm_business_id", farm.id);
  return (data ?? []).map((c: any): Customer => ({
    id: c.id, farmBusinessId: c.farm_business_id, name: c.name, contactName: c.contact_name ?? undefined,
    phone: c.phone ?? undefined, email: c.email ?? undefined, billingAddress: c.billing_address ?? undefined,
    balanceDue: (invoices ?? []).filter((i: any) => i.customer_id === c.id).reduce((s: number, i: any) => s + (Number(i.total) - Number(i.amount_paid)), 0),
  }));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const customers = await listCustomers();
  return customers.find((c) => c.id === id) ?? null;
}

export async function listJobs(filters: { customerId?: string; status?: string } = {}): Promise<Job[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("job").select("*, customer:customer_id(name), customer_field:customer_field_id(name), job_service:job_service_id(name)").eq("farm_business_id", farm.id);
  if (filters.customerId) q = q.eq("customer_id", filters.customerId);
  if (filters.status) q = q.eq("status", filters.status);
  const { data } = await q;
  return (data ?? []).map((j: any): Job => ({
    id: j.id, farmBusinessId: j.farm_business_id, customerId: j.customer_id, customerName: j.customer?.name ?? "Customer",
    customerFieldId: j.customer_field_id ?? undefined, customerFieldName: j.customer_field?.name,
    jobService: j.job_service?.name ?? "Other", status: j.status, scheduledDate: j.scheduled_date ?? undefined,
    completedDate: j.completed_date ?? undefined, acres: j.acres != null ? Number(j.acres) : undefined,
    rate: j.rate != null ? Number(j.rate) : undefined, rateUnit: j.rate_unit ?? "per_acre",
    productSource: j.product_source, directCost: 0, revenue: Number(j.rate ?? 0) * Number(j.acres ?? 0),
    notes: j.notes ?? undefined, invoiceId: undefined,
  }));
}

export async function createJob(input: Omit<Job, "id">) {
  const { supabase, farm } = await ctx();
  const { data: svc } = await supabase.from("job_service").upsert({ name: input.jobService }, { onConflict: "name" }).select("id").maybeSingle();
  const { data: job, error } = await supabase.from("job").insert({
    farm_business_id: farm.id, customer_id: input.customerId, customer_field_id: input.customerFieldId ?? null,
    job_service_id: svc?.id, status: input.status, scheduled_date: input.scheduledDate ?? null,
    acres: input.acres ?? null, rate: input.rate ?? null, rate_unit: input.rateUnit, product_source: input.productSource,
    notes: input.notes ?? null,
  }).select("id").single();
  if (error || !job) throw error;
  return { ...input, id: job.id };
}

export function jobMargin(job: Job) {
  return job.revenue - job.directCost;
}

export async function listInvoices(): Promise<Invoice[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("invoice").select("*, customer:customer_id(name), invoice_line(*)").eq("farm_business_id", farm.id).order("issue_date", { ascending: false });
  return (data ?? []).map((i: any): Invoice => ({
    id: i.id, farmBusinessId: i.farm_business_id, customerId: i.customer_id, customerName: i.customer?.name ?? "Customer",
    invoiceNumber: i.invoice_number, status: i.status, issueDate: i.issue_date, dueDate: i.due_date ?? undefined,
    lines: (i.invoice_line ?? []).map((l: any) => ({ id: l.id, description: l.description, quantity: Number(l.quantity), unitRate: Number(l.unit_rate), amount: Number(l.amount), jobId: l.job_id ?? undefined })),
    subtotal: Number(i.subtotal), additionalCharges: Number(i.additional_charges), total: Number(i.total),
    amountPaid: Number(i.amount_paid), sentAt: i.sent_at ?? undefined,
  }));
}

export async function createInvoiceFromJob(jobId: string): Promise<Invoice | null> {
  const { supabase, farm } = await ctx();
  const { data: job } = await supabase.from("job").select("*, customer:customer_id(name), customer_field:customer_field_id(name), job_service:job_service_id(name)").eq("id", jobId).single();
  if (!job) return null;
  const { count } = await supabase.from("invoice").select("id", { count: "exact", head: true }).eq("farm_business_id", farm.id);
  const invoiceNumber = String(1000 + (count ?? 0) + 1);
  const amount = Number(job.rate ?? 0) * Number(job.acres ?? 0);

  const { data: invoice, error } = await supabase.from("invoice").insert({
    farm_business_id: farm.id, customer_id: job.customer_id, invoice_number: invoiceNumber, status: "draft",
    issue_date: new Date().toISOString().slice(0, 10), subtotal: amount, additional_charges: 0, total: amount, amount_paid: 0,
  }).select("id").single();
  if (error || !invoice) throw error;

  await supabase.from("invoice_line").insert({
    invoice_id: invoice.id, job_id: job.id,
    description: `${job.job_service?.name ?? "Custom work"} — ${job.customer_field?.name ?? "Field"} (${job.acres ?? 0} ac @ $${job.rate ?? 0})`,
    quantity: job.acres ?? 1, unit_rate: job.rate ?? amount, amount,
  });
  await supabase.from("job").update({ status: "invoiced" }).eq("id", jobId);

  const invoices = await listInvoices();
  return invoices.find((i) => i.id === invoice.id) ?? null;
}

export async function createInvoice(input: {
  customerId: string; dueDate?: string;
  lines: { description: string; quantity: number; unitRate: number }[];
}): Promise<Invoice> {
  const { supabase, farm } = await ctx();
  const { count } = await supabase.from("invoice").select("id", { count: "exact", head: true }).eq("farm_business_id", farm.id);
  const invoiceNumber = String(1000 + (count ?? 0) + 1);
  const subtotal = input.lines.reduce((s, l) => s + l.quantity * l.unitRate, 0);

  const { data: invoice, error } = await supabase.from("invoice").insert({
    farm_business_id: farm.id, customer_id: input.customerId, invoice_number: invoiceNumber, status: "draft",
    issue_date: new Date().toISOString().slice(0, 10), due_date: input.dueDate ?? null,
    subtotal, additional_charges: 0, total: subtotal, amount_paid: 0,
  }).select("id").single();
  if (error || !invoice) throw new Error(error?.message ?? "Could not create invoice");

  if (input.lines.length > 0) {
    await supabase.from("invoice_line").insert(input.lines.map((l, i) => ({
      invoice_id: invoice.id, description: l.description, quantity: l.quantity, unit_rate: l.unitRate,
      amount: l.quantity * l.unitRate, sort_order: i,
    })));
  }

  const invoices = await listInvoices();
  const created = invoices.find((i) => i.id === invoice.id);
  if (!created) throw new Error("Invoice created but could not be re-fetched");
  return created;
}

export async function recordPayment(input: Omit<Payment, "id">) {
  const { supabase, farm } = await ctx();
  const { data: payment, error } = await supabase.from("payment").insert({
    farm_business_id: farm.id, invoice_id: input.invoiceId ?? null, customer_id: input.customerId,
    amount: input.amount, payment_date: input.paymentDate, payment_method: input.paymentMethod ?? null, notes: input.notes ?? null,
  }).select("id").single();
  if (error || !payment) throw error;

  if (input.invoiceId) {
    const { data: inv } = await supabase.from("invoice").select("amount_paid, total").eq("id", input.invoiceId).single();
    if (inv) {
      const newPaid = Number(inv.amount_paid) + input.amount;
      await supabase.from("invoice").update({ amount_paid: newPaid, status: newPaid >= Number(inv.total) ? "paid" : "partial" }).eq("id", input.invoiceId);
    }
  }

  await createTransaction({
    farmBusinessId: farm.id, taxYear: Number(input.paymentDate.slice(0, 4)) || farm.currentTaxYear, transactionType: "income", status: "categorized",
    transactionDate: input.paymentDate, customerId: input.customerId,
    description: `Payment received${input.paymentMethod ? " — " + input.paymentMethod : ""}`, amount: input.amount,
    isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
  });

  return { ...input, id: payment.id };
}

export async function listAssets(): Promise<Asset[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("asset").select("*").eq("farm_business_id", farm.id).is("archived_at", null);
  return (data ?? []).map((a: any): Asset => ({
    id: a.id, farmBusinessId: a.farm_business_id, assetType: a.asset_type, name: a.name, make: a.make ?? undefined,
    model: a.model ?? undefined, year: a.year ?? undefined, purchaseDate: a.purchase_date ?? undefined,
    purchasePrice: a.purchase_price != null ? Number(a.purchase_price) : undefined, placedInServiceDate: a.placed_in_service_date ?? undefined,
    businessUsePercent: Number(a.business_use_percent ?? 100), status: a.status, soldDate: a.sold_date ?? undefined,
    soldPrice: a.sold_price != null ? Number(a.sold_price) : undefined, notes: a.notes ?? undefined,
    usefulLifeYears: a.useful_life_years != null ? Number(a.useful_life_years) : undefined,
    salvageValue: a.salvage_value != null ? Number(a.salvage_value) : undefined,
  }));
}

export async function createAsset(input: {
  assetType: Asset["assetType"]; name: string; make?: string; model?: string; year?: number;
  purchaseDate?: string; purchasePrice?: number; placedInServiceDate?: string; businessUsePercent?: number;
  usefulLifeYears?: number; salvageValue?: number; notes?: string;
}): Promise<Asset> {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.from("asset").insert({
    farm_business_id: farm.id, asset_type: input.assetType, name: input.name, make: input.make, model: input.model,
    year: input.year, purchase_date: input.purchaseDate, purchase_price: input.purchasePrice,
    placed_in_service_date: input.placedInServiceDate, business_use_percent: input.businessUsePercent ?? 100,
    useful_life_years: input.usefulLifeYears, salvage_value: input.salvageValue ?? 0, notes: input.notes,
    status: "active",
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save equipment.");
  return {
    id: data.id, farmBusinessId: data.farm_business_id, assetType: data.asset_type, name: data.name,
    make: data.make ?? undefined, model: data.model ?? undefined, year: data.year ?? undefined,
    purchaseDate: data.purchase_date ?? undefined, purchasePrice: data.purchase_price != null ? Number(data.purchase_price) : undefined,
    placedInServiceDate: data.placed_in_service_date ?? undefined, businessUsePercent: Number(data.business_use_percent ?? 100),
    usefulLifeYears: data.useful_life_years != null ? Number(data.useful_life_years) : undefined,
    salvageValue: data.salvage_value != null ? Number(data.salvage_value) : undefined,
    status: data.status, notes: data.notes ?? undefined,
  };
}

export async function listAssetRepairs(assetId?: string): Promise<AssetRepair[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("asset_repair").select("*, asset:asset_id!inner(farm_business_id)").eq("asset.farm_business_id", farm.id);
  if (assetId) q = q.eq("asset_id", assetId);
  const { data } = await q;
  return (data ?? []).map((r: any): AssetRepair => ({ id: r.id, assetId: r.asset_id, repairDate: r.repair_date, description: r.description, cost: r.cost != null ? Number(r.cost) : undefined, odometerOrHours: r.odometer_or_hours != null ? Number(r.odometer_or_hours) : undefined }));
}

export async function listMileageTrips(): Promise<MileageTrip[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("mileage_trip").select("*, vehicle:vehicle_asset_id(name)").eq("farm_business_id", farm.id).order("trip_date", { ascending: false });
  return (data ?? []).map((m: any): MileageTrip => ({ id: m.id, farmBusinessId: m.farm_business_id, vehicleAssetId: m.vehicle_asset_id, vehicleName: m.vehicle?.name ?? "Vehicle", tripDate: m.trip_date, miles: Number(m.miles), purpose: m.purpose ?? undefined, source: m.source }));
}

export async function listLivestockGroups(): Promise<LivestockGroup[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("livestock_group").select("*").eq("farm_business_id", farm.id).is("archived_at", null);
  return (data ?? []).map((g: any): LivestockGroup => ({ id: g.id, farmBusinessId: g.farm_business_id, name: g.name, species: g.species, purpose: g.purpose, headCount: g.head_count, notes: g.notes ?? undefined }));
}

export async function listLivestockTransactions(groupId?: string): Promise<LivestockTransaction[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("livestock_transaction").select("*, group:livestock_group_id!inner(farm_business_id)").eq("group.farm_business_id", farm.id);
  if (groupId) q = q.eq("livestock_group_id", groupId);
  const { data } = await q;
  return (data ?? []).map((t: any): LivestockTransaction => ({ id: t.id, livestockGroupId: t.livestock_group_id, txnType: t.txn_type, txnDate: t.txn_date, headCount: t.head_count, totalAmount: t.total_amount != null ? Number(t.total_amount) : undefined, weightLbs: t.weight_lbs != null ? Number(t.weight_lbs) : undefined, notes: t.notes ?? undefined }));
}

export async function listLoans(): Promise<Loan[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("loan").select("*").eq("farm_business_id", farm.id);
  return (data ?? []).map((l: any): Loan => ({ id: l.id, farmBusinessId: l.farm_business_id, lenderName: l.lender_name, originalPrincipal: l.original_principal != null ? Number(l.original_principal) : undefined, originationDate: l.origination_date ?? undefined, interestRate: l.interest_rate != null ? Number(l.interest_rate) : undefined, termMonths: l.term_months ?? undefined, currentBalance: l.current_balance != null ? Number(l.current_balance) : undefined, notes: l.notes ?? undefined }));
}

export async function createLoan(input: Omit<Loan, "id" | "farmBusinessId">): Promise<Loan> {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.from("loan").insert({
    farm_business_id: farm.id, lender_name: input.lenderName, original_principal: input.originalPrincipal ?? null,
    origination_date: input.originationDate ?? null, interest_rate: input.interestRate ?? null,
    term_months: input.termMonths ?? null, current_balance: input.currentBalance ?? null, notes: input.notes ?? null,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create loan");
  return { ...input, id: data.id, farmBusinessId: farm.id };
}

export async function listPayments(): Promise<Payment[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("payment").select("*").eq("farm_business_id", farm.id).order("payment_date", { ascending: false });
  return (data ?? []).map((p: any): Payment => ({
    id: p.id, farmBusinessId: p.farm_business_id, invoiceId: p.invoice_id ?? undefined, customerId: p.customer_id,
    amount: Number(p.amount), paymentDate: p.payment_date, paymentMethod: p.payment_method ?? undefined, notes: p.notes ?? undefined,
  }));
}

export async function listInventory(): Promise<InventoryItem[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("inventory_item").select("*, product:product_id(name, category)").eq("farm_business_id", farm.id);
  return (data ?? []).map((i: any): InventoryItem => ({ id: i.id, farmBusinessId: i.farm_business_id, productId: i.product_id, productName: i.product?.name ?? "Product", category: i.product?.category ?? "other", unit: i.unit, quantityOnHand: Number(i.quantity_on_hand), averageUnitCost: Number(i.average_unit_cost ?? 0), reorderThreshold: i.reorder_threshold != null ? Number(i.reorder_threshold) : undefined }));
}

export async function listInventoryMovements(itemId?: string) {
  const { supabase, farm } = await ctx();
  let q = supabase.from("inventory_movement").select("*, item:inventory_item_id!inner(farm_business_id)").eq("item.farm_business_id", farm.id);
  if (itemId) q = q.eq("inventory_item_id", itemId);
  const { data } = await q;
  return data ?? [];
}

export async function listDocuments(category?: string): Promise<DocumentRecord[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("document").select("*").eq("farm_business_id", farm.id);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return (data ?? []).map((d: any): DocumentRecord => ({ id: d.id, farmBusinessId: d.farm_business_id, category: d.category, fileName: d.file_name, relatedFieldId: d.related_field_id ?? undefined, tags: d.tags ?? [], createdAt: d.created_at }));
}

export async function createDocument(input: Omit<DocumentRecord, "id" | "createdAt">) {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.from("document").insert({
    farm_business_id: farm.id, category: input.category, file_name: input.fileName, storage_path: `${farm.id}/${input.category}/${input.fileName}`,
    related_field_id: input.relatedFieldId ?? null, tags: input.tags,
  }).select("*").single();
  if (error || !data) throw error;
  return { ...input, id: data.id, createdAt: data.created_at };
}

export async function listTaxOpportunities(): Promise<TaxOpportunity[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase
    .from("tax_opportunity")
    .select("*, tax_year:tax_year_id(year), rule_version:tax_rule_version_id(summary, official_reference, tax_rule:tax_rule_id(title, description))")
    .eq("farm_business_id", farm.id);
  return (data ?? []).map((o: any): TaxOpportunity => ({
    id: o.id, farmBusinessId: o.farm_business_id, taxYear: o.tax_year?.year ?? 0, ruleTitle: o.rule_version?.tax_rule?.title ?? "Potential Tax Opportunity",
    ruleDescription: o.rule_version?.tax_rule?.description ?? "", officialReference: o.rule_version?.official_reference ?? undefined,
    sourceTransactionId: o.source_transaction_id ?? undefined, sourceAssetId: o.source_asset_id ?? undefined,
    sourceLivestockTxnId: o.source_livestock_txn_id ?? undefined,
    status: o.status, infoMissing: o.info_missing ?? [], documentsCollectedCount: (o.documents_collected ?? []).length, createdAt: o.created_at,
  }));
}

// -----------------------------------------------------------------------
// Tax-opportunity scanning. Runs the 8 seeded tax_rule trigger rules
// against this farm's real data for one tax year and writes any new
// matches into tax_opportunity (never asserting a tax treatment — just
// flagging "this fact pattern might be worth asking your CPA about").
// Re-running is safe: it skips any source it has already flagged for
// the same rule.
// -----------------------------------------------------------------------

const DISASTER_KEYWORDS = ["disaster", "casualty", "hail", "flood", "drought", "fire loss", "storm damage", "tornado", "wind damage"];
const PREPAID_FARM_CATEGORY_NAMES = new Set(["seed", "fertilizer", "chemical", "feed", "supplies"]);
const PREPAID_THRESHOLD = 2500;

export async function scanTaxOpportunities(taxYear: number): Promise<{ created: number; alreadyFlagged: number; checked: number }> {
  const { supabase, farm } = await ctx();
  const taxYearId = await getOrCreateTaxYear(supabase, farm.id, taxYear);
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear + 1}-01-01`;

  // Latest applicable tax_rule_version per rule key (effective_tax_year <= taxYear, else the earliest available).
  const { data: versions } = await supabase
    .from("tax_rule_version")
    .select("id, effective_tax_year, tax_rule:tax_rule_id(key)")
    .order("effective_tax_year", { ascending: false });
  const versionsByKey = new Map<string, { id: string; effective_tax_year: number }[]>();
  for (const v of (versions ?? []) as any[]) {
    const key = v.tax_rule?.key;
    if (!key) continue;
    const arr = versionsByKey.get(key) ?? [];
    arr.push({ id: v.id, effective_tax_year: v.effective_tax_year });
    versionsByKey.set(key, arr);
  }
  function versionIdFor(key: string): string | undefined {
    const arr = versionsByKey.get(key);
    if (!arr || arr.length === 0) return undefined;
    return (arr.find((v) => v.effective_tax_year <= taxYear) ?? arr[arr.length - 1]).id;
  }

  // What's already been flagged for this farm/year, so we never double-flag the same fact.
  const { data: existing } = await supabase
    .from("tax_opportunity")
    .select("source_transaction_id, source_asset_id, source_livestock_txn_id, rule_version:tax_rule_version_id(tax_rule:tax_rule_id(key))")
    .eq("farm_business_id", farm.id)
    .eq("tax_year_id", taxYearId);
  const existingKeys = new Set(
    ((existing ?? []) as any[]).map((o) => `${o.rule_version?.tax_rule?.key}:${o.source_transaction_id ?? o.source_asset_id ?? o.source_livestock_txn_id ?? ""}`)
  );

  type Candidate = { ruleKey: string; sourceTransactionId?: string; sourceAssetId?: string; sourceLivestockTxnId?: string };
  const candidates: Candidate[] = [];
  let checked = 0;

  // --- Assets: Section 179 (purchased this year) / trade-in basis review (sold this year) ---
  const { data: assets } = await supabase
    .from("asset")
    .select("id, purchase_date, sold_date, status")
    .eq("farm_business_id", farm.id)
    .is("archived_at", null);
  for (const a of (assets ?? []) as any[]) {
    checked++;
    if (a.purchase_date && a.purchase_date >= yearStart && a.purchase_date < yearEnd) {
      candidates.push({ ruleKey: "section_179_equipment", sourceAssetId: a.id });
    }
    if (a.status === "sold" && a.sold_date && a.sold_date >= yearStart && a.sold_date < yearEnd) {
      candidates.push({ ruleKey: "like_kind_no_longer_avail", sourceAssetId: a.id });
    }
  }

  // --- Breeding livestock sold this year ---
  const { data: breedingGroups } = await supabase
    .from("livestock_group")
    .select("id")
    .eq("farm_business_id", farm.id)
    .eq("purpose", "breeding");
  const breedingGroupIds = (breedingGroups ?? []).map((g: any) => g.id);
  if (breedingGroupIds.length > 0) {
    const { data: sales } = await supabase
      .from("livestock_transaction")
      .select("id, txn_type, txn_date")
      .in("livestock_group_id", breedingGroupIds)
      .eq("txn_type", "sale")
      .gte("txn_date", yearStart)
      .lt("txn_date", yearEnd);
    for (const s of (sales ?? []) as any[]) {
      checked++;
      candidates.push({ ruleKey: "breeding_livestock_capital", sourceLivestockTxnId: s.id });
    }
  }

  // --- Transactions: prepaid supplies, conservation, government payments, crop insurance, disaster/casualty keywords ---
  const { data: txns } = await supabase
    .from("transaction")
    .select("id, transaction_type, transaction_date, amount, description, tax_category:tax_category_id(code), farm_category:farm_category_id(name)")
    .eq("farm_business_id", farm.id)
    .eq("tax_year_id", taxYearId)
    .eq("is_personal_excluded", false);
  // Net Schedule C (self-employment) income for the year, tracked alongside the
  // per-transaction rule checks below so the scan isn't only looking at farm data.
  let seNetIncome = 0;

  for (const t of (txns ?? []) as any[]) {
    checked++;
    const farmCatName = (t.farm_category?.name ?? "").toLowerCase();
    const taxCode = t.tax_category?.code ?? "";
    const desc = (t.description ?? "").toLowerCase();
    const month = t.transaction_date ? Number(String(t.transaction_date).slice(5, 7)) : 0;

    if (t.transaction_type === "expense" && month >= 11 && Number(t.amount) >= PREPAID_THRESHOLD &&
        [...PREPAID_FARM_CATEGORY_NAMES].some((n) => farmCatName.includes(n))) {
      candidates.push({ ruleKey: "prepaid_farm_supplies", sourceTransactionId: t.id });
    }
    if (taxCode === "exp_conservation") {
      candidates.push({ ruleKey: "conservation_expense", sourceTransactionId: t.id });
    }
    if (taxCode === "income_govt_payments" || taxCode === "income_ccc_loans") {
      candidates.push({ ruleKey: "government_payment_reporting", sourceTransactionId: t.id });
    }
    if (taxCode === "income_crop_insurance") {
      candidates.push({ ruleKey: "crop_insurance_deferral", sourceTransactionId: t.id });
    }
    if (DISASTER_KEYWORDS.some((kw) => desc.includes(kw))) {
      candidates.push({ ruleKey: "disaster_casualty", sourceTransactionId: t.id });
    }
    if (taxCode.startsWith("se_income")) seNetIncome += Number(t.amount);
    else if (taxCode.startsWith("se_exp")) seNetIncome -= Number(t.amount);
  }

  // Self-employment tax (Schedule SE) generally applies once net SE earnings hit $400 —
  // flag it once per year (no single transaction "causes" it) rather than per transaction.
  if (seNetIncome >= 400) {
    candidates.push({ ruleKey: "self_employment_tax_review" });
  }

  // --- Write new (non-duplicate) candidates ---
  let created = 0;
  let alreadyFlagged = 0;
  for (const c of candidates) {
    const sourceId = c.sourceTransactionId ?? c.sourceAssetId ?? c.sourceLivestockTxnId ?? "";
    const dedupeKey = `${c.ruleKey}:${sourceId}`;
    if (existingKeys.has(dedupeKey)) { alreadyFlagged++; continue; }
    const versionId = versionIdFor(c.ruleKey);
    if (!versionId) continue;
    const { error } = await supabase.from("tax_opportunity").insert({
      farm_business_id: farm.id,
      tax_year_id: taxYearId,
      tax_rule_version_id: versionId,
      source_transaction_id: c.sourceTransactionId ?? null,
      source_asset_id: c.sourceAssetId ?? null,
      source_livestock_txn_id: c.sourceLivestockTxnId ?? null,
      status: "open",
    });
    if (!error) {
      created++;
      existingKeys.add(dedupeKey);
    }
  }

  return { created, alreadyFlagged, checked };
}

export async function listTaxQuestions(): Promise<TaxQuestion[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("tax_question").select("*").eq("farm_business_id", farm.id).order("created_at", { ascending: false });
  return (data ?? []).map((q: any): TaxQuestion => ({ id: q.id, farmBusinessId: q.farm_business_id, taxYear: 0, question: q.question, raisedByName: "You", status: q.status, cpaResponse: q.cpa_response ?? undefined, createdAt: q.created_at }));
}

export async function createTaxQuestion(question: string, _raisedByName: string) {
  const { supabase, farm } = await ctx();
  const taxYearId = await getOrCreateTaxYear(supabase, farm.id, farm.currentTaxYear);
  const { data } = await supabase.from("tax_question").insert({ farm_business_id: farm.id, tax_year_id: taxYearId, question }).select("*").single();
  return data;
}

// --- Aggregate / calculated ---

export async function fieldProfitability(fieldId: string, taxYear: number): Promise<FieldProfitability> {
  const [field, txns, categories] = await Promise.all([getField(fieldId), listTransactions({ taxYear }), listFarmCategories()]);
  return computeFieldProfitability(
    field ?? ({ id: fieldId, name: "Unknown", acres: 0 } as Field),
    txns,
    bucketMapFromCategories(categories)
  );
}

function bucketMapFromCategories(categories: FarmCategory[]): Record<string, string> {
  const bucketByCategory: Record<string, string> = {};
  for (const c of categories) {
    const name = c.name.toLowerCase();
    if (name.includes("seed")) bucketByCategory[c.id] = "expenseSeed";
    else if (name.includes("fertil")) bucketByCategory[c.id] = "expenseFertilizer";
    else if (name.includes("chem")) bucketByCategory[c.id] = "expenseChemical";
    else if (name.includes("fuel")) bucketByCategory[c.id] = "expenseFuel";
    else if (name.includes("rent")) bucketByCategory[c.id] = "expenseRent";
    else if (name.includes("insur")) bucketByCategory[c.id] = "expenseInsurance";
    else if (name.includes("custom")) bucketByCategory[c.id] = "expenseCustomWork";
    else if (name.includes("truck")) bucketByCategory[c.id] = "expenseTrucking";
  }
  return bucketByCategory;
}

function computeFieldProfitability(field: Field, txns: Transaction[], bucketByCategory: Record<string, string>): FieldProfitability {
  const result: FieldProfitability = {
    fieldId: field.id, fieldName: field.name, acres: field.acres, cropName: undefined,
    income: 0, expenseSeed: 0, expenseFertilizer: 0, expenseChemical: 0, expenseFuel: 0, expenseRent: 0,
    expenseInsurance: 0, expenseCustomWork: 0, expenseHarvest: 0, expenseDrying: 0, expenseTrucking: 0,
    expenseOther: 0, totalExpense: 0, margin: 0, incomePerAcre: 0, expensePerAcre: 0, marginPerAcre: 0,
  };
  for (const t of txns) {
    for (const s of t.splits) {
      if (s.fieldId !== field.id) continue;
      if (t.transactionType === "income") result.income += s.allocatedAmount;
      else if (t.transactionType === "expense") {
        const bucket = t.farmCategoryId ? bucketByCategory[t.farmCategoryId] : undefined;
        if (bucket) (result as any)[bucket] += s.allocatedAmount;
        else result.expenseOther += s.allocatedAmount;
      }
    }
  }
  result.totalExpense = result.expenseSeed + result.expenseFertilizer + result.expenseChemical + result.expenseFuel +
    result.expenseRent + result.expenseInsurance + result.expenseCustomWork + result.expenseHarvest +
    result.expenseDrying + result.expenseTrucking + result.expenseOther;
  result.margin = result.income - result.totalExpense;
  const acres = result.acres || 1;
  result.incomePerAcre = round2(result.income / acres);
  result.expensePerAcre = round2(result.totalExpense / acres);
  result.marginPerAcre = round2(result.margin / acres);
  return result;
}

/**
 * All fields' profitability for a year, in a fixed handful of round trips
 * regardless of how many fields there are. The previous version called
 * fieldProfitability() (3 of its own queries) once PER FIELD, plus 3 more
 * queries just to figure out which fields were used that year — for 10
 * fields that's ~33 sequential-ish round trips to render one page. This
 * fetches transactions/categories/crop-years/activities ONCE and computes
 * every field's numbers from that in memory.
 */
export async function allFieldProfitability(taxYear: number) {
  const { supabase, farm } = await ctx();
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear + 1}-01-01`;

  const [fields, txns, categories, cropYearRes, activityRes] = await Promise.all([
    listFields(),
    listTransactions({ taxYear }),
    listFarmCategories(),
    supabase.from("crop_year").select("field_id, tax_year:tax_year_id(year, farm_business_id)"),
    supabase.from("activity").select("field_id").eq("farm_business_id", farm.id)
      .not("field_id", "is", null).gte("activity_date", yearStart).lt("activity_date", yearEnd),
  ]);

  // Which fields were actually used this year — a crop planted, an activity
  // logged, or money allocated to it (that last part comes straight out of
  // the transactions we already fetched, no extra query needed).
  const usedIds = new Set<string>();
  for (const r of (cropYearRes.data ?? []) as any[]) {
    if (r.tax_year?.farm_business_id === farm.id && r.tax_year?.year === taxYear) usedIds.add(r.field_id);
  }
  for (const r of (activityRes.data ?? []) as any[]) if (r.field_id) usedIds.add(r.field_id);
  for (const t of txns) for (const s of t.splits) if (s.fieldId && s.allocatedAmount !== 0) usedIds.add(s.fieldId);

  const bucketByCategory = bucketMapFromCategories(categories);
  return fields.filter((f) => usedIds.has(f.id)).map((f) => computeFieldProfitability(f, txns, bucketByCategory));
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export async function dashboardSummary(taxYear: number) {
  const [txns, receipts, invoices, taxQuestions, inventory] = await Promise.all([
    listTransactions({ taxYear }), listReceipts(), listInvoices(), listTaxQuestions(), listInventory(),
  ]);
  const active = txns.filter((t) => !t.isPersonalExcluded);
  const income = active.filter((t) => t.transactionType === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = active.filter((t) => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0);
  const margin = income - expenses;
  const missingReceipts = active.filter((t) => t.transactionType === "expense" && !t.receiptId).length;
  const needsReview = active.filter((t) => t.status === "needs_review").length;
  const overdueInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "void" && i.dueDate && new Date(i.dueDate) < new Date()).length;
  const cpaQuestionsOpen = taxQuestions.filter((q) => q.status === "open").length;
  const unconfirmedReceipts = receipts.filter((r) => r.ocrStatus !== "confirmed").length;
  const lowInventory = inventory.filter((i) => i.reorderThreshold && i.quantityOnHand < i.reorderThreshold).length;

  const totalChecklist = 6;
  let complete = 0;
  if (missingReceipts === 0) complete++;
  if (needsReview === 0) complete++;
  if (cpaQuestionsOpen === 0) complete++;
  if (overdueInvoices === 0) complete++;
  if (unconfirmedReceipts === 0) complete++;
  if (lowInventory === 0) complete++;

  return {
    income, expenses, margin, taxReadinessPct: Math.round((complete / totalChecklist) * 100),
    needsAttention: { missingReceipts, transactionsNeedingReview: needsReview, cpaQuestionsOpen, overdueInvoices, unconfirmedReceipts, lowInventory },
  };
}

export async function listFarmCategories(): Promise<FarmCategory[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("farm_category").select("id, name, default_tax_category_id").or(`farm_business_id.eq.${farm.id},farm_business_id.is.null`).order("name");
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name, defaultTaxCategoryCode: undefined }));
}

export async function listCustomerFields(): Promise<CustomerField[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("customer_field").select("*, customer:customer_id!inner(farm_business_id)").eq("customer.farm_business_id", farm.id);
  return (data ?? []).map((f: any) => ({ id: f.id, customerId: f.customer_id, name: f.name, acres: f.acres != null ? Number(f.acres) : undefined, county: f.county ?? undefined }));
}

/** Aggregate accessor mirroring the demo store's getDB() shape, for pages/exports that read several collections at once. */
export async function getAppData(taxYear: number) {
  const [fields, farmCategories, customers, customerFields, transactions] = await Promise.all([
    listFields(), listFarmCategories(), listCustomers(), listCustomerFields(), listTransactions({ taxYear }),
  ]);
  return { fields, farmCategories, customers, customerFields, transactions } as Pick<DB, "fields" | "farmCategories" | "customers" | "customerFields" | "transactions">;
}
