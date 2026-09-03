import Link from "next/link";
import { listInventory } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";

export default async function InventoryPage() {
  const items = await listInventory();
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Chemical, fertilizer, seed, feed, and fuel on hand."
        action={<Link prefetch={false} href="/more/inventory/adjust" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Inventory Adjustment</Link>}
      />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Product</th><th>Category</th><th className="text-right">On Hand</th><th className="text-right">Avg Cost</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((i) => {
              const low = i.reorderThreshold && i.quantityOnHand < i.reorderThreshold;
              return (
                <tr key={i.id}>
                  <td className="font-medium">{i.productName}</td>
                  <td className="capitalize">{i.category}</td>
                  <td className="text-right">{i.quantityOnHand.toLocaleString()} {i.unit}</td>
                  <td className="text-right">${i.averageUnitCost.toFixed(2)}</td>
                  <td>{low ? <span className="status-pill status-amber">Reorder soon</span> : <span className="status-pill status-green">OK</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
