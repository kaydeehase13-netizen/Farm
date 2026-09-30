/**
 * Tank-mix math: how many loads a job takes and exactly what goes in each
 * one. Pure functions, no I/O, so the page and tests share one source of
 * truth.
 *
 * Every load is sized to the acres it actually covers: full loads use the
 * whole tank (tank gal / carrier GPA acres), and the last load, when the
 * acres don't divide evenly, gets only what's left instead of a full
 * batch. "even" spreads the job over the same number of loads in equal
 * parts instead.
 */

export type RateUnit =
  | "fl oz/ac" | "pt/ac" | "qt/ac" | "gal/ac"
  | "oz/ac" | "lb/ac"
  | "fl oz/100 gal" | "pt/100 gal" | "qt/100 gal" | "gal/100 gal" | "lb/100 gal"
  | "% v/v";

export const RATE_UNITS: RateUnit[] = [
  "fl oz/ac", "pt/ac", "qt/ac", "gal/ac", "oz/ac", "lb/ac",
  "fl oz/100 gal", "pt/100 gal", "qt/100 gal", "gal/100 gal", "lb/100 gal", "% v/v",
];

type Kind = "liquid" | "dry";
type Basis = "acre" | "per100" | "vv";

/** Liquid amounts are kept in fluid ounces, dry amounts in ounces (weight). */
const UNIT_INFO: Record<RateUnit, { kind: Kind; basis: Basis; perBase: number }> = {
  "fl oz/ac": { kind: "liquid", basis: "acre", perBase: 1 },
  "pt/ac": { kind: "liquid", basis: "acre", perBase: 16 },
  "qt/ac": { kind: "liquid", basis: "acre", perBase: 32 },
  "gal/ac": { kind: "liquid", basis: "acre", perBase: 128 },
  "oz/ac": { kind: "dry", basis: "acre", perBase: 1 },
  "lb/ac": { kind: "dry", basis: "acre", perBase: 16 },
  "fl oz/100 gal": { kind: "liquid", basis: "per100", perBase: 1 },
  "pt/100 gal": { kind: "liquid", basis: "per100", perBase: 16 },
  "qt/100 gal": { kind: "liquid", basis: "per100", perBase: 32 },
  "gal/100 gal": { kind: "liquid", basis: "per100", perBase: 128 },
  "lb/100 gal": { kind: "dry", basis: "per100", perBase: 16 },
  "% v/v": { kind: "liquid", basis: "vv", perBase: 128 },
};

export function isRateUnit(u: string | undefined | null): u is RateUnit {
  return !!u && (RATE_UNITS as string[]).includes(u);
}

export interface MixProduct {
  name: string;
  rate: number;
  unit: RateUnit;
  epaRegistrationNumber?: string;
  restrictedUse?: boolean;
}

export interface MixInput {
  acres: number;
  tankGallons: number;
  carrierGpa: number;
  products: MixProduct[];
  mode?: "full" | "even";
}

export interface ProductAmount {
  name: string;
  kind: Kind;
  /** fl oz for liquids, oz (weight) for dry. */
  baseAmount: number;
  display: string;
}

export interface Load {
  number: number;
  acres: number;
  /** Total spray volume in the tank for this load (carrier + product). */
  gallons: number;
  partial: boolean;
  products: ProductAmount[];
  /** Water to add: load volume minus the liquid products going in. */
  waterGallons: number;
}

export interface MixResult {
  acresPerFullLoad: number;
  loads: Load[];
  /** Consecutive identical loads collapsed ("Loads 1-4") for display. */
  groups: { from: number; to: number; load: Load }[];
  totals: ProductAmount[];
  totalGallons: number;
  errors: string[];
}

export function amountFor(p: MixProduct, acres: number, gallons: number): number {
  const info = UNIT_INFO[p.unit];
  if (!info || !(p.rate > 0)) return 0;
  if (info.basis === "acre") return p.rate * info.perBase * acres;
  if (info.basis === "per100") return p.rate * info.perBase * (gallons / 100);
  return (p.rate / 100) * gallons * info.perBase; // % v/v -> fl oz
}

