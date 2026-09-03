"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as repo from "@/lib/data/repo";
import { getFarm } from "@/lib/data/repo";

/** Switch which tax year the app is currently displaying (Transactions, Reports, Home, etc). */
export async function setViewTaxYearAction(formData: FormData) {
  const year = Number(formData.get("year"));
  const returnTo = String(formData.get("returnTo") ?? "/home");
  if (Number.isFinite(year)) {
    const jar = await cookies();
    jar.set("fl_view_tax_year", String(year), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(returnTo);
}

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function num(fd: FormData, key: string) {
  const v = str(fd, key);
  return v !== undefined ? Number(v) : undefined;
}

export async function createExpenseOrIncome(formData: FormData) {
  const farm = await getFarm();
  const type = (str(formData, "transactionType") ?? "expense") as "income" | "expense";
  const fieldId = str(formData, "fieldId");
  const jobId = str(formData, "jobId");
  const amount = num(formData, "amount") ?? 0;
  const transactionDate = str(formData, "transactionDate") ?? new Date().toISOString().slice(0, 10);
  // File under the year the transaction actually happened, not whatever the
  // farm's "current" onboarding year is — otherwise a 2025 receipt entered
  // while the farm is set to 2026 would silently land in the wrong year.
  const taxYear = Number(transactionDate.slice(0, 4)) || farm.currentTaxYear;

  await repo.createTransaction({
    farmBusinessId: farm.id,
    taxYear,
    transactionType: type,
    status: "categorized",
    transactionDate,
    vendorName: str(formData, "vendorName"),
    customerId: str(formData, "customerId"),
    description: str(formData, "description"),
    amount,
    salesTax: num(formData, "salesTax") ?? 0,
    paymentMethod: str(formData, "paymentMethod"),
    farmCategoryId: str(formData, "farmCategoryId"),
    isPersonalExcluded: str(formData, "isPersonalExcluded") === "on",
    cpaFlag: false,
    syncStatus: "synced",
    splits: [{
      targetType: fieldId ? "field" : jobId ? "customer_job" : "general_overhead",
      fieldId, jobId,
      allocationMethod: "manual",
      allocatedAmount: amount,
      farmCategoryId: str(formData, "farmCategoryId"),
    }],
  });

  revalidatePath("/money/transactions");
  revalidatePath("/home");
}

export async function createFieldAction(formData: FormData) {
  await repo.createField({
    name: str(formData, "name") ?? "Untitled Field",
    acres: num(formData, "acres") ?? 0,
    tillableAcres: num(formData, "tillableAcres"),
    ownership: (str(formData, "ownership") ?? "owned") as any,
    landownerName: str(formData, "landownerName"),
    county: str(formData, "county"),
    fsaFarmNumber: str(formData, "fsaFarmNumber"),
    fsaTractNumber: str(formData, "fsaTractNumber"),
    fsaFieldNumber: str(formData, "fsaFieldNumber"),
    irrigated: str(formData, "irrigated") === "on",
    notes: str(formData, "notes"),
  });

  revalidatePath("/fields");
}

/**
 * Create one or more fields on the fly during a CSV activity import, for
 * field names in the file that don't match any existing field. We only
 * have a name (and, if the file had an Acres column, an acreage guess) —
 * everything else (ownership, county, FSA numbers) is left blank so the
 * caller can tell the user to fill those in on the Fields page afterward.
 */
export async function createFieldsForImportAction(names: { name: string; acres?: number | null }[]) {
  const created: { name: string; id: string }[] = [];
  for (const n of names) {
    const field = await repo.createField({
      name: n.name,
      acres: n.acres ?? 0,
      ownership: "owned",
      irrigated: false,
    });
    created.push({ name: n.name, id: field.id });
  }
  revalidatePath("/fields");
  return created;
}

export async function createFieldActivity(formData: FormData) {
  const farm = await getFarm();
  const activityType = str(formData, "activityType") as any;
  const fieldId = str(formData, "fieldId");
  const customerFieldId = str(formData, "customerFieldId");
  const field = fieldId ? await repo.getField(fieldId) : null;

  const sprayProductName = str(formData, "sprayProductName");
  const sprayProducts = sprayProductName
    ? [{
        productId: str(formData, "sprayProductId") ?? "prod-custom",
        productName: sprayProductName,
        rate: num(formData, "sprayRate") ?? 0,
        rateUnit: str(formData, "sprayRateUnit") ?? "oz/ac",
        quantityUsed: num(formData, "sprayQuantity") ?? 0,
        quantityUnit: str(formData, "sprayQuantityUnit") ?? "gal",
      }]
    : undefined;

  await repo.createActivity({
    farmBusinessId: farm.id,
    activityType,
    fieldId,
    fieldName: field?.name,
    customerFieldId,
    jobId: str(formData, "jobId"),
    activityDate: str(formData, "activityDate") ?? new Date().toISOString().slice(0, 10),
    acres: num(formData, "acres"),
    applicatorName: str(formData, "applicatorName"),
    sprayProducts,
    seedProductName: str(formData, "seedProductName"),
    seedingRate: num(formData, "seedingRate"),
    yieldAmount: num(formData, "yieldAmount"),
    yieldUnit: str(formData, "yieldUnit"),
    notes: str(formData, "notes"),
    syncStatus: "synced",
  });

  revalidatePath("/fields");
  revalidatePath("/home");
}

/**
 * Bulk import of field activities (plant/spray/fertilize/harvest/etc.),
 * e.g. from a CSV exported out of AgFiniti, FieldView, AFS Connect, or any
 * similar equipment-data platform. The import UI has already resolved each
 * row's free-text field name and activity-type text to a real fieldId and
 * one of our ActivityType enum values before calling this — this action
 * just does the writes and reports back how many succeeded/failed.
 */
export async function importActivitiesAction(rows: {
  activityDate: string;
  fieldId: string;
  fieldName?: string;
  activityType: string;
  acres?: number | null;
  productName?: string | null;
  rate?: number | null;
  rateUnit?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  yieldAmount?: number | null;
  yieldUnit?: string | null;
  moisturePct?: number | null;
  applicatorName?: string | null;
  notes?: string | null;
}[]) {
  const farm = await getFarm();
  let imported = 0;
  let skippedDuplicates = 0;
  const errors: string[] = [];

  // Guard against re-importing the same CSV (or a file with repeated rows):
  // build a signature for every activity already on each field, then skip
  // any incoming row that matches one already there (checked against both
  // what's already saved AND what this same import has already inserted).
  const existingByField = new Map<string, Set<string>>();
  function signature(row: { activityDate: string; activityType: string; acres?: number | null; productName?: string | null; yieldAmount?: number | null }) {
    const acres = row.acres != null ? Math.round(row.acres * 1000) / 1000 : "";
    const yieldAmount = row.yieldAmount != null ? Math.round(row.yieldAmount * 1000) / 1000 : "";
    return [row.activityDate, row.activityType, acres, (row.productName ?? "").trim().toLowerCase(), yieldAmount].join("|");
  }
  async function seenForField(fieldId: string) {
    let set = existingByField.get(fieldId);
    if (!set) {
      const existing = await repo.listActivities({ fieldId });
      set = new Set(existing.map((a) =>
        signature({
          activityDate: a.activityDate,
          activityType: a.activityType,
          acres: a.acres ?? null,
          productName: a.sprayProducts?.[0]?.productName ?? a.seedProductName ?? null,
          yieldAmount: a.yieldAmount ?? null,
        })
      ));
      existingByField.set(fieldId, set);
    }
    return set;
  }

  for (const row of rows) {
    try {
      const seen = await seenForField(row.fieldId);
      const sig = signature(row);
      if (seen.has(sig)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(sig);

      const isSpray = row.activityType === "spray" || row.activityType === "fertilize";
      await repo.createActivity({
        farmBusinessId: farm.id,
        activityType: row.activityType as any,
        fieldId: row.fieldId,
        fieldName: row.fieldName,
        activityDate: row.activityDate,
        acres: row.acres ?? undefined,
        applicatorName: row.applicatorName ?? undefined,
        sprayProducts: isSpray && row.productName ? [{
          productId: "prod-imported",
          productName: row.productName,
          rate: row.rate ?? 0,
          rateUnit: row.rateUnit ?? "",
          quantityUsed: row.quantity ?? 0,
          quantityUnit: row.quantityUnit ?? "",
        }] : undefined,
        seedProductName: row.activityType === "plant" ? (row.productName ?? undefined) : undefined,
        seedingRate: row.activityType === "plant" ? (row.rate ?? undefined) : undefined,
        yieldAmount: row.yieldAmount ?? undefined,
        yieldUnit: row.yieldUnit ?? undefined,
        moisturePct: row.moisturePct ?? undefined,
        notes: row.notes ?? undefined,
        syncStatus: "synced",
      });
      imported++;
    } catch (e) {
      errors.push(`${row.activityDate} — ${row.fieldName ?? row.fieldId}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  revalidatePath("/fields");
  revalidatePath("/home");
  return { imported, failed: errors.length, errors, skippedDuplicates };
}

export async function createReceiptAction(formData: FormData) {
  const farm = await getFarm();
  const fileName = str(formData, "fileName") ?? "receipt.jpg";
  const receipt = await repo.createReceipt({
    farmBusinessId: farm.id,
    fileName,
    captureSource: "web_upload",
    ocrStatus: "processed",
    ocrVendorGuess: str(formData, "vendorName"),
    ocrDateGuess: str(formData, "date"),
    ocrAmountGuess: num(formData, "amount"),
    syncStatus: "synced",
  });
  revalidatePath("/money/receipts");
  return receipt.id;
}

/**
 * Edit an already-confirmed receipt — vendor, date, amount, sales tax, and
 * category. Updates both the receipt's own record and its linked expense
 * transaction (if one exists) so the two stay consistent.
 */
export async function editReceiptAction(input: {
  receiptId: string;
  vendorName?: string;
  date: string;
  amount: number;
  salesTax?: number;
  farmCategoryId?: string;
}) {
  await repo.updateReceipt(input.receiptId, {
    ocrVendorGuess: input.vendorName,
    ocrDateGuess: input.date,
    ocrAmountGuess: input.amount,
    ocrTaxGuess: input.salesTax,
  });

  const transactions = await repo.listTransactions({});
  const txn = transactions.find((t) => t.receiptId === input.receiptId);
  if (txn) {
    await repo.updateTransaction(txn.id, {
      transactionDate: input.date,
      amount: input.amount,
      salesTax: input.salesTax,
      vendorName: input.vendorName,
      farmCategoryId: input.farmCategoryId,
      description: `Receipt — ${input.vendorName ?? "upload"}`,
    });
  }

  revalidatePath("/money/receipts");
  revalidatePath("/money/transactions");
  revalidatePath("/home");
  revalidatePath("/fields");
  return { ok: true, hasTransaction: Boolean(txn) };
}

/**
 * One-off repair for transactions created before the tax-year-by-date fix:
 * re-files every transaction under the year implied by its own date instead
 * of whatever the farm's "current" year happened to be at the time.
 */
export async function fixMisfiledTaxYearsAction() {
  const result = await repo.fixMisfiledTaxYears();
  revalidatePath("/home");
  revalidatePath("/money/transactions");
  revalidatePath("/reports");
  revalidatePath("/tax");
  revalidatePath("/cpa");
  revalidatePath("/fields");
  return result;
}

export async function confirmReceiptAction(formData: FormData) {
  const id = str(formData, "receiptId")!;
  await repo.confirmReceipt(id, {
    ocrVendorGuess: str(formData, "vendorName"),
    ocrDateGuess: str(formData, "date"),
    ocrAmountGuess: num(formData, "amount"),
    createTransaction: true,
    farmCategoryId: str(formData, "farmCategoryId"),
    fieldId: str(formData, "fieldId"),
  });
  revalidatePath("/money/receipts");
  revalidatePath("/money/transactions");
  revalidatePath("/home");
}

/**
 * Batch upload: create a receipt record from an OCR scan WITHOUT creating
 * a transaction. Used by the batch scanner so many receipts can be
 * uploaded and OCR'd at once, then each one still goes through the normal
 * human confirm step (/money/receipts/[id]/confirm) before it becomes a
 * real expense — same "never silently make permanent financial decisions"
 * rule as the single-receipt flow, just deferred until she reviews them.
 */
export async function createPendingReceiptAction(input: {
  fileName: string;
  captureSource?: "mobile_camera" | "web_upload" | "web_drag_drop";
  vendor?: string | null;
  date?: string | null;
  amount?: number | null;
  salesTax?: number | null;
  lineItems?: { description: string; amount: number; suggestedCategory?: string }[] | null;
  failed?: boolean;
}) {
  const farm = await getFarm();
  const receipt = await repo.createReceipt({
    farmBusinessId: farm.id,
    fileName: input.fileName,
    captureSource: input.captureSource ?? "web_upload",
    ocrStatus: input.failed ? "failed" : "processed",
    ocrVendorGuess: input.vendor ?? undefined,
    ocrDateGuess: input.date ?? undefined,
    ocrAmountGuess: input.amount ?? undefined,
    ocrTaxGuess: input.salesTax ?? undefined,
    ocrLineItems: input.lineItems ?? undefined,
    syncStatus: "synced",
  });
  revalidatePath("/money/receipts");
  return receipt.id;
}

export async function saveReceiptAndCreateExpenseAction(formData: FormData) {
  const farm = await getFarm();
  const receipt = await repo.createReceipt({
    farmBusinessId: farm.id,
    fileName: str(formData, "fileName") ?? "receipt.jpg",
    fileDataUrl: str(formData, "fileDataUrl"),
    captureSource: (str(formData, "captureSource") as any) ?? "web_upload",
    ocrStatus: "processed",
    ocrVendorGuess: str(formData, "vendorName"),
    ocrDateGuess: str(formData, "date"),
    ocrAmountGuess: num(formData, "amount"),
    ocrTaxGuess: num(formData, "salesTax"),
    syncStatus: "synced",
  });
  await repo.confirmReceipt(receipt.id, {
    ocrVendorGuess: str(formData, "vendorName"),
    ocrDateGuess: str(formData, "date"),
    ocrAmountGuess: num(formData, "amount"),
    ocrTaxGuess: num(formData, "salesTax"),
    createTransaction: true,
    farmCategoryId: str(formData, "farmCategoryId"),
    fieldId: str(formData, "fieldId"),
  });
  revalidatePath("/money/receipts");
  revalidatePath("/money/transactions");
  revalidatePath("/home");
}

export async function createJobAction(formData: FormData) {
  const farm = await getFarm();
  const customer = await repo.getCustomer(str(formData, "customerId")!);
  await repo.createJob({
    farmBusinessId: farm.id,
    customerId: str(formData, "customerId")!,
    customerName: customer?.name ?? "Customer",
    customerFieldId: str(formData, "customerFieldId"),
    jobService: str(formData, "jobService") ?? "Other",
    status: "scheduled",
    scheduledDate: str(formData, "scheduledDate"),
    acres: num(formData, "acres"),
    rate: num(formData, "rate"),
    rateUnit: (str(formData, "rateUnit") as any) ?? "per_acre",
    productSource: (str(formData, "productSource") as any) ?? "our_business",
    directCost: num(formData, "directCost") ?? 0,
    revenue: num(formData, "revenue") ?? 0,
    notes: str(formData, "notes"),
  });
  revalidatePath("/work/jobs");
}

export async function createInvoiceAction(formData: FormData) {
  const jobId = str(formData, "jobId")!;
  await repo.createInvoiceFromJob(jobId);
  revalidatePath("/work/invoices");
  revalidatePath("/work/jobs");
}

/** Manually create an invoice not tied to a job — e.g. custom billing, a one-off charge. */
export async function createManualInvoiceAction(formData: FormData) {
  const customerId = str(formData, "customerId")!;
  const dueDate = str(formData, "dueDate");
  const descriptions = formData.getAll("lineDescription") as string[];
  const quantities = formData.getAll("lineQuantity") as string[];
  const rates = formData.getAll("lineRate") as string[];
  const lines = descriptions
    .map((description, i) => ({
      description,
      quantity: Number(quantities[i]) || 1,
      unitRate: Number(rates[i]) || 0,
    }))
    .filter((l) => l.description.trim() !== "");

  await repo.createInvoice({ customerId, dueDate: dueDate ?? undefined, lines });
  revalidatePath("/work/invoices");
}

export async function createLoanAction(formData: FormData) {
  await repo.createLoan({
    lenderName: str(formData, "lenderName") ?? "Lender",
    originalPrincipal: num(formData, "originalPrincipal"),
    originationDate: str(formData, "originationDate"),
    interestRate: num(formData, "interestRate"),
    termMonths: num(formData, "termMonths"),
    currentBalance: num(formData, "currentBalance"),
    notes: str(formData, "notes"),
  });
  revalidatePath("/money/loans");
}

export async function recordPaymentAction(formData: FormData) {
  const farm = await getFarm();
  await repo.recordPayment({
    farmBusinessId: farm.id,
    invoiceId: str(formData, "invoiceId"),
    customerId: str(formData, "customerId")!,
    amount: num(formData, "amount") ?? 0,
    paymentDate: str(formData, "paymentDate") ?? new Date().toISOString().slice(0, 10),
    paymentMethod: str(formData, "paymentMethod"),
    notes: str(formData, "notes"),
  });
  revalidatePath("/work/invoices");
  revalidatePath("/money/transactions");
  revalidatePath("/home");
}

export async function createTaxQuestionAction(formData: FormData) {
  await repo.createTaxQuestion(str(formData, "question") ?? "", str(formData, "raisedByName") ?? "Farm Owner");
  revalidatePath("/tax");
}

export async function createAssetRepairAction(formData: FormData) {
  const { mutate } = await import("@/lib/data/store");
  const { randomUUID } = await import("node:crypto");
  mutate((db) => {
    db.assetRepairs.push({
      id: randomUUID(),
      assetId: str(formData, "assetId")!,
      repairDate: str(formData, "repairDate") ?? new Date().toISOString().slice(0, 10),
      description: str(formData, "description") ?? "",
      cost: num(formData, "cost"),
      odometerOrHours: num(formData, "odometerOrHours"),
    });
  });
  revalidatePath("/more/equipment");
}

export async function createLivestockTxnAction(formData: FormData) {
  const { mutate } = await import("@/lib/data/store");
  const { randomUUID } = await import("node:crypto");
  mutate((db) => {
    const groupId = str(formData, "livestockGroupId")!;
    const headCount = num(formData, "headCount") ?? 1;
    db.livestockTransactions.push({
      id: randomUUID(),
      livestockGroupId: groupId,
      txnType: (str(formData, "txnType") as any) ?? "sale",
      txnDate: str(formData, "txnDate") ?? new Date().toISOString().slice(0, 10),
      headCount,
      totalAmount: num(formData, "totalAmount"),
      weightLbs: num(formData, "weightLbs"),
      notes: str(formData, "notes"),
    });
    const group = db.livestockGroups.find((g) => g.id === groupId);
    if (group) {
      const txnType = str(formData, "txnType");
      if (txnType === "sale" || txnType === "death_loss" || txnType === "transfer_out") group.headCount = Math.max(0, group.headCount - headCount);
      if (txnType === "purchase" || txnType === "birth" || txnType === "transfer_in") group.headCount += headCount;
    }
  });
  revalidatePath("/more/livestock");
}

export async function createMileageTripAction(formData: FormData) {
  const { mutate } = await import("@/lib/data/store");
  const { randomUUID } = await import("node:crypto");
  const farm = await getFarm();
  mutate((db) => {
    const vehicle = db.assets.find((a) => a.id === str(formData, "vehicleAssetId"));
    db.mileageTrips.push({
      id: randomUUID(),
      farmBusinessId: farm.id,
      vehicleAssetId: str(formData, "vehicleAssetId")!,
      vehicleName: vehicle?.name ?? "Vehicle",
      tripDate: str(formData, "tripDate") ?? new Date().toISOString().slice(0, 10),
      miles: num(formData, "miles") ?? 0,
      purpose: str(formData, "purpose"),
      source: "manual",
    });
  });
  revalidatePath("/more/vehicles");
}

export async function answerTaxQuestionAction(formData: FormData) {
  const { mutate } = await import("@/lib/data/store");
  mutate((db) => {
    const q = db.taxQuestions.find((t) => t.id === str(formData, "questionId"));
    if (q) {
      q.cpaResponse = str(formData, "response");
      q.status = "answered";
    }
  });
  revalidatePath("/tax");
  revalidatePath("/cpa");
}

export async function toggleCpaReviewAction(formData: FormData) {
  const id = str(formData, "transactionId")!;
  const current = (await repo.listTransactions({})).find((t) => t.id === id);
  await repo.updateTransaction(id, { status: current?.status === "reconciled" ? "categorized" : "reconciled" });
  revalidatePath("/cpa");
  revalidatePath("/money/transactions");
}

export async function adjustInventoryAction(formData: FormData) {
  const { mutate } = await import("@/lib/data/store");
  const { randomUUID } = await import("node:crypto");
  mutate((db) => {
    const item = db.inventoryItems.find((i) => i.id === str(formData, "inventoryItemId"));
    if (!item) return;
    const qty = num(formData, "quantity") ?? 0;
    item.quantityOnHand += qty;
    db.inventoryMovements.push({
      id: randomUUID(),
      inventoryItemId: item.id,
      movementType: "adjustment",
      quantity: qty,
      note: str(formData, "note"),
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/more/inventory");
}

export async function bulkUpdateCategoryAction(formData: FormData) {
  const ids = formData.getAll("transactionIds").map(String);
  const farmCategoryId = str(formData, "farmCategoryId");
  for (const id of ids) {
    await repo.updateTransaction(id, { farmCategoryId });
  }
  revalidatePath("/money/transactions");
}

export async function bulkAssignFieldAction(formData: FormData) {
  const ids = formData.getAll("transactionIds").map(String);
  const fieldId = str(formData, "fieldId");
  for (const id of ids) {
    const txn = (await repo.listTransactions({})).find((t) => t.id === id);
    if (!txn) continue;
    await repo.updateTransaction(id, {
      splits: txn.splits.map((s) => ({ ...s, targetType: "field", fieldId })),
    } as any);
  }
  revalidatePath("/money/transactions");
}

export async function createDocumentAction(formData: FormData) {
  const farm = await getFarm();
  await repo.createDocument({
    farmBusinessId: farm.id,
    category: (str(formData, "category") as any) ?? "other",
    fileName: str(formData, "fileName") ?? "document.pdf",
    relatedFieldId: str(formData, "relatedFieldId"),
    tags: (str(formData, "tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
  });
  revalidatePath("/more/documents");
}

/**
 * Take a single total dollar amount (what you actually paid for a product —
 * fertilizer, seed, chemical — across the year) and split it across fields
 * proportionally to how much of that product each field's logged activities
 * (imported or hand-entered) actually used. This is how a lump-sum invoice
 * becomes real per-field cost without having to do the math by hand.
 */
export async function allocateProductCostAction(input: {
  year: number;
  productName: string;
  totalAmount: number;
  farmCategoryId: string;
  vendorName?: string;
  transactionDate?: string;
}) {
  const farm = await getFarm();
  const needle = input.productName.trim().toLowerCase();
  if (!needle) throw new Error("Enter a product name to allocate.");
  if (!(input.totalAmount > 0)) throw new Error("Enter the total amount you paid.");

  const activities = await repo.listActivities({ year: input.year });

  const usageByField = new Map<string, { fieldName: string; usage: number; unit?: string }>();
  let unmatchedUnits = false;

  function addUsage(fieldId: string | undefined, fieldName: string | undefined, amount: number, unit?: string) {
    if (!fieldId || !(amount > 0)) return;
    const existing = usageByField.get(fieldId);
    if (existing) {
      if (existing.unit && unit && existing.unit !== unit) unmatchedUnits = true;
      existing.usage += amount;
      existing.unit = existing.unit ?? unit;
    } else {
      usageByField.set(fieldId, { fieldName: fieldName ?? "Field", usage: amount, unit });
    }
  }

  for (const a of activities) {
    for (const p of a.sprayProducts ?? []) {
      if (p.productName.trim().toLowerCase() === needle) addUsage(a.fieldId, a.fieldName, p.quantityUsed, p.quantityUnit);
    }
    for (const p of a.fertilizerProducts ?? []) {
      if (p.productName.trim().toLowerCase() === needle) addUsage(a.fieldId, a.fieldName, p.quantityUsed, p.quantityUnit);
    }
    if (a.seedProductName && a.seedProductName.trim().toLowerCase() === needle) {
      addUsage(a.fieldId, a.fieldName, (a.seedingRate ?? 0) * (a.acres ?? 0), "units");
    }
  }

  const fieldsUsage = Array.from(usageByField.entries()).map(([fieldId, v]) => ({ fieldId, ...v }));
  const totalUsage = fieldsUsage.reduce((s, f) => s + f.usage, 0);

  if (fieldsUsage.length === 0 || totalUsage <= 0) {
    return {
      allocated: false as const,
      message: `No logged activity in ${input.year} used a product matching "${input.productName}". Check the spelling against what's on the field activity history, or log/import the activity first.`,
    };
  }

  const transactionDate = input.transactionDate || `${input.year}-12-31`;

  // Proportional split, with any rounding remainder folded into the
  // largest-usage field so the allocations add up to exactly what was paid.
  fieldsUsage.sort((a, b) => b.usage - a.usage);
  let allocatedSoFar = 0;
  const allocations: { fieldId: string; fieldName: string; usage: number; unit?: string; amount: number }[] = [];
  for (let i = 0; i < fieldsUsage.length; i++) {
    const f = fieldsUsage[i];
    const isLast = i === fieldsUsage.length - 1;
    const amount = isLast
      ? Math.round((input.totalAmount - allocatedSoFar) * 100) / 100
      : Math.round(input.totalAmount * (f.usage / totalUsage) * 100) / 100;
    allocatedSoFar += amount;
    allocations.push({ fieldId: f.fieldId, fieldName: f.fieldName, usage: f.usage, unit: f.unit, amount });
  }

  for (const a of allocations) {
    if (a.amount <= 0) continue;
    await repo.createTransaction({
      farmBusinessId: farm.id,
      taxYear: input.year,
      transactionType: "expense",
      status: "categorized",
      transactionDate,
      vendorName: input.vendorName,
      description: `${input.productName} — allocated by usage (${a.fieldName})`,
      amount: a.amount,
      farmCategoryId: input.farmCategoryId,
      isPersonalExcluded: false,
      cpaFlag: false,
      syncStatus: "synced",
      splits: [{
        targetType: "field", fieldId: a.fieldId, allocationMethod: "quantity",
        allocatedAmount: a.amount, farmCategoryId: input.farmCategoryId,
        notes: a.unit ? `${a.usage} ${a.unit} used` : undefined,
      }],
    });
  }

  revalidatePath("/fields");
  revalidatePath("/money/transactions");
  revalidatePath("/home");

  return {
    allocated: true as const,
    productName: input.productName,
    totalAmount: input.totalAmount,
    year: input.year,
    unmatchedUnits,
    allocations,
  };
}
