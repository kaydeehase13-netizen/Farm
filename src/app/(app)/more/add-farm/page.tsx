import { PageHeader } from "@/components/ui/stat-card";
import { addAnotherFarmAction } from "@/lib/auth-actions";

export default async function AddFarmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-sm">
      <PageHeader
        title="Add Another Farm"
        description="Creates a brand-new, empty farm under your same login — no sample data, and it won't touch your other farm(s). You'll switch to it right away, and can jump between farms anytime from the farm switcher."
      />
      <div className="card p-5">
        {error && <div className="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}
        <form action={addAnotherFarmAction} className="space-y-3">
          <input name="name" placeholder="Farm name (e.g. Mohler Farm)" className="input" required />
          <select name="operationType" className="input" defaultValue="row_crop">
            <option value="grain">Grain</option>
            <option value="row_crop">Row Crop</option>
            <option value="livestock">Livestock</option>
            <option value="dairy">Dairy</option>
            <option value="custom_application">Custom Work / Ag Services</option>
            <option value="hay_forage">Hay / Forage</option>
            <option value="mixed">Mixed / Diversified</option>
            <option value="other">Other</option>
          </select>
          <input name="state" placeholder="State (e.g. KS)" maxLength={2} className="input" />
          <button className="bg-forest text-white w-full py-2.5 rounded-lg font-medium hover:bg-forest-light">
            Create Farm
          </button>
        </form>
      </div>
    </div>
  );
}
