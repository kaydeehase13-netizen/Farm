import { listActivities, listFarmCategories, listTaxYears } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateIncomeForm } from "@/components/fields/allocate-income-form";
import { distinctCropNames } from "@/lib/product-usage";

export default async function AllocateIncomePage() {
  const [taxYear, years, farmCategories] = await Promise.all([
    getViewTaxYear(),
    listTaxYears(),
    listFarmCategories(),
  ]);

  const allActivities = await listActivities({});
  const cropNames = distinctCropNames(allActivities);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Allocate Grain Sale by Field Yield"
        description="Enter what a sale actually totaled — we'll split it across fields based on how many bushels each field harvested, so revenue nets out fairly even when grain from several fields was sold together."
      />
      <AllocateIncomeForm
        years={years}
        defaultYear={taxYear}
        cropNames={cropNames}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
