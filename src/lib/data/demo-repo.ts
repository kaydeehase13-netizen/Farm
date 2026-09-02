import { randomUUID } from "node:crypto";
import { getDB, mutate } from "./store";
import { FARM } from "./seed";
import type {
  Transaction, TransactionSplit, FieldProfitability, Job, Invoice, Payment,
  Activity, Receipt, DocumentRecord,
} from "@/types/domain";

// -----------------------------------------------------------------------
// Repository: the single place UI/API code reads and writes farm data.
// Backed today by the JSON demo store (src/lib/data/store.ts); swap the
// implementation for Supabase queries (src/lib/supabase/repo.ts) without
// touching callers once a live project is connected.
// -----------------------------------------------------------------------

export function getFarm() {
  return FARM;
}

export function listFields() {
  return getDB().fields;
}

export function getField(fieldId: string) {
  return getDB().fields.find((f) => f.id === fieldId) ?? null;
}

export function createField(input: Omit<import("@/types/domain").Field, "id" | "farmBusinessId">) {
  return mutate((db) => {
    const field: import("@/types/domain").Field = { ...input, id: randomUUID(), farmBusinessId: FARM.id };
    db.fields.push(field);
    return field;
  });
}

export function listCropYears(fieldId?: string) {
  const db = getDB();
  return fieldId ? db.cropYears.filter((c) => c.fieldId === fieldId) : db.cropYears;
}

export function listTransactions(filters: {
  taxYear?: number; type?: string; status?: string; fieldId?: string;
  customerId?: string; vendorId?: string; search?: string;
} = {}) {
  let rows = getDB().transactions;
  if (filters.taxYear) rows = rows.filter((t) => t.taxYear === filters.taxYear);
  if (filters.type) rows = rows.filter((t) => t.transactionType === filters.type);
  if (filters.status) rows = rows.filter((t) => t.status === filters.status);
  if (filters.customerId) rows = rows.filter((t) => t.customerId === filters.customerId);
  if (filters.vendorId) rows = rows.filter((t) => t.vendorId === filters.vendorId);
  if (filters.fieldId) rows = rows.filter((t) => t.splits.some((s) => s.fieldId === filters.fieldId));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((t) =>
      (t.description ?? "").toLowerCase().includes(q) ||
      (t.vendorName ?? "").toLowerCase().includes(q)
    );
  }
  return [...rows].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export function createTransaction(input: Omit<Transaction, "id" | "createdAt" | "splits"> & { splits?: Omit<TransactionSplit, "id" | "transactionId">[] }) {
  return mutate((db) => {
    const id = randomUUID();
    const splits: TransactionSplit[] = (input.splits ?? [{
      targetType: "general_overhead" as const,
      allocationMethod: "manual" as const,
      allocatedAmount: input.amount,
      farmCategoryId: input.farmCategoryId,
    }]).map((s) => ({ ...s, id: randomUUID(), transactionId: id }));
    const txn: Transaction = { ...input, id, createdAt: new Date().toISOString(), splits };
    db.transactions.push(txn);
    return txn;
  });
}

export function updateTransaction(id: string, patch: Partial<Transaction>) {
  return mutate((db) => {
    const idx = db.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.transactions[idx] = { ...db.transactions[idx], ...patch };
    return db.transactions[idx];
  });
}

