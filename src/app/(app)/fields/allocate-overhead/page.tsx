import { listFields, listTaxYears } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { AllocateOverheadForm } from "@/components/fields/allocate-overhead-form";

export default async function AllocateOverheadPage() {
  const [taxYear, years, fields] = await Promise.all([getViewTaxYear(), listTaxYears(), listFields()]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Allocate Equipment Cost to Fields"
        description="Enter one total for equipment ownership cost or repairs & maintenance, and split it across whichever fields it applies to — proportional to acres. This is manual and non-tax: it never touches real expenses or your tax totals, only the margin shown on each field."
      />
      <AllocateOverheadForm
        years={years}
        defaultYear={taxYear}
        fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres }))}
      />
    </div>
  );
}
