import type { FieldProductUsage } from "@/lib/supabase/repo";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * Groups a field's product usage by category (Seed / Fertilizer / Chemical)
 * and shows, for each product, the total quantity used this year and — right
 * below it — what that cost (once an Allocate Product Cost entry exists for
 * it). This is the "how much 28/thio did I use, and what did it cost"
 * breakdown, as opposed to the category-level $ totals in Expense Breakdown.
 */
export function ProductUsagePanel({
  usage,
  taxYear,
  title = "Product Usage & Cost",
}: {
  usage: FieldProductUsage[];
  taxYear: number;
  title?: string;
}) {
  if (usage.length === 0) return null;

  const categories: FieldProductUsage["category"][] = ["Seed", "Fertilizer", "Chemical"];

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">{title} ({taxYear})</div>
      <p className="text-xs text-charcoal/50 mb-3">
        Totals from logged/imported field activity. A product shows &quot;not yet allocated&quot; until you use{" "}
        <a href="/fields/allocate-cost" className="text-forest hover:underline">Allocate Product Cost</a> to attach what you actually paid for it.
      </p>
      <div className="space-y-4">
        {categories.map((cat) => {
          const rows = usage.filter((u) => u.category === cat);
          if (rows.length === 0) return null;
          const catTotal = rows.reduce((s, r) => s + (r.allocatedCost ?? 0), 0);
          return (
            <div key={cat}>
              <div className="flex items-baseline justify-between text-sm font-semibold text-charcoal/80 mb-1.5">
                <span>{cat}</span>
                {catTotal > 0 && <span className="text-forest">{money(catTotal)}</span>}
              </div>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.productName} className="flex items-center justify-between text-sm border-b border-charcoal/10 last:border-0 pb-1.5 last:pb-0">
                    <div>
                      <div className="font-medium">{r.productName}</div>
                      <div className="text-xs text-charcoal/50">
                        {r.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit ?? ""} used
                        {r.fieldCount != null && r.fieldCount > 0 && ` · ${r.fieldCount} field${r.fieldCount === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    <div className="text-right">
                      {r.allocatedCost != null ? (
                        <div className="font-medium">{money(r.allocatedCost)}</div>
                      ) : (
                        <div className="text-xs text-status-amber">not yet allocated</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