export function listReceipts() {
  return [...getDB().receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createReceipt(input: Omit<Receipt, "id" | "createdAt">) {
  return mutate((db) => {
    const receipt: Receipt = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    db.receipts.push(receipt);
    return receipt;
  });
}

export function confirmReceipt(id: string, patch: Partial<Receipt> & { createTransaction?: boolean; farmCategoryId?: string; fieldId?: string }) {
  return mutate((db) => {
    const idx = db.receipts.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const receipt = { ...db.receipts[idx], ...patch, ocrStatus: "confirmed" as const, confirmedAt: new Date().toISOString() };
    db.receipts[idx] = receipt;

    if (patch.createTransaction) {
      const txnId = randomUUID();
      const amount = receipt.ocrAmountGuess ?? 0;
      const txn: Transaction = {
        id: txnId,
        farmBusinessId: FARM.id,
        taxYear: FARM.currentTaxYear,
        transactionType: "expense",
        status: "categorized",
        transactionDate: receipt.ocrDateGuess ?? new Date().toISOString().slice(0, 10),
        vendorName: receipt.ocrVendorGuess,
        description: `Receipt — ${receipt.ocrVendorGuess ?? receipt.fileName}`,
        amount,
        salesTax: receipt.ocrTaxGuess ?? 0,
        farmCategoryId: patch.farmCategoryId,
        isPersonalExcluded: false,
        cpaFlag: false,
        receiptId: receipt.id,
        syncStatus: "synced",
        createdAt: new Date().toISOString(),
        splits: [{
          id: randomUUID(), transactionId: txnId,
          targetType: patch.fieldId ? "field" : "general_overhead",
          fieldId: patch.fieldId,
          allocationMethod: "manual",
          allocatedAmount: amount,
          farmCategoryId: patch.farmCategoryId,
        }],
      };
      db.transactions.push(txn);
      receipt.linkedTransactionId = txnId;
      db.receipts[idx] = receipt;
    }
    return receipt;
  });
}

export function listActivities(filters: { fieldId?: string; activityType?: string; customerId?: string } = {}) {
  let rows = getDB().activities;
  if (filters.fieldId) rows = rows.filter((a) => a.fieldId === filters.fieldId);
  if (filters.activityType) rows = rows.filter((a) => a.activityType === filters.activityType);
  if (filters.customerId) rows = rows.filter((a) => a.customerId === filters.customerId);
  return [...rows].sort((a, b) => b.activityDate.localeCompare(a.activityDate));
}

export function createActivity(input: Omit<Activity, "id" | "createdAt">) {
  return mutate((db) => {
    const activity: Activity = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    db.activities.push(activity);

    // Deduct chemical/fertilizer inventory used, mirroring the spec's
    // "record spraying -> subtract inventory -> assign cost" pipeline.
    const lines = activity.sprayProducts ?? [];
    for (const line of lines) {
      const item = db.inventoryItems.find((i) => i.productId === line.productId);
      if (item) {
        item.quantityOnHand = Math.max(0, item.quantityOnHand - line.quantityUsed);
        db.inventoryMovements.push({
          id: randomUUID(), inventoryItemId: item.id,
          movementType: activity.jobId ? "use_customer_job" : "use_own_field",
          quantity: -line.quantityUsed, unitCost: item.averageUnitCost,
          relatedActivityId: activity.id, relatedJobId: activity.jobId,
          createdAt: new Date().toISOString(),
        });
      }
    }
    return activity;
  });
}

export function listCustomers() {
  return getDB().customers;
}

export function getCustomer(id: string) {
  return getDB().customers.find((c) => c.id === id) ?? null;
}

export function listJobs(filters: { customerId?: string; status?: string } = {}) {
  let rows = getDB().jobs;
  if (filters.customerId) rows = rows.filter((j) => j.customerId === filters.customerId);
  if (filters.status) rows = rows.filter((j) => j.status === filters.status);
  return rows;
}

export function createJob(input: Omit<Job, "id">) {
  return mutate((db) => {
    const job: Job = { ...input, id: randomUUID() };
    db.jobs.push(job);
    return job;
  });
}

export function jobMargin(job: Job) {
  return job.revenue - job.directCost;
}

export function listInvoices() {
  return getDB().invoices;
}

export function listPayments() {
  return getDB().payments;
}

export function listFarmCategories() {
  return getDB().farmCategories;
}

export function createInvoiceFromJob(jobId: string): Invoice | null {
  return mutate((db) => {
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    const customer = db.customers.find((c) => c.id === job.customerId);
    const nextNumber = String(1000 + db.invoices.length + 1);
    const amount = job.revenue;
    const invoice: Invoice = {
      id: randomUUID(), farmBusinessId: FARM.id, customerId: job.customerId,
      customerName: customer?.name ?? "Customer", invoiceNumber: nextNumber,
      status: "draft", issueDate: new Date().toISOString().slice(0, 10),
      lines: [{
        id: randomUUID(),
        description: `${job.jobService} — ${job.customerFieldName ?? "Field"} (${job.acres ?? 0} ac @ $${job.rate ?? 0}/${job.rateUnit === "per_acre" ? "ac" : job.rateUnit})`,
        quantity: job.acres ?? 1, unitRate: job.rate ?? amount, amount, jobId: job.id,
      }],
      subtotal: amount, additionalCharges: 0, total: amount, amountPaid: 0,
    };
    db.invoices.push(invoice);
    job.status = "invoiced";
    job.invoiceId = invoice.id;
    return invoice;
  });
}

export function recordPayment(input: Omit<Payment, "id">) {
  return mutate((db) => {
    const payment: Payment = { ...input, id: randomUUID() };
    db.payments.push(payment);

    if (input.invoiceId) {
      const invoice = db.invoices.find((i) => i.id === input.invoiceId);
      if (invoice) {
        invoice.amountPaid += input.amount;
        invoice.status = invoice.amountPaid >= invoice.total ? "paid" : "partial";
      }
    }
    const customer = db.customers.find((c) => c.id === input.customerId);
    if (customer) customer.balanceDue = Math.max(0, customer.balanceDue - input.amount);

    // Recording payment automatically creates associated farm income.
    const txn: Transaction = {
      id: randomUUID(), farmBusinessId: FARM.id, taxYear: FARM.currentTaxYear,
      transactionType: "income", status: "categorized",
      transactionDate: input.paymentDate, customerId: input.customerId,
      description: `Payment received${input.paymentMethod ? " — " + input.paymentMethod : ""}`,
      amount: input.amount, farmCategoryId: "cat-custom", taxCategoryCode: "income_custom_hire",
      isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced", createdAt: new Date().toISOString(),
      splits: [{ id: randomUUID(), transactionId: "", targetType: "general_overhead", allocationMethod: "manual", allocatedAmount: input.amount }],
    };
    txn.splits[0].transactionId = txn.id;
    db.transactions.push(txn);

    return payment;
  });
}

export function listAssets() { return getDB().assets; }
export function listAssetRepairs(assetId?: string) {
  const rows = getDB().assetRepairs;
  return assetId ? rows.filter((r) => r.assetId === assetId) : rows;
}
export function listMileageTrips() { return getDB().mileageTrips; }
export function listLivestockGroups() { return getDB().livestockGroups; }
export function listLivestockTransactions(groupId?: string) {
  const rows = getDB().livestockTransactions;
  return groupId ? rows.filter((t) => t.livestockGroupId === groupId) : rows;
}
export function listLoans() { return getDB().loans; }
export function createLoan(input: Omit<import("@/types/domain").Loan, "id" | "farmBusinessId">) {
  return mutate((db) => {
    const loan: import("@/types/domain").Loan = { ...input, id: randomUUID(), farmBusinessId: FARM.id };
    db.loans.push(loan);
    return loan;
  });
}

export function createInvoice(input: {
  customerId: string; dueDate?: string;
  lines: { description: string; quantity: number; unitRate: number }[];
}): Invoice {
  return mutate((db) => {
    const customer = db.customers.find((c) => c.id === input.customerId);
    const nextNumber = String(1000 + db.invoices.length + 1);
    const lines = input.lines.map((l) => ({
      id: randomUUID(), description: l.description, quantity: l.quantity, unitRate: l.unitRate, amount: l.quantity * l.unitRate,
    }));
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const invoice: Invoice = {
      id: randomUUID(), farmBusinessId: FARM.id, customerId: input.customerId,
      customerName: customer?.name ?? "Customer", invoiceNumber: nextNumber,
      status: "draft", issueDate: new Date().toISOString().slice(0, 10), dueDate: input.dueDate,
      lines, subtotal, additionalCharges: 0, total: subtotal, amountPaid: 0,
    };
    db.invoices.push(invoice);
    return invoice;
  });
}
export function listInventory() { return getDB().inventoryItems; }
export function listInventoryMovements(itemId?: string) {
  const rows = getDB().inventoryMovements;
  return itemId ? rows.filter((m) => m.inventoryItemId === itemId) : rows;
}
export function listDocuments(category?: string) {
  const rows = getDB().documents;
  return category ? rows.filter((d) => d.category === category) : rows;
}
export function createDocument(input: Omit<DocumentRecord, "id" | "createdAt">) {
  return mutate((db) => {
    const doc: DocumentRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    db.documents.push(doc);
    return doc;
  });
}
export function listTaxOpportunities() { return getDB().taxOpportunities; }
export function listTaxQuestions() { return getDB().taxQuestions; }
export function createTaxQuestion(question: string, raisedByName: string) {
  return mutate((db) => {
    const tq = {
      id: randomUUID(), farmBusinessId: FARM.id, taxYear: FARM.currentTaxYear,
      question, raisedByName, status: "open" as const, createdAt: new Date().toISOString(),
    };
    db.taxQuestions.push(tq);
    return tq;
  });
}

// -----------------------------------------------------------------------
// Field & crop-year profitability
// -----------------------------------------------------------------------

const EXPENSE_BUCKETS: Record<string, keyof Omit<FieldProfitability, "fieldId" | "fieldName" | "acres" | "cropName" | "income" | "totalExpense" | "margin" | "incomePerAcre" | "expensePerAcre" | "marginPerAcre">> = {
  "cat-seed": "expenseSeed",
  "cat-fert": "expenseFertilizer",
  "cat-chem": "expenseChemical",
  "cat-fuel": "expenseFuel",
  "cat-rent": "expenseRent",
  "cat-ins": "expenseInsurance",
  "cat-custom": "expenseCustomWork",
  "cat-trucking": "expenseTrucking",
};

export function fieldProfitability(fieldId: string, taxYear: number): FieldProfitability {
  const db = getDB();
  const field = db.fields.find((f) => f.id === fieldId)!;
  const cropYear = db.cropYears.find((c) => c.fieldId === fieldId && c.year === taxYear);
  const relevantTxns = db.transactions.filter((t) => t.taxYear === taxYear);

  const result: FieldProfitability = {
    fieldId, fieldName: field?.name ?? "Unknown", acres: field?.acres ?? 0, cropName: cropYear?.cropName,
    income: 0, expenseSeed: 0, expenseFertilizer: 0, expenseChemical: 0, expenseFuel: 0,
    expenseRent: 0, expenseInsurance: 0, expenseCustomWork: 0, expenseHarvest: 0,
    expenseDrying: 0, expenseTrucking: 0, expenseOther: 0, totalExpense: 0, margin: 0,
    incomePerAcre: 0, expensePerAcre: 0, marginPerAcre: 0,
  };

  for (const txn of relevantTxns) {
    for (const split of txn.splits) {
      if (split.fieldId !== fieldId) continue;
      if (txn.transactionType === "income") {
        result.income += split.allocatedAmount;
      } else if (txn.transactionType === "expense") {
        const bucketKey = txn.farmCategoryId ? EXPENSE_BUCKETS[txn.farmCategoryId] : undefined;
        if (bucketKey) (result[bucketKey] as number) += split.allocatedAmount;
        else result.expenseOther += split.allocatedAmount;
      }
    }
  }

  result.totalExpense = result.expenseSeed + result.expenseFertilizer + result.expenseChemical +
    result.expenseFuel + result.expenseRent + result.expenseInsurance + result.expenseCustomWork +
    result.expenseHarvest + result.expenseDrying + result.expenseTrucking + result.expenseOther;
  result.margin = result.income - result.totalExpense;
  const acres = result.acres || 1;
  result.incomePerAcre = round2(result.income / acres);
  result.expensePerAcre = round2(result.totalExpense / acres);
  result.marginPerAcre = round2(result.margin / acres);
  return result;
}

export function allFieldProfitability(taxYear: number) {
  return listFields().map((f) => fieldProfitability(f.id, taxYear));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// -----------------------------------------------------------------------
// Dashboard summary
// -----------------------------------------------------------------------

export function dashboardSummary(taxYear: number) {
  const txns = listTransactions({ taxYear }).filter((t) => !t.isPersonalExcluded);
  const income = txns.filter((t) => t.transactionType === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter((t) => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0);
  const margin = income - expenses;

  const receipts = listReceipts();
  const missingReceipts = txns.filter((t) => t.transactionType === "expense" && !t.receiptId).length;
  const needsReview = txns.filter((t) => t.status === "needs_review").length;
  const overdueInvoices = listInvoices().filter((i) => i.status !== "paid" && i.status !== "void" && new Date(i.dueDate ?? 0) < new Date()).length;
  const cpaQuestionsOpen = listTaxQuestions().filter((q) => q.status === "open").length;
  const unconfirmedReceipts = receipts.filter((r) => r.ocrStatus !== "confirmed").length;
  const lowInventory = listInventory().filter((i) => i.reorderThreshold && i.quantityOnHand < i.reorderThreshold).length;

  const totalChecklist = 6;
  let complete = 0;
  if (missingReceipts === 0) complete++;
  if (needsReview === 0) complete++;
  if (cpaQuestionsOpen === 0) complete++;
  if (overdueInvoices === 0) complete++;
  if (unconfirmedReceipts === 0) complete++;
  if (lowInventory === 0) complete++;
  const taxReadinessPct = Math.round((complete / totalChecklist) * 100);

  return {
    income, expenses, margin, taxReadinessPct,
    needsAttention: {
      missingReceipts, transactionsNeedingReview: needsReview, cpaQuestionsOpen,
      overdueInvoices, unconfirmedReceipts, lowInventory,
    },
  };
}
