/**
 * Average cost per unit used, worked out from the field allocations:
 * what a product's "<product> — allocated by usage (Field)" entries add up
 * to for the year, divided by how much of it is logged on the fields'
 * spray and fertilizer passes. Gives one average (the allocation spreads
 * one total at one price), so there's no low/high here; those come from
 * purchases on Prices Paid.
 *
 * Logged amounts are converted to gallons (liquids) or pounds (dry) so a
 * product logged in fl oz on one field and gal on another adds up. Spray
 * and liquid-fertilizer "oz" is read as fluid ounces, same as the tank mix
 * calculator.
 */
import type { Activity, Transaction } from "@/types/domain";

export interface AllocationPrice {
  productName: string;
  unit: string;
  totalAllocated: number;
  totalUsed: number;
  average: number;
  fields: number;
  /** Logged in units that can't be added together; the average uses only the main unit. */
  mixedUnits: boolean;
}

const TO_GAL: Record<string, number> = { gal: 1, gallon: 1, gallons: 1, qt: 0.25, quart: 0.25, quarts: 0.25, pt: 0.125, pint: 0.125, pints: 0.125, "fl oz": 1 / 128, floz: 1 / 128, oz: 1 / 128 };
const TO_LB: Record<string, number> = { lb: 1, lbs: 1, pound: 1, pounds: 1, ton: 2000, tons: 2000 };

export function toBase(qty: number, rawUnit: string): { qty: number; unit: string } {
  const u = rawUnit.toLowerCase().replace(/\(us\)/g, "").replace(/\./g, "").trim();
  if (TO_GAL[u] != null) return { qty: qty * TO_GAL[u], unit: "gal" };
  if (TO_LB[u] != null) return { qty: qty * TO_LB[u], unit: "lb" };
  // A seed bag, a "unit" (Kanza's word for a bag/jug) and "each" are one count.
  if (["bag", "bags", "unit", "units", "ea", "each", "jug", "jugs"].includes(u)) return { qty, unit: "unit" };
  return { qty, unit: u || "unit" };
}

export function allocationPrices(transactions: Transaction[], activities: Activity[]): AllocationPrice[] {
  const allocated = new Map<string, { name: string; total: number; fields: Set<string> }>();
  for (const t of transactions) {
    if (t.transactionType !== "expense") continue;
    const m = (t.description ?? "").match(/^(.*?) — allocated by usage \(/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const cur = allocated.get(key) ?? { name: m[1].trim(), total: 0, fields: new Set<string>() };
    cur.total += t.amount;
    for (const s of t.splits) if (s.fieldId) cur.fields.add(s.fieldId);
    allocated.set(key, cur);
  }
  if (allocated.size === 0) return [];

  // Usage per product, per base unit.
  const used = new Map<string, Map<string, number>>();
  for (const a of activities) {
    for (const line of [...(a.sprayProducts ?? []), ...(a.fertilizerProducts ?? [])]) {
      const key = line.productName.trim().toLowerCase();
      if (!allocated.has(key) || !(line.quantityUsed > 0)) continue;
      const b = toBase(line.quantityUsed, line.quantityUnit ?? "");
      const byUnit = used.get(key) ?? new Map<string, number>();
      byUnit.set(b.unit, (byUnit.get(b.unit) ?? 0) + b.qty);
      used.set(key, byUnit);
    }
  }

  const out: AllocationPrice[] = [];
  for (const [key, a] of allocated) {
    const byUnit = used.get(key);
    if (!byUnit || a.total <= 0) continue;
    // A product logged in more than one kind of unit (gal on some fields,
    // lb on others) can't be added up; use the unit most of it was logged in.
    const [unit, qty] = [...byUnit.entries()].sort((x, y) => y[1] - x[1])[0];
    if (!(qty > 0)) continue;
    out.push({
      productName: a.name, unit, totalAllocated: Math.round(a.total * 100) / 100, totalUsed: qty,
      average: a.total / qty, fields: a.fields.size, mixedUnits: byUnit.size > 1,
    });
  }
  return out.sort((x, y) => x.productName.localeCompare(y.productName));
}
