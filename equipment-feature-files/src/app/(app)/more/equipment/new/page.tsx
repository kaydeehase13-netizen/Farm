import { PageHeader } from "@/components/ui/stat-card";
import { createAssetAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default function NewEquipmentPage() {
  async function action(formData: FormData) {
    "use server";
    await createAssetAction(formData);
    redirect("/more/equipment");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Add Equipment" description="Name, price, and (optionally) depreciation info — useful life is what lets the Equipment page estimate annual depreciation and current book value." />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">Type</div>
          <select name="assetType" className="input" defaultValue="equipment">
            <option value="equipment">Equipment</option>
            <option value="vehicle">Vehicle</option>
            <option value="building">Building</option>
            <option value="land_improvement">Land Improvement</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Name</div>
          <input name="name" className="input" placeholder="e.g. John Deere 8R 250" required />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><div className="text-sm font-medium mb-1">Make</div>
            <input name="make" className="input" />
          </label>
          <label className="block"><div className="text-sm font-medium mb-1">Model</div>
            <input name="model" className="input" />
          </label>
        </div>
        <label className="block"><div className="text-sm font-medium mb-1">Year</div>
          <input type="number" name="year" className="input" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><div className="text-sm font-medium mb-1">Purchase Date</div>
            <input type="date" name="purchaseDate" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="block"><div className="text-sm font-medium mb-1">Purchase Price</div>
            <input type="number" step="0.01" name="purchasePrice" className="input" placeholder="0.00" required />
          </label>
        </div>
        <label className="block"><div className="text-sm font-medium mb-1">Placed in Service Date</div>
          <input type="date" name="placedInServiceDate" className="input" />
          <div className="text-xs text-charcoal/50 mt-1">Leave blank to use the purchase date.</div>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Business Use %</div>
          <input type="number" name="businessUsePercent" className="input" defaultValue={100} min={0} max={100} />
        </label>
        <div className="border-t border-[--border-color] pt-4">
          <div className="text-sm font-semibold text-forest mb-1">Depreciation (optional)</div>
          <div className="text-xs text-charcoal/50 mb-3">Simple straight-line estimate for your own tracking — your CPA still handles the actual Section 179 / MACRS election on the return.</div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><div className="text-sm font-medium mb-1">Useful Life (years)</div>
              <input type="number" step="0.5" name="usefulLifeYears" className="input" placeholder="e.g. 7" />
            </label>
            <label className="block"><div className="text-sm font-medium mb-1">Salvage Value</div>
              <input type="number" step="0.01" name="salvageValue" className="input" defaultValue={0} />
            </label>
          </div>
        </div>
        <label className="block"><div className="text-sm font-medium mb-1">Notes</div>
          <textarea name="notes" className="input" rows={2} />
        </label>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save Equipment</button>
      </form>
    </div>
  );
}
