import { listAssets } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createMileageTripAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default function NewMileagePage() {
  const vehicles = listAssets().filter((a) => a.assetType === "vehicle");
  async function action(formData: FormData) {
    "use server";
    await createMileageTripAction(formData);
    redirect("/more/vehicles");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Log Mileage" />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">Vehicle</div>
          <select name="vehicleAssetId" className="input" required>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Date</div>
          <input type="date" name="tripDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Miles</div>
          <input type="number" step="0.1" name="miles" className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Purpose</div>
          <input name="purpose" className="input" placeholder="Parts run, delivered equipment, etc." />
        </label>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save Trip</button>
      </form>
    </div>
  );
}
