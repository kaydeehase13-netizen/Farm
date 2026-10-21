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
import { plantedSeedAmount } from "@/lib/seed-units";

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
  const rows = new Map<string, InventoryRow & { priceQty: number; priceCost: number; recorded: number; recordedCostQty: number; recordedCost: number; ozOnly: boolean }>();
  const get = (name: string, rawUnit: string, category: string) => {
    const base = toBase(1, rawUnit);
    const key = `${norm(name)}|${base.unit}`;
    let r = rows.get(key);
    if (!r) {
      r = { key, productName: name.trim(), names: [], category, unit: base.unit, bought: 0, boughtFrom: "none", used: 0, adjusted: 0, onHand: 0,
        priceQty: 0, priceCost: 0, recorded: 0, recordedCostQty: 0, recordedCost: 0, ozOnly: true };
      rows.set(key, r);
    }
    if (!r.names.includes(name.trim())) r.names.push(name.trim());
    // "oz" could be fluid ounces or weight; remember if that's all this row ever saw.
    if (!/^oz\.?$/i.test(rawUnit.replace(/\(us\)/i, "").trim())) r.ozOnly = false;
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
    // Seed planted: bags/units for corn, soybeans and sorghum (seeding rate x
    // acres / seeds per bag), pounds for wheat entered by lb/acre. A planting
    // with no rate can't be counted.
    if (a.seedProductName && (a.seedingRate ?? 0) > 0 && (a.acres ?? 0) > 0) {
      const { quantity, unit } = plantedSeedAmount(a.seedProductName, a.seedingRate, a.seedingRateUnit, a.acres);
      if (quantity && quantity > 0 && unit !== "seeds") {
        const { r, factor } = get(a.seedProductName, unit, "Seed");
        r.used += quantity * factor;
        touch(r, year(a.activityDate));
      }
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

  // Liquid fertilizer logged by the pound on the fields but bought by the
  // gallon (or the other way round) lands on two rows with the same name.
  // For the common liquids the weight per gallon is standard, so convert
  // and put them on one row, in whichever unit the fields use.
  const byName = new Map<string, (typeof rows extends Map<string, infer V> ? V : never)[]>();
  for (const r of rows.values()) {
    const k = r.key.split("|")[0];
    byName.set(k, [...(byName.get(k) ?? []), r]);
  }
  for (const group of byName.values()) {
    const lb = group.find((r) => r.unit === "lb");
    const gal = group.find((r) => r.unit === "gal");
    // A dry product (Status) bought "by the oz" and logged by the pound: those
    // oz are weight, 16 to the pound. 1 "gal" here = 128 oz = 8 lb.
    const d = lb && gal ? lbPerGallon(lb.productName) ?? lbPerGallon(gal.productName) ?? (gal.ozOnly ? 8 : undefined) : undefined;
    if (!lb || !gal || !d) continue;
    const keepGal = gal.used > 0 && lb.used === 0;
    const [into, from, f] = keepGal ? [gal, lb, 1 / d] : [lb, gal, d];
    into.used += from.used * f;
    into.adjusted += from.adjusted * f;
    into.priceQty += from.priceQty * f;
    into.priceCost += from.priceCost;
    into.recorded += from.recorded * f;
    into.recordedCostQty += from.recordedCostQty * f;
    into.recordedCost += from.recordedCost;
    for (const nm of from.names) if (!into.names.includes(nm)) into.names.push(nm);
    if (from.priceQty > 0) into.productName = from.productName;
    if (from.firstYear) { into.firstYear = Math.min(into.firstYear ?? from.firstYear, from.firstYear); into.lastYear = Math.max(into.lastYear ?? from.lastYear!, from.lastYear!); }
    rows.delete(from.key);
  }

  const out: InventoryRow[] = [];
  for (const r of rows.values()) {
    // Prices Paid wins when it has the product: the same purchase may also
    // have been recorded from a receipt, and counting both would double it.
    if (r.priceQty > 0) { r.bought = r.priceQty; r.boughtFrom = "prices"; r.averageCost = r.priceCost / r.priceQty; }
    else if (r.recorded > 0) { r.bought = r.recorded; r.boughtFrom = "recorded"; r.averageCost = r.recordedCostQty > 0 ? r.recordedCost / r.recordedCostQty : undefined; }
    r.onHand = r.bought - r.used + r.adjusted;
    if (r.bought === 0 && r.used === 0 && r.adjusted === 0) continue;
    const { priceQty: _a, priceCost: _b, recorded: _c, recordedCostQty: _d, recordedCost: _e, ozOnly: _f, ...row } = r;
    out.push(row);
  }
  return out.sort((x, y) => x.category.localeCompare(y.category) || x.productName.localeCompare(y.productName));
}

/** Standard weight per gallon for common liquid fertilizers (lb/gal). */
export function lbPerGallon(name: string): number | undefined {
  const n = name.toLowerCase();
  if (/10-34-0|\bapp\b/.test(n)) return 11.65;
  if (/\b32\b|32-0-0|32%|uan ?32/.test(n)) return 11.06;
  if (/\b28\b|28-0-0|28%|uan ?28/.test(n)) return 10.67;
  if (/thio|12-0-0-26|\bats\b/.test(n)) return 11.1;
  return undefined;
}
