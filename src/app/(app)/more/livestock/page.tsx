import Link from "next/link";
import { listLivestockGroups, listLivestockTransactions } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default async function LivestockPage() {
  const groups = await listLivestockGroups();
  const txns = await listLivestockTransactions();
  return (
    <div>
      <PageHeader
        title="Livestock"
        description={`${groups.length} group${groups.length === 1 ? "" : "s"}`}
        action={<Link href="/more/livestock/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Record Purchase/Sale/Loss</Link>}
      />
      <div className="grid lg:grid-cols-2 gap-6">
        {groups.map((g) => (
          <div key={g.id} className="card p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-forest">{g.name}</div>
                <div className="text-sm text-charcoal/55 capitalize">{g.species} · {g.purpose.replace("_", " ")}</div>
              </div>
              <div className="text-2xl font-semibold">{g.headCount}<span className="text-xs text-charcoal/50 ml-1">head</span></div>
            </div>
            <div className="mt-4 space-y-1.5">
              {txns.filter((t) => t.livestockGroupId === g.id).map((t) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="capitalize">{t.txnDate} — {t.txnType.replace("_", " ")} ({t.headCount} hd)</span>
                  <span className="font-medium">{t.totalAmount ? money(t.totalAmount) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
