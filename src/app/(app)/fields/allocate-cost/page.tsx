import { listActivities, listFarmCategories, listTaxYears, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateCostForm } from "@/components/fields/allocate-cost-form";
import { AllocateCostBulkImport } from "@/components/fields/allocate-cost-bulk-import";
import { GeneralCostForm, type SeedPlanting } from "@/components/fields/general-cost-form";
import { distinctProductNames } from "@/lib/product-usage";

export default async function AllocateCostPage() {
  const [taxYear, years, farmCategories, fields] = await Promise.all([
    getViewTaxYear(),
    listTaxYears(),
    listFarmCategories(),
    listFields(),
  ]);

  // Pull every product name we can see across all years so the form can
  // suggest one as you type, no matter which year you're allocating to.
  const allActivities = await listActivities({});
  const productNames = distinctProductNames(allActivities);

  // Seeds planted per year / field / seed product, for the general-cost form.
  const plantingTotals = new Map<string, SeedPlanting>();
  for (const a of allActivities) {
    if (!a.fieldId || !a.seedProductName) continue;
    const seeds = (a.seedingRate ?? 0) * (a.acres ?? 0);
    if (!(seeds > 0)) continue;
    const year = Number(a.activityDate.slice(0, 4));
    const key = `${year}|${a.fieldId}|${a.seedProductName.trim().toLowerCase()}`;
    const existing = plantingTotals.get(key);
    if (existing) existing.seeds += seeds;
    else plantingTotals.set(key, { year, fieldId: a.fieldId, seed: a.seedProductName.trim(), seeds });
  }
  const plantings = [...plantingTotals.values()];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Allocate Product Cost by Field Usage"
        description="Enter what you actually paid for a fertilizer, seed, feed, or chemical — we'll split it across fields based on how much each field's logged activity used. Fields AgFiniti never covered can be added manually below."
      />
      <AllocateCostForm
        years={years}
        defaultYear={taxYear}
        productNames={productNames}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
        fields={fields.map((f) => ({ id: f.id, name: f.name }))}
      />
      <div className="mt-6">
        <GeneralCostForm
          years={years}
          defaultYear={taxYear}
          farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
          fields={fields.map((f) => ({ id: f.id, name: f.name }))}
          plantings={plantings}
        />
      </div>
      <div className="mt-6">
        <AllocateCostBulkImport
          title="Bulk allocate from Excel"
          description="Got several products to allocate at once? Download the template, fill in one row per product, and upload it here instead of doing them one at a time above."
          templateUrl="/api/templates/allocate-cost"
        />
      </div>
    </div>
  );
}
