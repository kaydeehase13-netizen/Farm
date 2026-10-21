import { listFarmCategories, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { DuplicateScanner } from "@/components/money/duplicate-scanner";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function DuplicatesPage() {
  const [taxYear, categories, fields] = await Promise.all([getViewTaxYear(), listFarmCategories(), listFields()]);
  return (
    <div>
      <PageHeader
        title="Check for Duplicates"
        description="Finds transactions entered more than once, across every kind of transaction and every year."
      />
      <DuplicateScanner
        taxYear={taxYear}
        names={{
          categories: Object.fromEntries(categories.map((c) => [c.id, c.name])),
          fields: Object.fromEntries(fields.map((f) => [f.id, f.name])),
        }}
      />
    </div>
  );
}
