import { listAssets, listAssetRepairs } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default function EquipmentPage() {
  const assets = listAssets().filter((a) => a.assetType === "equipment");
  const repairs = listAssetRepairs();

  return (
    <div>
      <PageHeader title="Equipment" description="Machinery, purchases, and repair history." />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Equipment</th><th>Purchased</th><th className="text-right">Purchase Price</th><th>Use %</th><th>Status</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.name}<div className="text-xs text-charcoal/50">{a.make} {a.model} {a.year}</div></td>
                  <td>{a.purchaseDate}</td>
                  <td className="text-right">{a.purchasePrice ? money(a.purchasePrice) : "—"}</td>
                  <td>{a.businessUsePercent}%</td>
                  <td><span className="status-pill status-green">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold text-forest mb-3">Repair History</div>
          <div className="space-y-3">
            {repairs.map((r) => {
              const asset = assets.find((a) => a.id === r.assetId);
              return (
                <div key={r.id} className="flex justify-between text-sm border-b border-[--border-color] pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{asset?.name}</div>
                    <div className="text-charcoal/55">{r.description}</div>
                    <div className="text-xs text-charcoal/40">{r.repairDate}</div>
                  </div>
                  <div className="font-medium">{r.cost ? money(r.cost) : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
