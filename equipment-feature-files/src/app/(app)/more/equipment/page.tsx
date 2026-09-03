import Link from "next/link";
import { listAssets, listAssetRepairs } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";
import { straightLineDepreciation } from "@/lib/depreciation";

export default async function EquipmentPage() {
  const assets = (await listAssets()).filter((a) => a.assetType === "equipment");
  const repairs = await listAssetRepairs();

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Machinery, purchases, and repair history."
        action={<Link href="/more/equipment/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Equipment</Link>}
      />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th><th>Purchased</th><th className="text-right">Purchase Price</th>
                <th className="text-right">Annual Depreciation</th><th className="text-right">Book Value</th>
                <th>Use %</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const dep = straightLineDepreciation(a);
                const hasDep = Boolean(a.usefulLifeYears);
                return (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}<div className="text-xs text-charcoal/50">{a.make} {a.model} {a.year}</div></td>
                    <td>{a.purchaseDate}</td>
                    <td className="text-right">{a.purchasePrice ? money(a.purchasePrice) : "—"}</td>
                    <td className="text-right">{hasDep ? `${money(dep.annualDepreciation)}/yr` : "—"}</td>
                    <td className="text-right">{hasDep ? money(dep.bookValue) : "—"}</td>
                    <td>{a.businessUsePercent}%</td>
                    <td><span className="status-pill status-green">{a.status}</span></td>
                  </tr>
                );
              })}
              {assets.length === 0 && (
                <tr><td colSpan={7} className="text-center text-charcoal/50 py-10">No equipment on file yet.</td></tr>
              )}
            </tbody>
          </table>
          <div className="p-3">
            <Link href="/more/equipment/repairs/new" className="text-sm text-forest underline">+ Log a repair</Link>
          </div>
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
            {repairs.length === 0 && <div className="text-sm text-charcoal/50">No repairs logged yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
