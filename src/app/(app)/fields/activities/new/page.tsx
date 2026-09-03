import { listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createFieldActivity } from "@/lib/actions";
import { redirect } from "next/navigation";

const TYPES = [
  { value: "plant", label: "Plant" }, { value: "spray", label: "Spray" },
  { value: "fertilize", label: "Fertilize" }, { value: "harvest", label: "Harvest" },
  { value: "till", label: "Till" }, { value: "scout", label: "Scout" },
  { value: "other", label: "Other Field Work" },
];

export default async function NewActivityPage({
  searchParams,
}: { searchParams: Promise<{ type?: string; fieldId?: string }> }) {
  const params = await searchParams;
  const fields = await listFields();
  const type = params.type ?? "spray";

  async function action(formData: FormData) {
    "use server";
    await createFieldActivity(formData);
    redirect(params.fieldId ? `/fields/${params.fieldId}` : "/fields");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Log Field Activity" description="Tell us what happened in the field — we'll update inventory, cost, and field profitability automatically." />
      <form action={action} className="card p-6 space-y-4">
        <Field label="Activity Type">
          <select name="activityType" defaultValue={type} className="input">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Field">
          <select name="fieldId" defaultValue={params.fieldId} className="input" required>
            <option value="" disabled>Select a field…</option>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" name="activityDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" required />
        </Field>
        <Field label="Acres">
          <input type="number" step="0.1" name="acres" className="input" placeholder="Acres covered" />
        </Field>

        <div className="border-t border-[--border-color] pt-4 space-y-4">
          <Field label="Product used (spray/fertilizer — optional)">
            <input name="sprayProductName" className="input" placeholder="e.g. Roundup PowerMAX" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate">
              <input name="sprayRate" type="number" step="0.01" className="input" placeholder="32" />
            </Field>
            <Field label="Rate Unit">
              <input name="sprayRateUnit" className="input" placeholder="oz/ac" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity Used">
              <input name="sprayQuantity" type="number" step="0.01" className="input" placeholder="68" />
            </Field>
            <Field label="Quantity Unit">
              <input name="sprayQuantityUnit" className="input" placeholder="gal" />
            </Field>
          </div>
          <Field label="Applicator">
            <input name="applicatorName" className="input" placeholder="Who applied it?" />
          </Field>
        </div>

        <div className="border-t border-[--border-color] pt-4 space-y-4">
          <Field label="Seed product (planting — optional)">
            <input name="seedProductName" className="input" placeholder="e.g. Pioneer P1197AM" />
          </Field>
          <Field label="Seeding rate">
            <input name="seedingRate" type="number" className="input" placeholder="32000" />
          </Field>
        </div>

        <div className="border-t border-[--border-color] pt-4 space-y-4">
          <Field label="Yield (harvest — optional)">
            <input name="yieldAmount" type="number" step="0.1" className="input" placeholder="178" />
          </Field>
          <Field label="Yield Unit">
            <input name="yieldUnit" className="input" placeholder="bu/ac" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea name="notes" className="input" rows={3} placeholder="Weather, conditions, anything worth remembering…" />
        </Field>

        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium hover:bg-forest-light w-full">Save Activity</button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>{children}</label>;
}
