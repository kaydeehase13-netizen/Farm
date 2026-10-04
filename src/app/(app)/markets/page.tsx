import { PageHeader } from "@/components/ui/stat-card";
import { GrainOutlook } from "@/components/markets/grain-outlook";
import { loadOutlook } from "@/lib/grain-markets";

// Prices are cached for ~30 minutes by the fetch layer; render per request so the "as of" time is current.
export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const outlook = await loadOutlook();
  const asOf = outlook.map((o) => o.asOf).filter(Boolean).sort().pop();
  return (
    <div>
      <PageHeader
        title="Grain Prices"
        description={`Today's price and what the futures market is paying 30, 60, 90 and 120 days and a year out — with your basis, storage and interest — to see when selling pays most.${asOf ? ` Prices as of ${new Date(asOf).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT.` : ""}`}
      />
      <GrainOutlook outlook={outlook} />
    </div>
  );
}
