import { listInventory } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { adjustInventoryAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function AdjustInventoryPage() {
  const items = await listInventory();
  async function action(formData: FormData) {
    "use server";
    await adjustInventoryAction(formData);
    redirect("/more/inventory");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Inventory Adjustment" description="Correct a count, record waste/loss, or a transfer." />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">Item</div>
          <select name="inventoryItemId" className="input" required>{items.map((i) => <option key={i.id} value={i.id}>{i.productName} ({i.unit})</option>)}</select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Quantity change (+/-)</div>
          <input type="number" step="0.01" name="quantity" className="input" placeholder="-5 or 12" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Reason</div>
          <input name="note" className="input" placeholder="Spillage, recount, damaged, etc." />
        </label>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save Adjustment</button>
      </form>
    </div>
  );
}
