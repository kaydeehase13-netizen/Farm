/**
 * Year-end billing per grower (who each field is farmed for).
 *
 * Product: every product cost already split to fields by usage (Allocate
 * Product Cost) on that grower's fields, at your cost, plus the grower's
 * markup %. Work: every pass logged on their fields, acres x your per-acre
 * rate for that job type. Your own farm shows its cost only, never billed.
 */
import type { Activity, Field, Transaction } from "@/types/domain";
import { BILLABLE_WORK, UNASSIGNED, type BillingRate, type Grower } from "@/lib/growers";

export interface ProductLine { productName: string; quantity: number; unit: string; cost: number }
export interface WorkLine { type: string; label: string; passes: number; acres: number; rate: number; amount: number }
export interface FieldBill { fieldId: string; fieldName: string; acres: number; products: ProductLine[]; work: WorkLine[]; productCost: number; workTotal: number }
export interface GrowerBill {
  grower: string; ownFarm: boolean; markupPct: number;
  fields: FieldBill[];
  products: ProductLine[]; work: WorkLine[];
  productCost: number; markup: number; productTotal: number; workTotal: number; total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function parseUsed(note?: string): { quantity: number; unit: string } | null {
  const m = (note ?? "").match(/^\s*([\d.,]+)\s*(.*?)\s+used\s*$/i);
  if (!m) return null;
  const q = Number(m[1].replace(/,/g, ""));
  return q > 0 ? { quantity: q, unit: m[2] || "" } : null;
}

function addProduct(list: ProductLine[], name: string, qty: number, unit: string, cost: number) {
  const hit = list.find((p) => p.productName.toLowerCase() === name.toLowerCase() && p.unit === unit);
  if (hit) { hit.quantity += qty; hit.cost += cost; } else list.push({ productName: name, quantity: qty, unit, cost });
}

export function growerBilling(input: {
  fields: Field[]; growers: Grower[]; rates: BillingRate[]; transactions: Transaction[]; activities: Activity[];
}): GrowerBill[] {
  const fieldById = new Map(input.fields.map((f) => [f.id, f]));
  const growerOf = (fieldId: string) => fieldById.get(fieldId)?.grower?.trim() || UNASSIGNED;
  const settings = new Map(input.growers.map((g) => [g.name.trim().toLowerCase(), g]));
  const rate = new Map(input.rates.map((r) => [r.activityType, r.ratePerAcre]));
  const label = new Map(BILLABLE_WORK.map((w) => [w.type, w.label]));

  const fb = new Map<string, FieldBill>();
  const fieldBill = (fieldId: string) => {
    let b = fb.get(fieldId);
    if (!b) {
      const f = fieldById.get(fieldId);
      b = { fieldId, fieldName: f?.name ?? "Field", acres: f?.acres ?? 0, products: [], work: [], productCost: 0, workTotal: 0 };
      fb.set(fieldId, b);
    }
    return b;
  };

  for (const t of input.transactions) {
    if (t.transactionType !== "expense" || t.isPersonalExcluded || t.isDuplicateExcluded) continue;
    const m = (t.description ?? "").match(/^(.*?) — allocated by usage \(/);
    if (!m) continue;
    for (const s of t.splits) {
      if (s.targetType !== "field" || !s.fieldId || !fieldById.has(s.fieldId)) continue;
      const used = parseUsed(s.notes);
      const b = fieldBill(s.fieldId);
      addProduct(b.products, m[1].trim(), used?.quantity ?? 0, used?.unit ?? "", s.allocatedAmount);
      b.productCost += s.allocatedAmount;
    }
  }

  for (const a of input.activities) {
    if (!a.fieldId || !fieldById.has(a.fieldId)) continue;
    const type = BILLABLE_WORK.some((w) => w.type === a.activityType) ? a.activityType : "other";
    const acres = a.acres ?? fieldById.get(a.fieldId)?.acres ?? 0;
    const b = fieldBill(a.fieldId);
    const r = rate.get(type) ?? 0;
    let w = b.work.find((x) => x.type === type);
    if (!w) { w = { type, label: label.get(type) ?? type, passes: 0, acres: 0, rate: r, amount: 0 }; b.work.push(w); }
    w.passes += 1; w.acres += acres; w.amount += acres * r;
    b.workTotal += acres * r;
  }

  const bills = new Map<string, GrowerBill>();
  for (const b of fb.values()) {
    const name = growerOf(b.fieldId);
    const g = settings.get(name.toLowerCase());
    let bill = bills.get(name);
    if (!bill) {
      bill = { grower: name, ownFarm: g?.ownFarm ?? false, markupPct: g?.markupPct ?? 0, fields: [], products: [], work: [],
        productCost: 0, markup: 0, productTotal: 0, workTotal: 0, total: 0 };
      bills.set(name, bill);
    }
    bill.fields.push(b);
    for (const p of b.products) addProduct(bill.products, p.productName, p.quantity, p.unit, p.cost);
    for (const w of b.work) {
      const x = bill.work.find((y) => y.type === w.type);
      if (x) { x.passes += w.passes; x.acres += w.acres; x.amount += w.amount; } else bill.work.push({ ...w });
    }
    bill.productCost += b.productCost;
    bill.workTotal += b.workTotal;
  }

  for (const bill of bills.values()) {
    if (bill.ownFarm) { bill.markupPct = 0; bill.workTotal = 0; for (const w of bill.work) { w.rate = 0; w.amount = 0; } }
    bill.productCost = r2(bill.productCost);
    bill.markup = r2(bill.productCost * (bill.markupPct / 100));
    bill.productTotal = r2(bill.productCost + bill.markup);
    bill.workTotal = r2(bill.workTotal);
    bill.total = r2(bill.productTotal + bill.workTotal);
    bill.products.sort((a, b) => b.cost - a.cost);
    bill.work.sort((a, b) => a.label.localeCompare(b.label));
    bill.fields.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
  }
  // Growers you bill first (biggest bill first), then your own farm, then fields with no grower.
  return [...bills.values()].sort((a, b) =>
    (a.grower === UNASSIGNED ? 2 : a.ownFarm ? 1 : 0) - (b.grower === UNASSIGNED ? 2 : b.ownFarm ? 1 : 0) || b.total - a.total);
}
