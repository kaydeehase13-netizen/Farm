"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as repo from "@/lib/data/repo";
import { getFarm } from "@/lib/data/repo";
import { scanReceiptImage } from "@/lib/receipt-ocr";

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
  const description = str(formData, "description");
  const salesTax = num(formData, "salesTax") ?? 0;

  // A single receipt/check can cover more than one category, and not
  // always the same transaction type — e.g. oil and mineral royalties paid
  // on the same check (both income), or a royalty check that nets gross
  // income minus a deducted expense (one income line, one expense line).
  // Those need to be booked as separate line items, each with its own
  // type, so they land under the right tax category instead of being
  // blended into one. When the form's "split into multiple categories"
  // toggle was used, splitLines carries the breakdown as JSON; create one
  // transaction per line instead of one for the whole amount.
  const rawSplitLines = str(formData, "splitLines");
  const splitLines = rawSplitLines
    ? (JSON.parse(rawSplitLines) as { type?: string; farmCategoryId: string; amount: string }[])
        .map((l) => ({
          type: (l.type === "income" || l.type === "expense" ? l.type : type) as "income" | "expense",
          farmCategoryId: l.farmCategoryId, amount: Number(l.amount) || 0,
        }))
        .filter((l) => l.farmCategoryId && l.amount > 0)
    : [];

  if (splitLines.length >= 2) {
    const farmCategories = await repo.listFarmCategories();
    const nameById = new Map(farmCategories.map((c) => [c.id, c.name]));
    // Every line from this split shares one id so exports and reports can
    // always trace them back to "these N transactions were one original
    // total" — see splitGroupId on the Transaction type.
    const splitGroupId = randomUUID();
    // Sales tax on the original receipt/check isn't broken out per line —
    // put the whole amount on the first expense-type line rather than
    // guessing a split, so it doesn't get silently dropped or doubled.
    const firstExpenseIdx = splitLines.findIndex((l) => l.type === "expense");
    for (const [i, line] of splitLines.entries()) {
      await repo.createTransaction({
        farmBusinessId: farm.id,
        taxYear,
        transactionType: line.type,
        status: "categorized",
        transactionDate,
        vendorName: str(formData, "vendorName"),
        customerId: str(formData, "customerId"),
        description: `${description ?? ""} — ${nameById.get(line.farmCategoryId) ?? "Split"}`.trim(),
        amount: line.amount,
        salesTax: i === firstExpenseIdx ? salesTax : 0,
        paymentMethod: str(formData, "paymentMethod"),
        farmCategoryId: line.farmCategoryId,
        splitGroupId,
        isPersonalExcluded: str(formData, "isPersonalExcluded") === "on",
        cpaFlag: false,
        syncStatus: "synced",
        splits: [{
          targetType: fieldId ? "field" : jobId ? "customer_job" : "general_overhead",
          fieldId, jobId,
          allocationMethod: "manual",
          allocatedAmount: line.amount,
          farmCategoryId: line.farmCategoryId,
        }],
      });
    }
    revalidatePath("/money/transactions");
    revalidatePath("/home");
    return;
  }

  const farmCategoryId = str(formData, "farmCategoryId");
  const productName = str(formData, "productName");

  await repo.createTransaction({
    farmBusinessId: farm.id,
    taxYear,
    transactionType: type,
    status: "categorized",
    transactionDate,
    vendorName: str(formData, "vendorName"),
    customerId: str(formData, "customerId"),
    description,
    amount,
    salesTax,
    paymentMethod: str(formData, "paymentMethod"),
    farmCategoryId,
    productName,
    isPersonalExcluded: str(formData, "isPersonalExcluded") === "on",
    cpaFlag: false,
    syncStatus: "synced",
    splits: [{
      targetType: fieldId ? "field" : jobId ? "customer_job" : "general_overhead",
      fieldId, jobId,
      allocationMethod: "manual",
      allocatedAmount: amount,
      farmCategoryId,
    }],
  });

  if (fieldId && productName) {
    await tagFieldActivityFromProduct({ fieldId, farmCategoryId, productName, activityDate: transactionDate });
  }

  revalidatePath("/money/transactions");
  revalidatePath("/home");
}

