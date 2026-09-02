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

async function getOrCreateTaxYear(supabase: any, farmId: string, year: number) {
  const { data: existing } = await supabase.from("tax_year").select("id").eq("farm_business_id", farmId).eq("year", year).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from("tax_year").insert({ farm_business_id: farmId, year }).select("id").single();
  if (error) throw error;
  return created.id;
}

async function getOrCreateVendor(supabase: any, farmId: string, name?: string) {
  if (!name) return null;
  const { data: existing } = await supabase.from("vendor").select("id").eq("farm_business_id", farmId).eq("name", name).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase.from("vendor").insert({ farm_business_id: farmId, name }).select("id").single();
  return created?.id ?? null;
}

function mapTransaction(r: any, splits: TransactionSplit[]): Transaction {
  return {
    id: r.id, farmBusinessId: r.farm_business_id, taxYear: r.tax_year?.year ?? 0,
    transactionType: r.transaction_type, status: r.status, transactionDate: r.transaction_date,
    vendorId: r.vendor_id ?? undefined, vendorName: r.vendor?.name ?? undefined, customerId: r.customer_id ?? undefined,
    description: r.description ?? undefined, amount: Number(r.amount), salesTax: r.sales_tax != null ? Number(r.sales_tax) : 0,
    paymentMethod: r.payment_method ?? undefined, farmCategoryId: r.farm_category_id ?? undefined,
    taxCategoryCode: r.tax_category?.code ?? undefined, receiptId: r.receipt_id ?? undefined,
    isPersonalExcluded: r.is_personal_excluded, cpaFlag: r.cpa_flag, cpaNote: r.cpa_note ?? undefined,
    syncStatus: r.sync_status, splits, createdAt: r.created_at,
  };
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

function mapSplits(rows: any[], transactionId: string): TransactionSplit[] {
  return rows.filter((s) => s.transaction_id === transactionId).map((s) => ({
    id: s.id, transactionId: s.transaction_id, targetType: s.target_type, fieldId: s.field_id ?? undefined,
    cropYearId: s.crop_year_id ?? undefined, jobId: s.job_id ?? undefined, equipmentAssetId: s.equipment_asset_id ?? undefined,
    allocationMethod: s.allocation_method, allocatedAmount: Number(s.allocated_amount),
    farmCategoryId: s.farm_category_id ?? undefined, notes: s.notes ?? undefined,
  }));
}

export async function createTransaction(input: Omit<Transaction, "id" | "createdAt" | "splits"> & { splits?: Omit<TransactionSplit, "id" | "transactionId">[] }) {
  const { supabase, farm } = await ctx();
  const taxYearId = await getOrCreateTaxYear(supabase, farm.id, input.taxYear);
  const vendorId = input.vendorId ?? (await getOrCreateVendor(supabase, farm.id, input.vendorName));

  const { data: txn, error } = await supabase.from("transaction").insert({
    farm_business_id: farm.id, tax_year_id: taxYearId, transaction_type: input.transactionType,
    status: input.status, transaction_date: input.transactionDate, vendor_id: vendorId,
    customer_id: input.customerId ?? null, description: input.description ?? null, amount: input.amount,
    sales_tax: input.salesTax ?? 0, payment_method: input.paymentMethod ?? null,
    farm_category_id: input.farmCategoryId ?? null, receipt_id: input.receiptId ?? null,
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

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const { supabase } = await ctx();
  const update: Record<string, unknown> = {};
  if (patch.farmCategoryId !== undefined) update.farm_category_id = patch.farmCategoryId;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.cpaFlag !== undefined) update.cpa_flag = patch.cpaFlag;
  if (patch.cpaNote !== undefined) update.cpa_note = patch.cpaNote;
  if (Object.keys(update).length > 0) await supabase.from("transaction").update(update).eq("id", id);

  if (patch.splits) {
    for (const s of patch.splits) {
      if (s.id) await supabase.from("transaction_split").update({ field_id: s.fieldId ?? null, target_type: s.targetType }).eq("id", s.id);
    }
  }
  return null;
}

export async function listReceipts(): Promise<Receipt[]> {
  const { supabase, farm } = await ctx();
  const { data } = await supabase.from("receipt").select("*").eq("farm_business_id", farm.id).order("created_at", { ascending: false });
  const { data: linked } = await supabase.from("transaction").select("id, receipt_id").eq("farm_business_id", farm.id).not("receipt_id", "is", null);
  return (data ?? []).map((r: any): Receipt => ({
    id: r.id, farmBusinessId: r.farm_business_id, fileName: r.document_id ? r.file_name ?? "receipt" : r.file_name ?? "receipt",
    captureSource: r.capture_source, ocrStatus: r.ocr_status, ocrVendorGuess: r.ocr_vendor_guess ?? undefined,
    ocrDateGuess: r.ocr_date_guess ?? undefined, ocrAmountGuess: r.ocr_amount_guess != null ? Number(r.ocr_amount_guess) : undefined,
    ocrTaxGuess: r.ocr_tax_guess != null ? Number(r.ocr_tax_guess) : undefined, ocrLineItems: r.ocr_line_items ?? undefined,
    confirmedAt: r.confirmed_at ?? undefined, linkedTransactionId: linked?.find((t: any) => t.receipt_id === r.id)?.id,
    syncStatus: r.sync_status, createdAt: r.created_at,
  }));
}

export async function createReceipt(input: Omit<Receipt, "id" | "createdAt">) {
  const { supabase, farm } = await ctx();
  const { data, error } = await supabase.from("receipt").insert({
    farm_business_id: farm.id, capture_source: input.captureSource, ocr_status: input.ocrStatus,
    ocr_vendor_guess: input.ocrVendorGuess ?? null, ocr_date_guess: input.ocrDateGuess ?? null,
    ocr_amount_guess: input.ocrAmountGuess ?? null, ocr_tax_guess: input.ocrTaxGuess ?? null,
    ocr_line_items: input.ocrLineItems ?? null, sync_status: "synced",
  }).select("*").single();
  if (error || !data) throw error;
  return { ...input, id: data.id, createdAt: data.created_at };
}

export async function confirmReceipt(id: string, patch: Partial<Receipt> & { createTransaction?: boolean; farmCategoryId?: string; fieldId?: string }) {
  const { supabase, farm } = await ctx();
  await supabase.from("receipt").update({
    ocr_vendor_guess: patch.ocrVendorGuess ?? null, ocr_date_guess: patch.ocrDateGuess ?? null,
    ocr_amount_guess: patch.ocrAmountGuess ?? null, ocr_tax_guess: patch.ocrTaxGuess ?? null,
    ocr_status: "confirmed", confirmed_at: new Date().toISOString(),
  }).eq("id", id);

  if (patch.createTransaction) {
    await createTransaction({
      farmBusinessId: farm.id, taxYear: farm.currentTaxYear, transactionType: "expense", status: "categorized",
      transactionDate: patch.ocrDateGuess ?? new Date().toISOString().slice(0, 10), vendorName: patch.ocrVendorGuess,
      description: `Receipt — ${patch.ocrVendorGuess ?? "upload"}`, amount: patch.ocrAmountGuess ?? 0,
      salesTax: patch.ocrTaxGuess ?? 0, farmCategoryId: patch.farmCategoryId, receiptId: id,
      isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
      splits: [{ targetType: patch.fieldId ? "field" : "general_overhead", fieldId: patch.fieldId, allocationMethod: "manual", allocatedAmount: patch.ocrAmountGuess ?? 0, farmCategoryId: patch.farmCategoryId }],
    });
  }
  return null;
}

export async function listActivities(filters: { fieldId?: string; activityType?: string; customerId?: string } = {}): Promise<Activity[]> {
  const { supabase, farm } = await ctx();
  let q = supabase.from("activity").select("*, field:field_id(name), customer_field:customer_field_id(name), spray_product_line(*, product:product_id(name, epa_registration_number)), fertilizer_product_line(*, product:product_id(name)), planting_activity_detail(seeding_rate, seed_product:seed_product_id(name)), harvest_activity_detail(yield_amount, yield_unit, moisture_pct)")
    .eq("farm_business_id", farm.id).order("activity_date", { ascending: false });
  if (filters.fieldId) q = q.eq("field_id", filters.fieldId);
  if (filters.activityType) q = q.eq("activity_type", filters.activityType);
  if (filters.customerId) q = q.eq("customer_id", filters.customerId);
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

  async function upsertProductLine(line: { productId?: string; productName: string; rate: number; rateUnit: string; quantityUsed: number; quantityUnit: string }, category: string, table: "spray_product_line" | "fertilizer_product_line") {
    let productId = line.productId;
    if (!productId || productId.startsWith("prod-")) {
      const { data: prod } = await supabase.from("product").upsert(
        { farm_business_id: farm.id, category, name: line.productName, default_unit: line.quantityUnit },
        { onConflict: "farm_business_id,name" }
      ).select("id").maybeSingle();
      productId = prod?.id;
    }
    if (!productId) return;
    const { data: item } = await supabase.from("inventory_item").select("id, quantity_on_hand, average_unit_cost")
      .eq("farm_business_id", farm.id).eq("product_id", productId).eq("unit", line.quantityUnit).maybeSingle();
    let inventoryItemId = item?.id;
    if (!inventoryItemId) {
      const { data: created } = await supabase.from("inventory_item").insert({ farm_business_id: farm.id, product_id: productId, unit: line.quantityUnit, quantity_on_hand: 0 }).select("id").single();
      inventoryItemId = created?.id;
    } else {
      await supabase.from("inventory_item").update({ quantity_on_hand: Math.max(0, Number(item?.quantity_on_hand ?? 0) - line.quantityUsed) }).eq("id", inventoryItemId);
    }
    await supabase.from(table).insert({ activity_id: activityId, product_id: productId, rate: line.rate, rate_unit: line.rateUnit, quantity_used: line.quantityUsed, quantity_unit: line.quantityUnit });
    if (inventoryItemId) {
      await supabase.from("inventory_movement").insert({ inventory_item_id: inventoryItemId, movement_type: input.jobId ? "use_customer_job" : "use_own_field", quantity: -line.quantityUsed, related_activity_id: activityId, related_job_id: input.jobId ?? null });
    }
  }

  for (const line of input.sprayProducts ?? []) {
    await upsertProductLine(line, "chemical", "spray_product_line");
  }
  for (const line of input.fertilizerProducts ?? []) {
    await upsertProductLine({ ...line, productId: undefined }, "fertilizer", "fertilizer_product_line");
  }

  if (input.seedProductName || input.seedingRate != null) {
    let seedProductId: string | undefined;
    if (input.seedProductName) {
      const { data: prod } = await supabase.from("product").upsert(
        { farm_business_id: farm.id, category: "seed", name: input.seedProductName, default_unit: "seeds" },
        { onConflict: "farm_business_id,name" }
      ).select("id").maybeSingle();
      seedProductId = prod?.id;
    }
    await supabase.from("planting_activity_detail").upsert({
      activity_id: activityId, seed_product_id: seedProductId ?? null, seeding_rate: input.seedingRate ?? null,
    }, { onConflict: "activity_id" });
  }

  if (input.yieldAmount != null || input.moisturePct != null) {
    await supabase.from("harvest_activity_detail").upsert({
      activity_id: activityId, yield_amount: input.yieldAmount ?? null, yield_unit: input.yieldUnit ?? null, moisture_pct: input.moisturePct ?? null,
    }, { onConflict: "activity_id" });
  }

  return { ...input, id: activityId, createdAt: new Date().toISOString() };
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
    farmBusinessId: farm.id, taxYear: farm.currentTaxYear, transactionType: "income", status: "categorized",
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
  }));
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
  const { data } = await supabase.from("tax_opportunity").select("*, rule_version:tax_rule_version_id(summary, official_reference, tax_rule:tax_rule_id(title, description))").eq("farm_business_id", farm.id);
  return (data ?? []).map((o: any): TaxOpportunity => ({
    id: o.id, farmBusinessId: o.farm_business_id, taxYear: 0, ruleTitle: o.rule_version?.tax_rule?.title ?? "Potential Tax Opportunity",
    ruleDescription: o.rule_version?.tax_rule?.description ?? "", officialReference: o.rule_version?.official_reference ?? undefined,
    sourceTransactionId: o.source_transaction_id ?? undefined, sourceAssetId: o.source_asset_id ?? undefined,
    status: o.status, infoMissing: o.info_missing ?? [], documentsCollectedCount: (o.documents_collected ?? []).length, createdAt: o.created_at,
  }));
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

  const result: FieldProfitability = {
    fieldId, fieldName: field?.name ?? "Unknown", acres: field?.acres ?? 0, cropName: undefined,
    income: 0, expenseSeed: 0, expenseFertilizer: 0, expenseChemical: 0, expenseFuel: 0, expenseRent: 0,
    expenseInsurance: 0, expenseCustomWork: 0, expenseHarvest: 0, expenseDrying: 0, expenseTrucking: 0,
    expenseOther: 0, totalExpense: 0, margin: 0, incomePerAcre: 0, expensePerAcre: 0, marginPerAcre: 0,
  };
  for (const t of txns) {
    for (const s of t.splits) {
      if (s.fieldId !== fieldId) continue;
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

export async function allFieldProfitability(taxYear: number) {
  const fields = await listFields();
  return Promise.all(fields.map((f) => fieldProfitability(f.id, taxYear)));
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
