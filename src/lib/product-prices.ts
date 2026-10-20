/**
 * Prices Paid: turns individual purchases into per-product price stats
 * (average, lowest, highest, last paid) for billing breakdowns.
 */

export interface ProductPrice {
  id: string;
  productName: string;
  category?: string;
  purchaseDate?: string;
  vendor?: string;
  quantity: number;
  unit: string;
  totalAmount: number;
  invoice?: string;
  notes?: string;
}

export interface PriceStats {
  key: string;
  productName: string;
  category?: string;
  unit: string;
  purchases: ProductPrice[];
  totalQuantity: number;
  totalAmount: number;
  /** Total paid / total quantity: big purchases count more than small ones. */
  weightedAverage: number;
  /** Plain average of each purchase's price per unit. */
  simpleAverage: number;
  lowest: number;
  highest: number;
  last?: ProductPrice;
}

export function unitPrice(p: Pick<ProductPrice, "quantity" | "totalAmount">): number {
  return p.quantity !== 0 ? p.totalAmount / p.quantity : 0;
}

const UNIT_ALIASES: Record<string, string> = {
  gallon: "gal", gallons: "gal", gals: "gal", "gal.": "gal",
  lbs: "lb", pound: "lb", pounds: "lb", "lb.": "lb",
  tons: "ton", tn: "ton", bags: "bag", units: "unit", ea: "unit", each: "unit",
  ounce: "oz", ounces: "oz", "fl oz": "oz", quarts: "qt", quart: "qt", pints: "pt", pint: "pt",
};

export function normalizeUnit(u: string | undefined | null): string {
  const t = (u ?? "").trim().toLowerCase();
  return UNIT_ALIASES[t] ?? (t || "unit");
}

/** One row per product + unit (a product bought by the ton and by the gallon gets two rows). */
export function summarizePrices(prices: ProductPrice[]): PriceStats[] {
  const groups = new Map<string, PriceStats>();
  for (const p of prices) {
    if (!(p.quantity > 0) || !(p.totalAmount > 0)) continue;
    const unit = normalizeUnit(p.unit);
    const key = `${p.productName.trim().toLowerCase()}|${unit}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key, productName: p.productName.trim(), category: p.category, unit, purchases: [],
        totalQuantity: 0, totalAmount: 0, weightedAverage: 0, simpleAverage: 0, lowest: Infinity, highest: 0,
      };
      groups.set(key, g);
    }
    g.purchases.push(p);
    g.category = g.category ?? p.category;
    g.totalQuantity += p.quantity;
    g.totalAmount += p.totalAmount;
    const up = unitPrice(p);
    g.lowest = Math.min(g.lowest, up);
    g.highest = Math.max(g.highest, up);
  }
  for (const g of groups.values()) {
    g.weightedAverage = g.totalAmount / g.totalQuantity;
    g.simpleAverage = g.purchases.reduce((s, p) => s + unitPrice(p), 0) / g.purchases.length;
    g.purchases.sort((a, b) => (b.purchaseDate ?? "").localeCompare(a.purchaseDate ?? ""));
    g.last = g.purchases[0];
  }
  return [...groups.values()].sort((a, b) => a.productName.localeCompare(b.productName) || a.unit.localeCompare(b.unit));
}

/** Same product, date, quantity and total = the same purchase (re-uploading a file doesn't double it). */
export function priceDedupeKey(p: Pick<ProductPrice, "productName" | "purchaseDate" | "quantity" | "totalAmount">): string {
  return [p.productName.trim().toLowerCase(), p.purchaseDate ?? "", Number(p.quantity).toFixed(4), Number(p.totalAmount).toFixed(2)].join("|");
}
