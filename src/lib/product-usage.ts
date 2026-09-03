import type { Activity } from "@/types/domain";

/** Every distinct product name used anywhere across field activities, any year. */
export function distinctProductNames(activities: Activity[]): string[] {
  const names = new Set<string>();
  for (const a of activities) {
    for (const p of a.sprayProducts ?? []) if (p.productName) names.add(p.productName);
    for (const p of a.fertilizerProducts ?? []) if (p.productName) names.add(p.productName);
    if (a.seedProductName) names.add(a.seedProductName);
  }
  return Array.from(names).sort();
}

/**
 * Every distinct (year, product) combo actually logged on field activities —
 * i.e. exactly the list of things that still need a real dollar amount
 * allocated to them. Sorted newest year first, then product name.
 */
export function distinctProductUsageByYear(activities: Activity[]): { year: number; productName: string }[] {
  const seen = new Map<string, { year: number; productName: string }>();
  for (const a of activities) {
    const year = Number(a.activityDate?.slice(0, 4));
    if (!year) continue;
    const add = (productName?: string) => {
      if (!productName) return;
      const key = `${year}::${productName.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { year, productName });
    };
    for (const p of a.sprayProducts ?? []) add(p.productName);
    for (const p of a.fertilizerProducts ?? []) add(p.productName);
    add(a.seedProductName);
  }
  return Array.from(seen.values()).sort((a, b) => b.year - a.year || a.productName.localeCompare(b.productName));
}
