import { listAssets } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createAssetRepairAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function NewRepairPage() {
  const assets = await listAssets();
  async function action(formData: FormData) {
    "use server";
    await createAssetRepairAction(formData);
    redirect("/more/equipment");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Equipment Repair" />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">Equipment</div>
          <select name="assetId" className="input" required>{assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Date</div>
          <input type="date" name="repairDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Description</div>
          <input name="description" className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Cost</div>
          <input type="number" step="0.01" name="cost" className="input" />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Odometer / Hours</div>
          <input type="number" name="odometerOrHours" className="input" />
        </label>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save Repair</button>
      </form>
    </div>
  );
}
