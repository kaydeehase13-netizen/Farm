import * as demo from "./demo-repo";
import type {
  Transaction, TransactionSplit, Receipt, Activity, Job, Payment, DocumentRecord,
} from "@/types/domain";

// -----------------------------------------------------------------------
// Repository facade. Every page/action imports from here. It transparently
// picks the real Supabase-backed implementation once Supabase is
// configured (see .env.example), and otherwise falls back to the local
// JSON demo store (./demo-repo.ts) so the app still runs with zero setup.
//
// Every export here is now async (even the demo path, trivially) so call
// sites are uniform regardless of which backend is active — `await
// repo.listFields()` works either way.
// -----------------------------------------------------------------------

async function supabaseConfigured() {
  const { isSupabaseConfigured } = await import("@/lib/supabase/server");
  return isSupabaseConfigured();
}

export async function getFarm() {
  if (await supabaseConfigured()) {
    const sb = await import("@/lib/supabase/repo");
    return sb.getFarm();
  }
  return demo.getFarm();
}

export async function listFields() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listFields();
  return demo.listFields();
}

export async function getField(fieldId: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).getField(fieldId);
  return demo.getField(fieldId);
}

export async function createField(input: Parameters<typeof demo.createField>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createField(input);
  return demo.createField(input);
}

export async function listCropYears(fieldId?: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listCropYears(fieldId);
  return demo.listCropYears(fieldId);
}

export async function listTaxYears() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listTaxYears();
  return demo.listTaxYears();
}

export async function listTransactions(filters: Parameters<typeof demo.listTransactions>[0] = {}) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listTransactions(filters);
  return demo.listTransactions(filters);
}

export async function getTransaction(id: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).getTransaction(id);
  return demo.getTransaction(id);
}

export async function createTransaction(input: Omit<Transaction, "id" | "createdAt" | "splits"> & { splits?: Omit<TransactionSplit, "id" | "transactionId">[] }) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createTransaction(input);
  return demo.createTransaction(input);
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).updateTransaction(id, patch);
  return demo.updateTransaction(id, patch);
}

export async function fixMisfiledTaxYears() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).fixMisfiledTaxYears();
  return demo.fixMisfiledTaxYears();
}

export async function backfillTaxCategories() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).backfillTaxCategories();
  return demo.backfillTaxCategories();
}

export async function deleteTransaction(id: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).deleteTransaction(id);
  return demo.deleteTransaction(id);
}

export async function deleteReceipt(id: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).deleteReceipt(id);
  return demo.deleteReceipt(id);
}

export async function listReceipts() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listReceipts();
  return demo.listReceipts();
}

export async function getReceipt(id: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).getReceipt(id);
  return demo.getReceipt(id);
}

export async function createReceipt(input: Omit<Receipt, "id" | "createdAt">) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createReceipt(input);
  return demo.createReceipt(input);
}

export async function updateReceipt(id: string, patch: Partial<Receipt>) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).updateReceipt(id, patch);
  return demo.updateReceipt(id, patch);
}

export async function confirmReceipt(id: string, patch: Parameters<typeof demo.confirmReceipt>[1]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).confirmReceipt(id, patch);
  return demo.confirmReceipt(id, patch);
}

export async function createReceiptAndExpense(input: Parameters<typeof demo.createReceiptAndExpense>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createReceiptAndExpense(input);
  return demo.createReceiptAndExpense(input);
}

export async function createReceiptAndSplitExpenses(input: Parameters<typeof demo.createReceiptAndSplitExpenses>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createReceiptAndSplitExpenses(input);
  return demo.createReceiptAndSplitExpenses(input);
}

export async function listActivities(filters: Parameters<typeof demo.listActivities>[0] = {}) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listActivities(filters);
  return demo.listActivities(filters);
}

export async function createActivity(input: Omit<Activity, "id" | "createdAt">) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createActivity(input);
  return demo.createActivity(input);
}

export async function repairActivityProductDetails(activityId: string, details: Parameters<typeof demo.repairActivityProductDetails>[1]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).repairActivityProductDetails(activityId, details);
  return demo.repairActivityProductDetails(activityId, details);
}

export async function listCustomers() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listCustomers();
  return demo.listCustomers();
}

