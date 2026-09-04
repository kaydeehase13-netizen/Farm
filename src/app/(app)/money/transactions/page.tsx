import { listTransactions, getAppData } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { TransactionsTable } from "@/components/money/transactions-table";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; fieldId?: string; missingReceipt?: string }>;
}) {
  const params = await searchParams;
  const taxYear = await getViewTaxYear();
  const [allTransactions, data] = await Promise.all([
    listTransactions({
      taxYear: taxYear,
      type: params.type,
      status: params.status,
      fieldId: params.fieldId,
      search: params.q,
    }),
    getAppData(taxYear),
  ]);

  // "Missing Receipts" (linked from Home / Tax) needs the actual expense
  // transactions that have no receipt on file, not the receipts list itself
  // (which only ever shows receipts that DO exist — there's nothing to filter
  // there for "missing"). Filtered here rather than in listTransactions so
  // every existing caller/filter combination keeps working unchanged.
  const missingReceiptOnly = params.missingReceipt === "1";
  const transactions = missingReceiptOnly
    ? allTransactions.filter((t) => t.transactionType === "expense" && !t.receiptId)
    : allTransactions;

  return (
    <div>
      <PageHeader
        title={missingReceiptOnly ? "Transactions Missing Receipts" : "Transactions"}
        description={`${transactions.length} transaction${transactions.length === 1 ? "" : "s"} · Tax year ${taxYear}`}
        action={
          <div className="flex gap-2">
            <a href={`/api/export/cpa-workbook?type=full`} className="card px-4 py-2 text-sm font-medium hover:border-forest">
              Export Excel
            </a>
            <a href="/money/transactions/import-excel" className="card px-4 py-2 text-sm font-medium hover:border-forest">
              Import Excel
            </a>
            <a href="/money/transactions/category-audit" className="card px-4 py-2 text-sm font-medium hover:border-forest">
              Category Audit
            </a>
            <a href="/money/transactions/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">
              + Add Transaction
            </a>
          </div>
        }
      />

      <form className="flex flex-wrap gap-2 mb-4 text-sm" action="/money/transactions">
        <input name="q" defaultValue={params.q} placeholder="Search vendor or description…" className="card px-3 py-2 flex-1 min-w-[200px]" />
        <select name="type" defaultValue={params.type ?? ""} className="card px-3 py-2">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="card px-3 py-2">
          <option value="">All statuses</option>
          <option value="needs_review">Needs Review</option>
          <option value="categorized">Categorized</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <select name="fieldId" defaultValue={params.fieldId ?? ""} className="card px-3 py-2">
          <option value="">All fields</option>
          {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label className="card px-3 py-2 flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="missingReceipt" value="1" defaultChecked={missingReceiptOnly} />
          Missing receipt only
        </label>
        <button className="bg-cream-deep px-4 py-2 rounded-lg font-medium">Filter</button>
        {missingReceiptOnly && (
          <a href="/money/transactions" className="px-4 py-2 text-sm font-medium text-forest self-center hover:underline">
            Clear filter
          </a>
        )}
      </form>

      <TransactionsTable transactions={transactions} categories={data.farmCategories} fields={data.fields} />
    </div>
  );
}
