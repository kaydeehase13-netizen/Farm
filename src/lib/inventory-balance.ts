/**
 * Inventory across ALL years: what was bought minus what was used.
 *
 * Bought = purchases on Prices Paid (every year, uploaded from invoices),
 * or, for a product with none there, purchases recorded with a receipt or
 * expense. Used = every spray and fertilizer pass logged on the fields, every
 * year. Plus manual adjustments (recounts, waste). Amounts are converted to
 * gallons (liquids) or pounds (dry) so fl oz / qt / gal and lb / ton add up.
 *
 * Products are matched by name, ignoring capitals, spaces and punctuation,
 * so the invoice name has to be the same product name used on the fields.
 * Discounts, credits, fees and the like are cost only and never show here.
 */
import type { Activity, InventoryItem } from "@/types/domain";
import type { ProductPrice } from "@/lib/product-prices";
import { toBase } from "@/lib/allocation-prices";
import { isCostOnlyLine } from "@/lib/inventory-lines";

export interface InventoryRow {
  key: string;
  productName: string;
  /** Every spelling that landed on this row (same name apart from capitals, spaces, punctuation). */
  names: string[];
  category: string;
  unit: string;
  bought: number;
  boughtFrom: "prices" | "recorded" | "none";
  used: number;
  adjusted: number;
  onHand: number;
  averageCost?: number;
  firstYear?: number;
  lastYear?: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function inventoryBalance(input: { activities: Activity[]; prices: ProductPrice[]; items: InventoryItem[] }): InventoryRow[] {
  const rows = new Map<string, InventoryRow & { priceQty: number; priceCost: number; recorded: number; recordedCostQty: number; recordedCost: number }>();
  const get = (name: string, rawUnit: string, category: string) => {
    const base = toBase(1, rawUnit);
    const key = `${norm(name)}|${base.unit}`;
    let r = rows.get(key);
    if (!r) {
      r = { key, productName: name.trim(), names: [], category, unit: base.unit, bought: 0, boughtFrom: "none", used: 0, adjusted: 0, onHand: 0,
        priceQty: 0, priceCost: 0, recorded: 0, recordedCostQty: 0, recordedCost: 0 };
      rows.set(key, r);
    }
    if (!r.names.includes(name.trim())) r.names.push(name.trim());
    return { r, factor: base.qty };
  };
  const year = (d?: string) => (d ? Number(d.slice(0, 4)) : undefined);
  const touch = (r: InventoryRow, y?: number) => {
    if (!y) return;
    r.firstYear = r.firstYear ? Math.min(r.firstYear, y) : y;
    r.lastYear = r.lastYear ? Math.max(r.lastYear, y) : y;
  };

  for (const a of input.activities) {
    const lines = [
      ...(a.sprayProducts ?? []).map((l) => ({ l, cat: "Chemical" })),
      ...(a.fertilizerProducts ?? []).map((l) => ({ l, cat: "Fertilizer" })),
    ];
    for (const { l, cat } of lines) {
      if (!(l.quantityUsed > 0) || isCostOnlyLine(l.productName)) continue;
      const { r, factor } = get(l.productName, l.quantityUnit ?? "", cat);
      r.used += l.quantityUsed * factor;
      touch(r, year(a.activityDate));
    }
  }
  for (const p of input.prices) {
    if (!(p.quantity > 0) || isCostOnlyLine(p.productName)) continue;
    const { r, factor } = get(p.productName, p.unit, p.category ?? "Chemical");
    r.priceQty += p.quantity * factor;
    r.priceCost += p.totalAmount;
    if (p.category) r.category = p.category;
    r.productName = p.productName.trim(); // show the invoice's spelling
    touch(r, year(p.purchaseDate));
  }
  for (const it of input.items) {
    const { r, factor } = get(it.productName, it.unit, it.category ? it.category[0].toUpperCase() + it.category.slice(1) : "Chemical");
    const bought = (it.purchasedQuantity ?? 0) * factor;
    r.recorded += bought;
    if (bought > 0 && it.averageUnitCost > 0) { r.recordedCostQty += bought; r.recordedCost += (it.purchasedQuantity ?? 0) * it.averageUnitCost; }
    r.adjusted += (it.adjustedQuantity ?? 0) * factor;
  }

  const out: InventoryRow[] = [];
  for (const r of rows.values()) {
    // Prices Paid wins when it has the product: the same purchase may also
    // have been recorded from a receipt, and counting both would double it.
    if (r.priceQty > 0) { r.bought = r.priceQty; r.boughtFrom = "prices"; r.averageCost = r.priceCost / r.priceQty; }
    else if (r.recorded > 0) { r.bought = r.recorded; r.boughtFrom = "recorded"; r.averageCost = r.recordedCostQty > 0 ? r.recordedCost / r.recordedCostQty : undefined; }
    r.onHand = r.bought - r.used + r.adjusted;
    if (r.bought === 0 && r.used === 0 && r.adjusted === 0) continue;
    const { priceQty: _a, priceCost: _b, recorded: _c, recordedCostQty: _d, recordedCost: _e, ...row } = r;
    out.push(row);
  }
  return out.sort((x, y) => x.category.localeCompare(y.category) || x.productName.localeCompare(y.productName));
}
