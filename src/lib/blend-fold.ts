/**
 * 32 Thio is what Kanza mixes in each load: 32-0-0 + Thio + Kanza Humic.
 * The field passes logged those as separate lines (and sometimes 32-0-0 by
 * itself). Any pass that has 32-0-0 or 32 Thio on it is a 32 Thio pass, so
 * its 32-0-0, Thio and humic lines become one 32 Thio line. Humic or Thio
 * on a pass with no 32 on it is a different product and is left alone.
 */
export const BLEND_32 = "32 Thio";

export function is32Base(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "32-0-0" || n === "32%" || /^uan ?32$/.test(n) || n === "32 thio";
}
export function isThioPart(name: string): boolean {
  return /thio|12-0-0-26/i.test(name) && !/^\s*(28|32)\s*thio/i.test(name);
}
export function isHumicPart(name: string): boolean {
  return /humic/i.test(name);
}
export function isFoldPart(name: string): boolean {
  return is32Base(name) || isThioPart(name) || isHumicPart(name);
}

/** Pounds of a logged amount (gal at the product's weight per gallon). Null if it can't be converted. */
export function poundsOf(name: string, quantity: number, unit: string): number | null {
  const u = (unit ?? "").toLowerCase().replace(/\(us\)/g, "").replace(/\./g, "").trim();
  const perGal = isHumicPart(name) ? 9.6 : isThioPart(name) ? 11.1 : 11.06;
  if (["lb", "lbs", "pound", "pounds"].includes(u)) return quantity;
  if (["ton", "tons"].includes(u)) return quantity * 2000;
  if (["gal", "gallon", "gallons"].includes(u)) return quantity * perGal;
  if (["qt", "quart", "quarts"].includes(u)) return quantity * perGal / 4;
  if (["pt", "pint", "pints"].includes(u)) return quantity * perGal / 8;
  if (["oz", "fl oz", "floz"].includes(u)) return quantity * perGal / 128;
  return null;
}
