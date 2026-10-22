import Link from "next/link";
import { listInventory, listActivities, listProductPrices } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { inventoryBalance } from "@/lib/inventory-balance";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { Fold32Thio } from "@/components/inventory/fold-32-thio";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const [items, activities, priceData] = await Promise.all([listInventory(), listActivities({}), listProductPrices()]);
  const all = inventoryBalance({ activities, prices: priceData.prices, items });
  const rows = show === "bought" ? all.filter((r) => r.bought > 0) : all;
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
        <Link prefetch={false} href={show === "bought" ? "/more/inventory" : "/more/inventory?show=bought"} className="text-xs text-forest hover:underline">
          {show === "bought" ? "Show everything" : "Only show products with a purchase on file"}
        </Link>
      </div>
      <div className="mb-4"><Fold32Thio /></div>
      <InventoryTable rows={rows} />
    </div>
  );
}
