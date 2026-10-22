import { listActivities, listFarmCategories, listTaxYears, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateCostForm } from "@/components/fields/allocate-cost-form";
import { AllocateCostBulkImport } from "@/components/fields/allocate-cost-bulk-import";
import { GeneralCostForm, type SeedPlanting } from "@/components/fields/general-cost-form";
import { ResplitAllButton } from "@/components/fields/resplit-all-button";
import { AutoAllocate } from "@/components/fields/auto-allocate";
import { distinctProductNames } from "@/lib/product-usage";
import { SeedPoundRates, type SeedPlantingRow } from "@/components/fields/seed-pound-rates";

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

  // Every planting with acres, for "Seed by the pound" (wheat lb/acre per field).
  const seedPlantings: SeedPlantingRow[] = allActivities
    .filter((a) => a.seedProductName && (a.acres ?? 0) > 0)
    .map((a) => ({
      activityId: a.id, year: Number(a.activityDate.slice(0, 4)), date: a.activityDate,
      fieldName: a.fieldName ?? a.customerFieldName ?? "Field", seed: a.seedProductName!.trim(), acres: a.acres ?? 0,
      rate: a.seedingRate, rateUnit: a.seedingRateUnit,
    }))
    .sort((x, y) => x.fieldName.localeCompare(y.fieldName));

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Allocate Product Cost by Field Usage"
        description="Enter what you actually paid for a fertilizer, seed, feed, or chemical — we'll split it across fields based on how much each field's logged activity used. Fields AgFiniti never covered can be added manually below."
      />
      <div className="card p-4 mb-4 space-y-1">
        <div className="text-sm font-semibold text-forest">From Prices Paid</div>
        <p className="text-xs text-charcoal/55">Splits every product&apos;s Prices Paid total for each year onto the fields that used it. Runs on its own when you upload purchases or field data.</p>
        <AutoAllocate />
      </div>
      <ResplitAllButton years={years} defaultYear={taxYear} />
      <AllocateCostForm
        years={years}
        defaultYear={taxYear}
        productNames={productNames}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
        fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres ?? undefined, grower: f.grower || undefined }))}
      />
      <div className="mt-6">
        <SeedPoundRates plantings={seedPlantings} years={years} defaultYear={taxYear} />
      </div>
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
