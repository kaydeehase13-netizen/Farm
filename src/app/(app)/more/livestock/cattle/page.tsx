import { headers } from "next/headers";
import { listCattle } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { CattleHerd } from "@/components/livestock/cattle-herd";

export default async function CattlePage() {
  const { cattle, needsMigration, sync } = await listCattle();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "farmtax.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const current = cattle.filter((c) => c.status === "current").length;
  return (
    <div>
      <PageHeader
        title="Cattle"
        description={`${current} head on hand · synced with your cow Google Sheet`}
      />
      <CattleHerd cattle={cattle} needsMigration={needsMigration} sync={sync} syncUrl={`${proto}://${host}/api/cattle-sync`} />
    </div>
  );
}
