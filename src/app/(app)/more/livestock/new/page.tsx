import { listLivestockGroups } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createLivestockTxnAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function NewLivestockTxnPage() {
  const groups = await listLivestockGroups();
  async function action(formData: FormData) {
    "use server";
    await createLivestockTxnAction(formData);
    redirect("/more/livestock");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Livestock Transaction" description="Purchase, sale, birth, death/loss, or transfer." />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">Group</div>
          <select name="livestockGroupId" className="input" required>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Type</div>
          <select name="txnType" className="input">
            <option value="purchase">Purchase</option><option value="sale">Sale</option>
            <option value="birth">Birth</option><option value="death_loss">Death / Loss</option>
            <option value="transfer_in">Transfer In</option><option value="transfer_out">Transfer Out</option>
          </select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Date</div>
          <input type="date" name="txnDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Head Count</div>
          <input type="number" name="headCount" defaultValue={1} className="input" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Total Amount</div>
          <input type="number" step="0.01" name="totalAmount" className="input" />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Weight (lbs)</div>
          <input type="number" name="weightLbs" className="input" />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Notes</div>
          <textarea name="notes" className="input" rows={2} />
        </label>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save</button>
      </form>
    </div>
  );
}
