import Link from "next/link";
import { allFieldProfitability, getFarm } from "@/lib/data/repo";
import { PageHeader, money, moneyPrecise } from "@/components/ui/stat-card";

export default function FieldsPage() {
  const farm = getFarm();
  const rows = allFieldProfitability(farm.currentTaxYear);
  const totalAcres = rows.reduce((s, r) => s + r.acres, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0);

  return (
    <div>
      <PageHeader
        title="Fields"
        description={`${rows.length} fields · ${totalAcres.toFixed(1)} acres · ${money(totalMargin)} total margin (${farm.currentTaxYear})`}
        action={<a href="/api/export/field-report" className="card px-4 py-2 text-sm font-medium hover:border-forest">Export Field Report</a>}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <Link key={r.fieldId} href={`/fields/${r.fieldId}`} className="card p-5 hover:border-forest transition-colors">
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
