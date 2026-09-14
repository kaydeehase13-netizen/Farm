import { listActivities, listFarmCategories, listTaxYears, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateCostForm } from "@/components/fields/allocate-cost-form";
import { ExcelBulkImport } from "@/components/shared/excel-bulk-import";
import { bulkImportAllocateCostAction } from "@/lib/actions";
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
        <ExcelBulkImport
          title="Bulk allocate from Excel"
          description="Got several products to allocate at once? Download the template, fill in one row per product, and upload it here instead of doing them one at a time above."
          templateUrl="/api/templates/allocate-cost"
          action={bulkImportAllocateCostAction}
        />
      </div>
    </div>
  );
}