function round(n: number, places = 2) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** "2 gal 1 qt 4.5 fl oz" for liquids, "3 lb 6.4 oz" for dry. */
export function formatAmount(kind: Kind, base: number): string {
  if (!(base > 0)) return "0";
  if (kind === "dry") {
    const lb = Math.floor(base / 16 + 1e-9);
    const oz = round(base - lb * 16, 1);
    if (lb === 0) return `${oz} oz`;
    return oz > 0 ? `${lb} lb ${oz} oz` : `${lb} lb`;
  }
  const gal = Math.floor(base / 128 + 1e-9);
  let rest = base - gal * 128;
  const qt = Math.floor(rest / 32 + 1e-9);
  rest = round(rest - qt * 32, 1);
  const parts: string[] = [];
  if (gal) parts.push(`${gal} gal`);
  if (qt) parts.push(`${qt} qt`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest} fl oz`);
  return parts.join(" ");
}

/** A plain secondary figure to go with formatAmount: "292.5 fl oz" / "3.4 lb". */
export function formatPlain(kind: Kind, base: number): string {
  return kind === "dry" ? `${round(base / 16, 2)} lb` : `${round(base, 1)} fl oz`;
}

function productAmounts(products: MixProduct[], acres: number, gallons: number): ProductAmount[] {
  return products.map((p) => {
    const kind = UNIT_INFO[p.unit]?.kind ?? "liquid";
    const baseAmount = amountFor(p, acres, gallons);
    return { name: p.name, kind, baseAmount, display: formatAmount(kind, baseAmount) };
  });
}

function makeLoad(number: number, acres: number, input: MixInput, partial: boolean): Load {
  const gallons = acres * input.carrierGpa;
  const products = productAmounts(input.products, acres, gallons);
  const liquidGal = products.filter((p) => p.kind === "liquid").reduce((s, p) => s + p.baseAmount / 128, 0);
  return {
    number, acres: round(acres, 2), gallons: round(gallons, 1), partial, products,
    waterGallons: round(Math.max(0, gallons - liquidGal), 1),
  };
}

export function calculateMix(input: MixInput): MixResult {
  const errors: string[] = [];
  if (!(input.acres > 0)) errors.push("Enter the acres to spray.");
  if (!(input.tankGallons > 0)) errors.push("Enter the tank size.");
  if (!(input.carrierGpa > 0)) errors.push("Enter the carrier rate (GPA).");
  if (input.carrierGpa > 0 && input.tankGallons > 0 && input.carrierGpa > input.tankGallons) {
    errors.push("The carrier rate is more than the whole tank covers per acre.");
  }
  const empty: MixResult = { acresPerFullLoad: 0, loads: [], groups: [], totals: [], totalGallons: 0, errors };
  if (errors.length) return empty;

  const perLoad = input.tankGallons / input.carrierGpa;
  const loads: Load[] = [];
  if (input.mode === "even") {
    const count = Math.max(1, Math.ceil(input.acres / perLoad - 1e-9));
    for (let i = 1; i <= count; i++) loads.push(makeLoad(i, input.acres / count, input, false));
  } else {
    const full = Math.floor(input.acres / perLoad + 1e-9);
    for (let i = 1; i <= full; i++) loads.push(makeLoad(i, perLoad, input, false));
    const left = input.acres - full * perLoad;
    if (left > 0.005) loads.push(makeLoad(full + 1, left, input, true));
  }

  const groups: MixResult["groups"] = [];
  for (const l of loads) {
    const last = groups[groups.length - 1];
    if (last && !l.partial && !last.load.partial && Math.abs(last.load.acres - l.acres) < 0.005) last.to = l.number;
    else groups.push({ from: l.number, to: l.number, load: l });
  }

  const totalGallons = input.acres * input.carrierGpa;
  return {
    acresPerFullLoad: round(perLoad, 2),
    loads,
    groups,
    totals: productAmounts(input.products, input.acres, totalGallons),
    totalGallons: round(totalGallons, 1),
    errors,
  };
}

/**
 * Maps a rate unit as logged/imported on an activity ("oz/ac", "gal(US)/ac",
 * "Pt/Ac", ...) onto a calculator unit. Spray and liquid-fertilizer "oz/ac"
 * is read as fluid ounces. Returns undefined when it can't tell.
 */
export function normalizeRateUnit(raw: string | undefined | null): RateUnit | undefined {
  if (!raw) return undefined;
  const u = raw.toLowerCase().replace(/\(us\)/g, "").replace(/\s+/g, "").replace("acre", "ac").replace(/\.$/, "");
  const map: Record<string, RateUnit> = {
    "floz/ac": "fl oz/ac", "oz/ac": "fl oz/ac", "fl.oz/ac": "fl oz/ac",
    "pt/ac": "pt/ac", "pint/ac": "pt/ac", "pints/ac": "pt/ac",
    "qt/ac": "qt/ac", "quart/ac": "qt/ac", "quarts/ac": "qt/ac",
    "gal/ac": "gal/ac", "gpa": "gal/ac",
    "lb/ac": "lb/ac", "lbs/ac": "lb/ac",
    "ozwt/ac": "oz/ac", "drzoz/ac": "oz/ac",
    "%v/v": "% v/v", "%": "% v/v",
    "lb/100gal": "lb/100 gal", "floz/100gal": "fl oz/100 gal", "qt/100gal": "qt/100 gal", "pt/100gal": "pt/100 gal", "gal/100gal": "gal/100 gal",
  };
  return map[u];
}
