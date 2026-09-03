import { listActivities, listFarmCategories, listTaxYears } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateCostForm } from "@/components/fields/allocate-cost-form";

export default async function AllocateCostPage() {
  const [taxYear, years, farmCategories] = await Promise.all([
    getViewTaxYear(),
    listTaxYears(),
    listFarmCategories(),
  ]);

  // Pull every product name we can see across all years so the form can
  // suggest one as you type, no matter which year you're allocating to.
  const allActivities = await listActivities({});
  const productNames = new Set<string>();
  for (const a of allActivities) {
    for (const p of a.sprayProducts ?? []) if (p.productName) productNames.add(p.productName);
    for (const p of a.fertilizerProducts ?? []) if (p.productName) productNames.add(p.productName);
    if (a.seedProductName) productNames.add(a.seedProductName);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Allocate Product Cost by Field Usage"
        description="Enter what you actually paid for a fertilizer, seed, or chemical — we'll split it across fields based on how much each field's logged activity used."
      />
      <AllocateCostForm
        years={years}
        defaultYear={taxYear}
        productNames={Array.from(productNames).sort()}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
