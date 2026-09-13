import { farmProductUsage, listTaxYears } from "@/lib/data/repo";
import { getViewTaxYear } from "@/lib/tax-year";
import { PageHeader } from "@/components/ui/stat-card";
import { ProductUsagePanel } from "@/components/fields/product-usage-panel";
import { YearFilter } from "@/components/reports/year-filter";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function ProductUsageReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const defaultYear = await getViewTaxYear();
  const taxYear = params.year ? Number(params.year) : defaultYear;

  const availableYears = await listTaxYears();
  const years = Array.from(new Set([...availableYears, taxYear])).sort((a, b) => b - a);

  const usage = await farmProductUsage(taxYear);
  const allocatedTotal = usage.reduce((s, u) => s + (u.allocatedCost ?? 0), 0);
  const unallocatedCount = usage.filter((u) => u.allocatedCost == null).length;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Chemical & Seed Usage"
        description="Every chemical, fertilizer, and seed used across all fields this year, with quantities and cost once allocated."
      />
      <YearFilter years={years} selectedYear={taxYear} />

      {usage.length === 0 ? (
        <div className="card p-6 text-sm text-charcoal/60">
          No logged/imported field activity for {taxYear} yet.
        </div>
      ) : (
        <>
          <div className="card p-5 mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-forest">Total allocated cost ({taxYear})</div>
              <p className="text-xs text-charcoal/50 mt-0.5">
                {unallocatedCount > 0
                  ? `${unallocatedCount} product${unallocatedCount === 1 ? "" : "s"} below still ${unallocatedCount === 1 ? "isn't" : "aren't"} allocated, so this total will grow as you add those.`
                  : "Every product below has an allocated cost."}
              </p>
            </div>
            <div className="text-xl font-semibold text-forest">{money(allocatedTotal)}</div>
          </div>
          <ProductUsagePanel usage={usage} taxYear={taxYear} title="Chemical & Seed Usage" />
        </>
      )}
    </div>
  );
}
