import Link from "next/link";
import { listInventory, listActivities, listProductPrices } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { inventoryBalance } from "@/lib/inventory-balance";

function n(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: v !== 0 && Math.abs(v) < 10 ? 2 : 0 });
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const [items, activities, priceData] = await Promise.all([listInventory(), listActivities({}), listProductPrices()]);
  const all = inventoryBalance({ activities, prices: priceData.prices, items });
  const rows = show === "all" ? all : all.filter((r) => r.bought > 0 || r.adjusted !== 0 || r.onHand !== 0);
  const short = all.filter((r) => r.onHand < -0.005);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Everything bought minus everything used on the fields, across all years."
        action={<Link prefetch={false} href="/more/inventory/adjust" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Inventory Adjustment</Link>}
      />
      <div className="card p-4 mb-4 text-sm text-charcoal/70 space-y-1">
        <p>
          <b>Bought</b> comes from Chemicals → Prices Paid (your invoices, every year), or from receipts entered with a quantity when a
          product isn&apos;t on Prices Paid. <b>Used</b> is every spray and fertilizer pass logged on your fields, every year.
          <b> On hand</b> = bought − used ± adjustments. Gallons and pounds are added up across fl oz, qt, gal, lb and ton.
        </p>
        <p className="text-xs text-charcoal/55">
          Discounts, credits, fees and tax lines are part of a product&apos;s cost, not inventory, so they never show here. A product only
          matches when the invoice name and the field name are the same (capitals and spaces don&apos;t matter).
        </p>
        {short.length > 0 && (
          <p className="text-xs text-status-amber">
            {short.length} product{short.length === 1 ? " shows" : "s show"} more used than bought. That means a purchase isn&apos;t on Prices Paid yet
            (an older year, or a vendor not uploaded), or the invoice name doesn&apos;t match the name on the fields.
          </p>
        )}
        <Link prefetch={false} href={show === "all" ? "/more/inventory" : "/more/inventory?show=all"} className="text-xs text-forest hover:underline">
          {show === "all" ? "Hide products with nothing bought" : `Also show products used but never bought (${all.length - rows.length})`}
        </Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th><th>Category</th><th className="text-right">Bought</th><th className="text-right">Used</th>
              <th className="text-right">On Hand</th><th className="text-right">Avg Cost</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="font-medium">
                  {r.productName}
                  {r.firstYear && <div className="text-[11px] text-charcoal/45 font-normal">{r.firstYear === r.lastYear ? r.firstYear : `${r.firstYear}–${r.lastYear}`}</div>}
                </td>
                <td>{r.category}</td>
                <td className="text-right whitespace-nowrap">
                  {r.bought ? `${n(r.bought)} ${r.unit}` : "—"}
                  {r.boughtFrom === "recorded" && <div className="text-[11px] text-charcoal/45">from receipts</div>}
                </td>
                <td className="text-right whitespace-nowrap">{r.used ? `${n(r.used)} ${r.unit}` : "—"}</td>
                <td className={`text-right whitespace-nowrap font-medium ${r.onHand < -0.005 ? "text-status-amber" : ""}`}>
                  {n(r.onHand)} {r.unit}
                  {r.adjusted !== 0 && <div className="text-[11px] text-charcoal/45 font-normal">incl. {r.adjusted > 0 ? "+" : ""}{n(r.adjusted)} adjusted</div>}
                </td>
                <td className="text-right whitespace-nowrap">{r.averageCost ? `$${r.averageCost.toFixed(r.averageCost < 10 ? 4 : 2)}/${r.unit}` : "—"}</td>
                <td>
                  {r.onHand < -0.005
                    ? <span className="status-pill status-amber">Used more than bought</span>
                    : r.bought === 0 ? <span className="status-pill status-amber">No purchase on file</span>
                    : <span className="status-pill status-green">OK</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="text-sm text-charcoal/50">Nothing yet. Upload your purchases on Chemicals → Prices Paid.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
