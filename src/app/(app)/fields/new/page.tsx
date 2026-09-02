import { PageHeader } from "@/components/ui/stat-card";
import { createFieldAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default function NewFieldPage() {
  async function action(formData: FormData) {
    "use server";
    await createFieldAction(formData);
    redirect("/fields");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Add a Field" description="A field, farm, or parcel you plant, harvest, or track expenses against." />
      <form action={action} className="card p-6 space-y-4">
        <Field label="Field Name">
          <input name="name" required placeholder="e.g. North 80" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Acres">
            <input type="number" step="0.01" name="acres" required className="input" placeholder="0" />
          </Field>
          <Field label="Tillable Acres (optional)">
            <input type="number" step="0.01" name="tillableAcres" className="input" placeholder="0" />
          </Field>
        </div>
        <Field label="Ownership">
          <select name="ownership" className="input" defaultValue="owned">
            <option value="owned">Owned</option>
            <option value="rented_cash">Rented — Cash Rent</option>
            <option value="rented_crop_share">Rented — Crop Share</option>
            <option value="rented_flex">Rented — Flex Lease</option>
          </select>
        </Field>
        <Field label="Landowner Name (if rented)">
          <input name="landownerName" className="input" placeholder="Optional" />
        </Field>
        <Field label="County">
          <input name="county" className="input" placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="FSA Farm #">
            <input name="fsaFarmNumber" className="input" placeholder="Optional" />
          </Field>
          <Field label="FSA Tract #">
            <input name="fsaTractNumber" className="input" placeholder="Optional" />
          </Field>
          <Field label="FSA Field #">
            <input name="fsaFieldNumber" className="input" placeholder="Optional" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="irrigated" /> Irrigated
        </label>
        <Field label="Notes">
          <textarea name="notes" rows={3} className="input" placeholder="Optional" />
        </Field>

        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light">
          Add Field
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>
      {children}
    </label>
  );
}
