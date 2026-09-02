import { listTransactions, getFarm, getAppData } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { TransactionsTable } from "@/components/money/transactions-table";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; fieldId?: string }>;
}) {
  const params = await searchParams;
  const farm = await getFarm();
  const taxYear = await getViewTaxYear();
  const transactions = await listTransactions({
    taxYear: taxYear,
    type: params.type,
    status: params.status,
    fieldId: params.fieldId,
    search: params.q,
  });
  const data = await getAppData(taxYear);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={`${transactions.length} transaction${transactions.length === 1 ? "" : "s"} · Tax year ${taxYear}`}
        action={
          <div className="flex gap-2">
            <a href={`/api/export/cpa-workbook?type=full`} className="card px-4 py-2 text-sm font-medium hover:border-forest">
              Export Excel
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
        <button className="bg-cream-deep px-4 py-2 rounded-lg font-medium">Filter</button>
      </form>

      <TransactionsTable transactions={transactions} categories={data.farmCategories} fields={data.fields} />
    </div>
  );
}
