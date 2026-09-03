import Link from "next/link";
import { allFieldProfitability } from "@/lib/data/repo";
import { PageHeader, money, moneyPrecise } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function FieldsPage() {
  const taxYear = await getViewTaxYear();
  const rows = await allFieldProfitability(taxYear);
  const totalAcres = rows.reduce((s, r) => s + r.acres, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0);

  return (
    <div>
      <PageHeader
        title="Fields"
        description={`${rows.length} fields · ${totalAcres.toFixed(1)} acres · ${money(totalMargin)} total margin (${taxYear})`}
        action={
          <div className="flex gap-2">
            <Link prefetch={false} href="/fields/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">
              + Add Field
            </Link>
            <Link prefetch={false} href="/fields/import" className="card px-4 py-2 text-sm font-medium hover:border-forest">Import Activities</Link>
            <Link prefetch={false} href="/fields/allocate-cost" className="card px-4 py-2 text-sm font-medium hover:border-forest">Allocate Product Cost</Link>
            <a href="/api/export/field-report" className="card px-4 py-2 text-sm font-medium hover:border-forest">Export Field Report</a>
          </div>
        }
      />
      {rows.length === 0 && (
        <div className="card p-8 text-center text-charcoal/55">
          No fields yet. <Link prefetch={false} href="/fields/new" className="text-forest font-medium hover:underline">Add your first field</Link> to start tracking acres, activities, and profitability.
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <Link prefetch={false} key={r.fieldId} href={`/fields/${r.fieldId}`} className="card p-5 hover:border-forest transition-colors">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-forest">{r.fieldName}</div>
              <div className="text-xs text-charcoal/50">{r.acres} ac</div>
            </div>
            <div className="text-sm text-charcoal/55 mt-0.5">{r.cropName ?? "No crop set"}</div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div>
                <div className="text-xs text-charcoal/45">Income</div>
                <div className="font-medium text-status-green">{money(r.income)}</div>
              </div>
              <div>
                <div className="text-xs text-charcoal/45">Expense</div>
                <div className="font-medium">{money(r.totalExpense)}</div>
              </div>
              <div>
                <div className="text-xs text-charcoal/45">Margin/ac</div>
                <div className={`font-medium ${r.marginPerAcre >= 0 ? "text-status-green" : "text-status-red"}`}>{moneyPrecise(r.marginPerAcre)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