/**
 * "Enter a seed variety or chemical on the expense and have it show up on
 * the field without re-typing it" — when a Seed/Chemical/Fertilizer expense
 * names a field and a product, this creates the matching field activity
 * (plant/spray/fertilize) tagged with that product, so it's already there
 * in the field's activity history and Spray/Crop records instead of having
 * to be logged separately. Matched by the farm category's NAME (the
 * default categories are literally named "Seed", "Chemical", "Fertilizer")
 * rather than a hard schema link, so it also works for any custom category
 * containing one of those words.
 *
 * Chemical and Fertilizer application records require a real rate and
 * quantity in the schema (for compliance/records purposes), which a
 * financial transaction doesn't have — rather than writing in a fake 0/0,
 * this puts the product name in the new activity's notes so it's visible on
 * the field right away; the rate/EPA# detail can be filled in later by
 * editing that activity if full structured Spray Records detail is wanted.
 * Seed doesn't have that constraint, so seed variety is set as real
 * structured data (seedProductName) immediately.
 */
async function tagFieldActivityFromProduct(opts: {
  fieldId: string; farmCategoryId?: string; productName: string; activityDate: string;
}) {
  if (!opts.farmCategoryId) return;
  const farmCategories = await repo.listFarmCategories();
  const category = farmCategories.find((c) => c.id === opts.farmCategoryId);
  const name = (category?.name ?? "").toLowerCase();
  try {
    if (name.includes("seed")) {
      await repo.createActivity({
        farmBusinessId: (await getFarm()).id, activityType: "plant", fieldId: opts.fieldId,
        activityDate: opts.activityDate, seedProductName: opts.productName, syncStatus: "synced",
      });
    } else if (name.includes("chemical")) {
      await repo.createActivity({
        farmBusinessId: (await getFarm()).id, activityType: "spray", fieldId: opts.fieldId,
        activityDate: opts.activityDate,
        notes: `Product: ${opts.productName} (from expense entry — add rate/EPA# here for full Spray Records)`,
        syncStatus: "synced",
      });
    } else if (name.includes("fertilizer")) {
      await repo.createActivity({
        farmBusinessId: (await getFarm()).id, activityType: "fertilize", fieldId: opts.fieldId,
        activityDate: opts.activityDate,
        notes: `Product: ${opts.productName} (from expense entry — add rate here for full fertilizer records)`,
        syncStatus: "synced",
      });
    }
  } catch {
    // Never let the activity-tagging side-effect fail the transaction save
    // itself — the money side is already recorded either way.
  }
  revalidatePath("/fields");
}

/**
 * Splits an ALREADY-SAVED transaction into multiple category/type line
 * items — the "back check what's already uploaded" counterpart to the
 * split option on the new-transaction form. The original transaction is
 * turned into the first line (so it keeps its id, receipt link, and
 * created-at date) and the rest are created as new transactions dated and
 * vendored the same as the original.
 */