export async function listCustomerFields() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listCustomerFields();
  return demo.listCustomerFields();
}

export async function getCustomer(id: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).getCustomer(id);
  return demo.getCustomer(id);
}

export async function listJobs(filters: Parameters<typeof demo.listJobs>[0] = {}) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listJobs(filters);
  return demo.listJobs(filters);
}

export async function createJob(input: Omit<Job, "id">) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createJob(input);
  return demo.createJob(input);
}

export async function jobMargin(job: Job) {
  return job.revenue - job.directCost;
}

export async function listInvoices() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listInvoices();
  return demo.listInvoices();
}

export async function createInvoiceFromJob(jobId: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createInvoiceFromJob(jobId);
  return demo.createInvoiceFromJob(jobId);
}

export async function createInvoice(input: Parameters<typeof demo.createInvoice>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createInvoice(input);
  return demo.createInvoice(input);
}

export async function listPayments() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listPayments();
  return demo.listPayments();
}

export async function listFarmCategories() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listFarmCategories();
  return demo.listFarmCategories();
}

export async function recordPayment(input: Omit<Payment, "id">) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).recordPayment(input);
  return demo.recordPayment(input);
}

export async function listAssets() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listAssets();
  return demo.listAssets();
}
export async function createAsset(input: Parameters<typeof demo.createAsset>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createAsset(input);
  return demo.createAsset(input);
}
export async function listAssetRepairs(assetId?: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listAssetRepairs(assetId);
  return demo.listAssetRepairs(assetId);
}
export async function listMileageTrips() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listMileageTrips();
  return demo.listMileageTrips();
}
export async function listLivestockGroups() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listLivestockGroups();
  return demo.listLivestockGroups();
}
export async function listLivestockTransactions(groupId?: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listLivestockTransactions(groupId);
  return demo.listLivestockTransactions(groupId);
}
export async function listLoans() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listLoans();
  return demo.listLoans();
}
export async function createLoan(input: Parameters<typeof demo.createLoan>[0]) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createLoan(input);
  return demo.createLoan(input);
}
export async function listInventory() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listInventory();
  return demo.listInventory();
}
export async function listInventoryMovements(itemId?: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listInventoryMovements(itemId);
  return demo.listInventoryMovements(itemId);
}
export async function listDocuments(category?: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listDocuments(category);
  return demo.listDocuments(category);
}
export async function createDocument(input: Omit<DocumentRecord, "id" | "createdAt">) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createDocument(input);
  return demo.createDocument(input);
}
export async function listTaxOpportunities() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listTaxOpportunities();
  return demo.listTaxOpportunities();
}
export async function listTaxQuestions() {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).listTaxQuestions();
  return demo.listTaxQuestions();
}
export async function createTaxQuestion(question: string, raisedByName: string) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).createTaxQuestion(question, raisedByName);
  return demo.createTaxQuestion(question, raisedByName);
}
export async function scanTaxOpportunities(taxYear: number) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).scanTaxOpportunities(taxYear);
  return demo.scanTaxOpportunities(taxYear);
}

export async function fieldProfitability(fieldId: string, taxYear: number) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).fieldProfitability(fieldId, taxYear);
  return demo.fieldProfitability(fieldId, taxYear);
}
export async function allFieldProfitability(taxYear: number) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).allFieldProfitability(taxYear);
  return demo.allFieldProfitability(taxYear);
}
export async function dashboardSummary(taxYear: number) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).dashboardSummary(taxYear);
  return demo.dashboardSummary(taxYear);
}

/** Aggregate accessor used by pages that previously read the demo store's getDB() directly. */
export async function getAppData(taxYear: number) {
  if (await supabaseConfigured()) return (await import("@/lib/supabase/repo")).getAppData(taxYear);
  const { getDB } = await import("./store");
  const db = getDB();
  return {
    fields: db.fields, farmCategories: db.farmCategories, customers: db.customers,
    customerFields: db.customerFields, transactions: db.transactions.filter((t) => t.taxYear === taxYear),
  };
}

/** Full demo-shaped snapshot (used by the CPA/field Excel export, which needs every collection). Supabase mode fetches each collection directly instead — see src/lib/export/workbook.ts. */
export async function getFullSnapshot() {
  const { getDB } = await import("./store");
  return getDB();
}
