import { notFound } from "next/navigation";
import Link from "next/link";
import { getField, fieldProfitability, listActivities, listCropYears, getFarm } from "@/lib/data/repo";
import { PageHeader, StatCard, money, moneyPrecise } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function FieldDetailPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  const field = await getField(fieldId);
  if (!field) notFound();
  const farm = await getFarm();
  const taxYear = await getViewTaxYear();
  const profit = await fieldProfitability(fieldId, taxYear);
  const activities = await listActivities({ fieldId });
  const cropYears = await listCropYears(fieldId);

  const expenseRows: [string, number][] = ([
    ["Seed", profit.expenseSeed], ["Fertilizer", profit.expenseFertilizer], ["Chemical", profit.expenseChemical],
    ["Fuel", profit.expenseFuel], ["Rent", profit.expenseRent], ["Insurance", profit.expenseInsurance],
    ["Custom Work", profit.expenseCustomWork], ["Harvest", profit.expenseHarvest], ["Drying", profit.expenseDrying],
    ["Trucking", profit.expenseTrucking], ["Other", profit.expenseOther],
  ] as [string, number][]).filter(([, v]) => v > 0);

  return (
    <div>
      <PageHeader
        title={field.name}
        description={`${field.acres} acres · ${field.ownership.replace("_", " ")} · ${field.county ?? ""} County ${field.fsaFarmNumber ? `· FSA Farm ${field.fsaFarmNumber}` : ""}`}
        action={
          <Link href={`/fields/activities/new?fieldId=${fieldId}`} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">
            + Log Field Activity
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Income" value={money(profit.income)} sub={moneyPrecise(profit.incomePerAcre) + "/ac"} />
        <StatCard label="Total Expense" value={money(profit.totalExpense)} sub={moneyPrecise(profit.expensePerAcre) + "/ac"} />
        <StatCard label="Margin" value={money(profit.margin)} tone={profit.margin >= 0 ? "green" : "red"} />
        <StatCard label="Margin / Acre" value={moneyPrecise(profit.marginPerAcre)} tone={profit.marginPerAcre >= 0 ? "green" : "red"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="text-sm font-semibold text-forest mb-3">Expense Breakdown</div>
          {expenseRows.length === 0 && <p className="text-sm text-charcoal/50">No expenses recorded for this field yet.</p>}
          <div className="space-y-2">
            {expenseRows.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <div className="w-32 text-charcoal/60">{label}</div>
                <div className="flex-1 h-2 rounded-full bg-cream-deep overflow-hidden">
                  <div className="h-full bg-wheat" style={{ width: `${Math.min(100, (value / (profit.totalExpense || 1)) * 100)}%` }} />
                </div>
                <div className="w-20 text-right font-medium">{money(value)}</div>
              </div>
            ))}
          </div>

          {cropYears.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[--border-color]">
              <div className="text-sm font-semibold text-forest mb-2">Crop History</div>
              {cropYears.map((cy) => (
                <div key={cy.id} className="flex justify-between text-sm py-1">
                  <span>{cy.year} — {cy.cropName}</span>
                  <span className="text-charcoal/55">{cy.actualYield ? `${cy.actualYield} ${cy.yieldUnit}` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="text-sm font-semibold text-forest mb-3">Field Activity History</div>
          <ol className="relative border-l-2 border-cream-deep ml-2 space-y-5">
            {activities.map((a) => (
              <li key={a.id} className="ml-4">
                <div className="absolute w-2.5 h-2.5 bg-forest rounded-full -ml-[1.35rem] mt-1.5" />
                <div className="text-xs text-charcoal/45">{a.activityDate}</div>
                <div className="font-medium capitalize">{a.activityType} {a.acres ? `— ${a.acres} ac` : ""}</div>
                {a.sprayProducts && a.sprayProducts.map((p, i) => (
                  <div key={i} className="text-sm text-charcoal/60">{p.productName} @ {p.rate} {p.rateUnit} ({p.quantityUsed} {p.quantityUnit})</div>
                ))}
                {a.seedProductName && <div className="text-sm text-charcoal/60">{a.seedProductName} @ {a.seedingRate}/ac</div>}
                {a.yieldAmount && <div className="text-sm text-charcoal/60">{a.yieldAmount} {a.yieldUnit}{a.moisturePct ? ` · ${a.moisturePct}% moisture` : ""}</div>}
                {a.notes && <div className="text-sm text-charcoal/50 italic">{a.notes}</div>}
              </li>
            ))}
            {activities.length === 0 && <p className="text-sm text-charcoal/50">No activity logged yet.</p>}
          </ol>
        </div>
      </div>
    </div>
  );
}