export async function splitTransactionAction(transactionId: string, formData: FormData) {
  const original = await repo.getTransaction(transactionId);
  if (!original) throw new Error("That transaction couldn't be found — it may have already been deleted.");

  const rawSplitLines = str(formData, "splitLines");
  const parsed = (rawSplitLines ? JSON.parse(rawSplitLines) : []) as { type?: string; farmCategoryId: string; amount: string }[];
  const lines = parsed
    .map((l) => ({
      type: (l.type === "income" || l.type === "expense" ? l.type : original.transactionType) as "income" | "expense",
      farmCategoryId: l.farmCategoryId, amount: Number(l.amount) || 0,
    }))
    .filter((l) => l.farmCategoryId && l.amount > 0);

  if (lines.length < 2) throw new Error("Add at least two category lines that each have an amount before splitting.");

  const farmCategories = await repo.listFarmCategories();
  const nameById = new Map(farmCategories.map((c) => [c.id, c.name]));
  const baseDescription = (original.description ?? "").replace(/ — .+$/, ""); // strip a prior split suffix if re-splitting
  const lineLabel = (farmCategoryId: string) => `${baseDescription} — ${nameById.get(farmCategoryId) ?? "Split"}`.trim();
  // Reuse the existing group id if this transaction was already part of a
  // split (re-splitting one of its lines further) so every line, old and
  // new, still traces back to the same original total. Otherwise start a
  // fresh group.
  const splitGroupId = original.splitGroupId ?? randomUUID();

  const [first, ...rest] = lines;
  await repo.updateTransaction(transactionId, {
    transactionType: first.type,
    farmCategoryId: first.farmCategoryId,
    amount: first.amount,
    description: lineLabel(first.farmCategoryId),
    splitGroupId,
  });

  const originalSplit = original.splits[0];
  for (const line of rest) {
    await repo.createTransaction({
      farmBusinessId: original.farmBusinessId,
      taxYear: original.taxYear,
      transactionType: line.type,
      status: "categorized",
      transactionDate: original.transactionDate,
      vendorName: original.vendorName,
      customerId: original.customerId,
      description: lineLabel(line.farmCategoryId),
      amount: line.amount,
      salesTax: 0,
      paymentMethod: original.paymentMethod,
      farmCategoryId: line.farmCategoryId,
      splitGroupId,
      isPersonalExcluded: original.isPersonalExcluded,
      cpaFlag: false,
      syncStatus: "synced",
      splits: [{
        targetType: originalSplit?.targetType ?? "general_overhead",
        fieldId: originalSplit?.fieldId,
        jobId: originalSplit?.jobId,
        allocationMethod: "manual",
        allocatedAmount: line.amount,
        farmCategoryId: line.farmCategoryId,
      }],
    });
  }

  revalidatePath("/money/transactions");
  revalidatePath("/money/transactions/category-audit");
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
  let repaired = 0;
  let skippedDuplicates = 0;
  const errors: string[] = [];

  // Guard against re-importing the same CSV (or a file with repeated rows).
  // The match key is deliberately just date+type+acres+yield — NOT product
  // name — because an earlier bug could create an activity but silently
  // fail to attach its spray/fertilizer/seed product, leaving that
  // activity's stored product name blank. If product name were part of the
  // match key, a row whose real product is "32/thio" would never match its
  // own broken (blank-product) activity, and re-running the import would
  // create a brand-new duplicate activity instead of repairing the
  // existing one — doubling up the field's activity history. So: match on
  // the core fields first, then decide by product name whether it's a
  // true duplicate (skip), a broken one to backfill (repair), or a
  // genuinely different activity that happens to share date/type/acres
  // (create new, e.g. two different products applied the same day at the
  // same acreage).
  type Seen = { activityId: string; hasProductInfo: boolean; productName: string; claimed: boolean };
  const existingByField = new Map<string, Map<string, Seen[]>>();
  function coreSignature(row: { activityDate: string; activityType: string; acres?: number | null; yieldAmount?: number | null }) {
    const acres = row.acres != null ? Math.round(row.acres * 1000) / 1000 : "";
    const yieldAmount = row.yieldAmount != null ? Math.round(row.yieldAmount * 1000) / 1000 : "";
    return [row.activityDate, row.activityType, acres, yieldAmount].join("|");
  }
  async function seenForField(fieldId: string) {
    let map = existingByField.get(fieldId);
    if (!map) {
      const existing = await repo.listActivities({ fieldId });
      map = new Map<string, Seen[]>();
      for (const a of existing) {
        const key = coreSignature({ activityDate: a.activityDate, activityType: a.activityType, acres: a.acres ?? null, yieldAmount: a.yieldAmount ?? null });
        const entry: Seen = {
          activityId: a.id,
          hasProductInfo: Boolean(a.sprayProducts?.length || a.fertilizerProducts?.length || a.seedProductName),
          productName: (a.sprayProducts?.[0]?.productName ?? a.seedProductName ?? "").trim().toLowerCase(),
          claimed: false,
        };
        const list = map.get(key);
        if (list) list.push(entry); else map.set(key, [entry]);
      }
      existingByField.set(fieldId, map);
    }
    return map;
  }

  for (const row of rows) {
    try {
      const seen = await seenForField(row.fieldId);
      const key = coreSignature(row);
      const candidates = seen.get(key) ?? [];
      const rowProduct = (row.productName ?? "").trim().toLowerCase();
      const exactDuplicate = candidates.find((c) => c.hasProductInfo && c.productName === rowProduct);
      const brokenCandidate = !exactDuplicate ? candidates.find((c) => !c.hasProductInfo && !c.claimed) : undefined;
      const isSpray = row.activityType === "spray" || row.activityType === "fertilize";

      if (exactDuplicate) {
        skippedDuplicates++;
        continue;
      }
      if (brokenCandidate && row.productName) {
        await repo.repairActivityProductDetails(brokenCandidate.activityId, {
          sprayProducts: isSpray ? [{
            productId: "prod-imported", productName: row.productName,
            rate: row.rate ?? 0, rateUnit: row.rateUnit ?? "", quantityUsed: row.quantity ?? 0, quantityUnit: row.quantityUnit ?? "",
          }] : undefined,
          seedProductName: row.activityType === "plant" ? row.productName : undefined,
          seedingRate: row.activityType === "plant" ? (row.rate ?? undefined) : undefined,
        });
        brokenCandidate.hasProductInfo = true;
        brokenCandidate.productName = rowProduct;
        brokenCandidate.claimed = true;
        repaired++;
        continue;
      }
      const created = await repo.createActivity({
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
      const newEntry: Seen = { activityId: created.id, hasProductInfo: Boolean(row.productName), productName: rowProduct, claimed: true };
      if (candidates.length) candidates.push(newEntry); else seen.set(key, [newEntry]);
      imported++;
    } catch (e) {
      errors.push(`${row.activityDate} — ${row.fieldName ?? row.fieldId}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  revalidatePath("/fields");
  revalidatePath("/fields/allocate-cost");
  revalidatePath("/home");
  return { imported, repaired, failed: errors.length, errors, skippedDuplicates };
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

/**
 * One-off repair: no insert path used to write tax_category_id at all, only
 * farm_category_id — every transaction's actual tax-schedule placement has
 * silently been missing since day one. This fills it in from each
 * transaction's own farm category's default tax category. Safe to run any
 * time, and safe to run more than once.
 */
export async function backfillTaxCategoriesAction() {
  const result = await repo.backfillTaxCategories();
  revalidatePath("/home");
  revalidatePath("/money/transactions");
  revalidatePath("/reports");
  revalidatePath("/tax");
  revalidatePath("/cpa");
  revalidatePath("/fields");
  return result;
}

export interface ReceiptRescanFlag {
  receiptId: string;
  fileName: string;
  vendorName?: string;
  transactionDate?: string;
  linkedTransactionId?: string;
  categoryBreakdown: { category: string; amount: number }[];
}

/**
 * "Review the ones already uploaded" — re-runs the same line-item OCR
 * analysis used on new receipts against a batch of already-saved receipt
 * photos, and flags any that look like they cover more than one category
 * (mirrors the live-scan "multipleCategories" check in receipt-ocr.ts).
 * Nothing is changed automatically — this only surfaces candidates; splitting
 * a flagged one still goes through the normal Split page so a human always
 * confirms it, per "never silently make permanent AI financial decisions."
 *
 * Capped to MAX_PER_RUN per call to stay inside a serverless timeout and
 * bound the OpenAI cost of one click — call it again (it's safe to re-run)
 * to work through the rest; "cursor" lets a client page through the list.
 */
export async function rescanReceiptsForSplitsAction(cursor = 0): Promise<{
  scanned: number;
  flagged: ReceiptRescanFlag[];
  nextCursor: number | null;
  totalCandidates: number;
}> {
  // Kept small and run IN PARALLEL on purpose: this runs as a Netlify
  // function behind the same request/response timeout as any other server
  // action (10-26s depending on plan). Scanning receipts one at a time
  // through OpenAI vision easily blew past that on a batch of 15, which is
  // what caused "An unexpected response was received from the server" —
  // the function got killed mid-request and the client got back a
  // truncated response instead of the action's real result. Running a
  // small batch concurrently, each with its own hard timeout, keeps total
  // wall-clock close to the SLOWEST single scan instead of the sum of all
  // of them.
  const MAX_PER_RUN = 4;
  const PER_SCAN_TIMEOUT_MS = 20_000;
  const receipts = await repo.listReceipts();
  const candidates = receipts;
  const batch = candidates.slice(cursor, cursor + MAX_PER_RUN);

  const results = await Promise.all(
    batch.map(async (r) => {
      try {
        const full = await repo.getReceipt(r.id);
        if (!full?.fileDataUrl) return null;
        const match = /^data:(.*?);base64,([\s\S]*)$/.exec(full.fileDataUrl);
        const mimeType = match?.[1] ?? "image/jpeg";
        const base64 = match?.[2] ?? full.fileDataUrl;
        const result = await Promise.race([
          scanReceiptImage(base64, mimeType),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), PER_SCAN_TIMEOUT_MS)),
        ]);
        if (!result) return { scanned: true as const, flag: null };
        if (result.multipleCategories && result.categoryBreakdown.length >= 2) {
          return {
            scanned: true as const,
            flag: {
              receiptId: r.id,
              fileName: r.fileName,
              vendorName: full.ocrVendorGuess,
              transactionDate: full.ocrDateGuess,
              linkedTransactionId: r.linkedTransactionId,
              categoryBreakdown: result.categoryBreakdown,
            } satisfies ReceiptRescanFlag,
          };
        }
        return { scanned: true as const, flag: null };
      } catch {
        // One bad receipt (unreadable image, a hiccup mid-request) should
        // never take the rest of the batch down with it.
        return null;
      }
    })
  );

  const scanned = results.filter((r) => r?.scanned).length;
  const flagged: ReceiptRescanFlag[] = [];
  for (const r of results) {
    if (r?.flag) flagged.push(r.flag);
  }

  const nextCursor = cursor + MAX_PER_RUN < candidates.length ? cursor + MAX_PER_RUN : null;
  return { scanned, flagged, nextCursor, totalCandidates: candidates.length };
}

/**
 * Runs the tax-opportunity scanner against one tax year's real data
 * (equipment purchases/sales, breeding-livestock sales, prepaid supplies,
 * conservation/government-payment/crop-insurance categorized transactions,
 * disaster/casualty keyword matches) and flags any new matches for review.
 * Never asserts a tax treatment — purely "this might be worth asking your
 * CPA about." Safe to re-run; it skips anything already flagged.
 */
export async function scanTaxOpportunitiesAction(taxYear: number) {
  const result = await repo.scanTaxOpportunities(taxYear);
  revalidatePath("/tax");
  revalidatePath("/cpa");
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
  fileDataUrl?: string | null;
}) {
  const farm = await getFarm();
  const receipt = await repo.createReceipt({
    farmBusinessId: farm.id,
    fileName: input.fileName,
    fileDataUrl: input.fileDataUrl ?? undefined,
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
  const vendorName = str(formData, "vendorName");
  const date = str(formData, "date");
  const amount = num(formData, "amount");
  const salesTax = num(formData, "salesTax");
  const farmCategoryId = str(formData, "farmCategoryId");
  const fieldId = str(formData, "fieldId");

  // A receipt that covers more than one category (or both income and
  // expense) gets split into multiple separate transactions instead of one
  // whole-amount transaction, so each is independently reportable. The
  // receipt-scanner UI sends this as a JSON "splitLines" field whenever the
  // user split the receipt (either from the OCR line-item hint or manually).
  const rawSplitLines = str(formData, "splitLines");
  const parsedSplitLines = (rawSplitLines ? JSON.parse(rawSplitLines) : []) as {
    type?: string;
    farmCategoryId: string;
    amount: string | number;
  }[];
  const splitLines = parsedSplitLines
    .map((l) => ({
      type: (l.type === "income" || l.type === "expense" ? l.type : "expense") as "income" | "expense",
      farmCategoryId: l.farmCategoryId,
      amount: Number(l.amount) || 0,
    }))
    .filter((l) => l.farmCategoryId && l.amount > 0);

  if (splitLines.length >= 2) {
    await repo.createReceiptAndSplitExpenses({
      fileName: str(formData, "fileName") ?? "receipt.jpg",
      fileDataUrl: str(formData, "fileDataUrl"),
      captureSource: (str(formData, "captureSource") as any) ?? "web_upload",
      vendorName,
      transactionDate: date ?? new Date().toISOString().slice(0, 10),
      salesTax: salesTax ?? 0,
      fieldId,
      lines: splitLines,
    });
  } else {
    // One call — the receipt insert, transaction insert, split insert, and the
    // tax-year/vendor lookups all happen in a single Postgres round trip (see
    // create_receipt_and_expense() / repo.createReceiptAndExpense) instead of
    // 4+ sequential ones, which was the biggest chunk of "saving takes forever."
    await repo.createReceiptAndExpense({
      fileName: str(formData, "fileName") ?? "receipt.jpg",
      fileDataUrl: str(formData, "fileDataUrl"),
      captureSource: (str(formData, "captureSource") as any) ?? "web_upload",
      vendorName,
      transactionDate: date ?? new Date().toISOString().slice(0, 10),
      amount: amount ?? 0,
      salesTax: salesTax ?? 0,
      farmCategoryId,
      fieldId,
    });
  }
  revalidatePath("/money/receipts");
  revalidatePath("/money/transactions");
  revalidatePath("/money/transactions/category-audit");
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

export async function createAssetAction(formData: FormData) {
  await repo.createAsset({
    assetType: (str(formData, "assetType") as import("@/types/domain").AssetType) ?? "equipment",
    name: str(formData, "name") ?? "Untitled equipment",
    make: str(formData, "make"),
    model: str(formData, "model"),
    year: num(formData, "year"),
    purchaseDate: str(formData, "purchaseDate"),
    purchasePrice: num(formData, "purchasePrice"),
    placedInServiceDate: str(formData, "placedInServiceDate") || str(formData, "purchaseDate"),
    businessUsePercent: num(formData, "businessUsePercent") ?? 100,
    usefulLifeYears: num(formData, "usefulLifeYears"),
    salvageValue: num(formData, "salvageValue") ?? 0,
    notes: str(formData, "notes"),
  });
  revalidatePath("/more/equipment");
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

/** Recategorize a single transaction (used by the per-row category picker). */
export async function recategorizeTransactionAction(transactionId: string, farmCategoryId: string) {
  await repo.updateTransaction(transactionId, { farmCategoryId, status: "categorized" });
  revalidatePath("/money/transactions");
  revalidatePath("/home");
  revalidatePath("/tax");
  revalidatePath("/reports");
}

/** Edit a single transaction's date (used by the per-row date picker). Re-files it under the correct tax year if the date's year changes. */
export async function updateTransactionDateAction(transactionId: string, transactionDate: string) {
  await repo.updateTransaction(transactionId, { transactionDate });
  revalidatePath("/money/transactions");
  revalidatePath("/home");
  revalidatePath("/tax");
  revalidatePath("/reports");
  revalidatePath("/fields");
}

/**
 * "Omit" = mark a transaction as personal / not a farm expense, excluding it
 * from income, expense, and tax-readiness totals without deleting it — the
 * record stays for reference, it just stops counting. Un-omitting puts it
 * back to "needs review" so it gets a real category again.
 */
export async function setTransactionOmittedAction(transactionId: string, omitted: boolean) {
  await repo.updateTransaction(transactionId, {
    isPersonalExcluded: omitted,
    status: omitted ? "excluded_personal" : "needs_review",
  });
  revalidatePath("/money/transactions");
  revalidatePath("/home");
  revalidatePath("/tax");
  revalidatePath("/reports");
  revalidatePath("/fields");
}

/** Permanently deletes a transaction. Use setTransactionOmittedAction to keep the record but exclude it instead. */
export async function deleteTransactionAction(transactionId: string) {
  await repo.deleteTransaction(transactionId);
  revalidatePath("/money/transactions");
  revalidatePath("/home");
  revalidatePath("/tax");
  revalidatePath("/reports");
  revalidatePath("/fields");
}

/** Deletes a receipt. Any transaction it was linked to stays — it just loses its "documentation on file" flag. */
export async function deleteReceiptAction(receiptId: string) {
  await repo.deleteReceipt(receiptId);
  revalidatePath("/money/receipts");
  revalidatePath("/money/transactions");
  revalidatePath("/home");
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

// -----------------------------------------------------------------------
// Excel bulk import — one .xlsx download+upload flow each for allocating
// product costs across fields, income, and expenses (the "receipts"
// import: for expenses you want logged fast without a photo).
// -----------------------------------------------------------------------

export interface BulkImportRowResult { row: number; ok: boolean; message: string; }
export interface BulkImportSummary { total: number; imported: number; failed: number; results: BulkImportRowResult[]; }

async function matchCategoryId(name: string | undefined, categories: { id: string; name: string }[]): Promise<string | undefined> {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  const exact = categories.find((c) => c.name.trim().toLowerCase() === needle);
  return exact?.id;
}

export async function bulkImportAllocateCostAction(formData: FormData): Promise<BulkImportSummary> {
  const { parseXlsxRows, toIsoDate, toNumber, toText } = await import("@/lib/xlsx-import");
  const file = formData.get("file");
  const farm = await getFarm();
  const categories = await repo.listFarmCategories();
  if (!(file instanceof File)) return { total: 0, imported: 0, failed: 0, results: [{ row: 0, ok: false, message: "No file uploaded." }] };

  const rows = await parseXlsxRows(await file.arrayBuffer());
  const results: BulkImportRowResult[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // account for header row
    const productName = toText(r["Product Name"]);
    const totalAmount = toNumber(r["Total Amount"]);
    if (!productName || !totalAmount) { results.push({ row: rowNum, ok: false, message: "Skipped — missing Product Name or Total Amount." }); continue; }
    const year = toNumber(r["Year"]) ?? farm.currentTaxYear;
    const farmCategoryId = await matchCategoryId(toText(r["Category"]), categories);
    if (toText(r["Category"]) && !farmCategoryId) { results.push({ row: rowNum, ok: false, message: `Category "${r["Category"]}" doesn't match any category name.` }); continue; }
    if (!farmCategoryId) { results.push({ row: rowNum, ok: false, message: "Skipped — missing Category." }); continue; }

    try {
      const outcome = await allocateProductCostAction({
        year, productName, totalAmount, farmCategoryId,
        vendorName: toText(r["Vendor (optional)"]) ?? toText(r["Vendor"]),
        transactionDate: toIsoDate(r["Date (optional, YYYY-MM-DD)"]) ?? toIsoDate(r["Date"]),
      });
      if (outcome.allocated) { imported++; results.push({ row: rowNum, ok: true, message: `Allocated ${outcome.allocations.length} field(s).` }); }
      else results.push({ row: rowNum, ok: false, message: outcome.message });
    } catch (e: any) {
      results.push({ row: rowNum, ok: false, message: e?.message ?? "Failed to allocate." });
    }
  }

  return { total: rows.length, imported, failed: rows.length - imported, results };
}

async function bulkImportTransactions(formData: FormData, transactionType: "income" | "expense"): Promise<BulkImportSummary> {
  const { parseXlsxRows, toIsoDate, toNumber, toText } = await import("@/lib/xlsx-import");
  const file = formData.get("file");
  if (!(file instanceof File)) return { total: 0, imported: 0, failed: 0, results: [{ row: 0, ok: false, message: "No file uploaded." }] };

  const farm = await getFarm();
  const categories = await repo.listFarmCategories();
  const rows = await parseXlsxRows(await file.arrayBuffer());
  const results: BulkImportRowResult[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const transactionDate = toIsoDate(r["Date (YYYY-MM-DD)"]) ?? toIsoDate(r["Date"]);
    const amount = toNumber(r["Amount"]);
    if (!transactionDate || !amount) { results.push({ row: rowNum, ok: false, message: "Skipped — missing Date or Amount." }); continue; }

    const categoryName = toText(r["Category"]);
    const farmCategoryId = await matchCategoryId(categoryName, categories);
    const categoryWarning = categoryName && !farmCategoryId ? ` (Category "${categoryName}" didn't match — imported as Uncategorized.)` : "";

    const description = toText(r["Description"]) ?? (transactionType === "income" ? toText(r["Customer (optional)"]) : undefined) ?? (transactionType === "income" ? "Income" : "Expense");
    const vendorName = transactionType === "expense" ? toText(r["Vendor"]) : undefined;
    const taxYear = Number(transactionDate.slice(0, 4)) || farm.currentTaxYear;

    try {
      await repo.createTransaction({
        farmBusinessId: farm.id,
        taxYear,
        transactionType,
        status: farmCategoryId ? "categorized" : "needs_review",
        transactionDate,
        vendorName,
        description: transactionType === "income" && toText(r["Customer (optional)"]) ? `${description} — ${r["Customer (optional)"]}` : description,
        amount,
        farmCategoryId,
        isPersonalExcluded: false,
        cpaFlag: false,
        syncStatus: "synced",
        splits: [{ targetType: "general_overhead", allocationMethod: "manual", allocatedAmount: amount, farmCategoryId }],
      });
      imported++;
      results.push({ row: rowNum, ok: true, message: `Imported.${categoryWarning}` });
    } catch (e: any) {
      results.push({ row: rowNum, ok: false, message: e?.message ?? "Failed to import." });
    }
  }

  revalidatePath("/money/transactions");
  revalidatePath("/home");
  return { total: rows.length, imported, failed: rows.length - imported, results };
}

export async function bulkImportIncomeAction(formData: FormData): Promise<BulkImportSummary> {
  return bulkImportTransactions(formData, "income");
}

export async function bulkImportExpenseAction(formData: FormData): Promise<BulkImportSummary> {
  return bulkImportTransactions(formData, "expense");
}
