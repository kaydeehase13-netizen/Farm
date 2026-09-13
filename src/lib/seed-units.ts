/**
 * Seed is bought and priced by the "unit" (bag) — a fixed seed count that's
 * different for every crop — but the seeding rate logged/imported per field
 * is a population (seeds per acre), so seedingRate * acres gives a raw seed
 * count, not a bag count. Treating that raw seed count as if it were
 * already in "units" massively overstates usage (and, anywhere a report
 * divides a dollar total by that quantity to show a per-unit cost, the
 * cost) — a soybean field using 700,000 seeds is 5 units of seed, not
 * 700,000. This converts back to units using each crop's standard bag
 * size, keyed off the seed product name (AgFiniti imports/labels planting
 * activities by crop — "Soybeans (mixed varieties)", "Corn (mixed
 * varieties)", etc — rather than a specific branded product), per Kaydee's
 * own bag sizes for her farm.
 */
const SEEDS_PER_UNIT: { match: RegExp; seedsPerUnit: number }[] = [
  { match: /soy ?bean/i, seedsPerUnit: 140_000 },
  { match: /\bcorn\b/i, seedsPerUnit: 80_000 },
  { match: /sorghum|milo/i, seedsPerUnit: 750_000 },
];

/** Returns the seed count per unit (bag) for a seed product name, or undefined if the crop isn't recognized. */
export function seedsPerUnitFor(seedProductName: string | undefined | null): number | undefined {
  if (!seedProductName) return undefined;
  return SEEDS_PER_UNIT.find((c) => c.match.test(seedProductName))?.seedsPerUnit;
}

/**
 * Converts a raw seed count (seedingRate * acres) into a bag/unit count
 * when the crop is recognized, alongside the right unit label to show —
 * "units" only when it's actually been converted to bags, otherwise "seeds"
 * so a raw count is never mislabeled as something it isn't.
 */
export function seedQuantityInUnits(seedProductName: string | undefined | null, rawSeedCount: number | undefined): { quantity: number | undefined; unit: string } {
  const perUnit = seedsPerUnitFor(seedProductName);
  if (rawSeedCount == null) return { quantity: undefined, unit: perUnit ? "units" : "seeds" };
  return perUnit ? { quantity: rawSeedCount / perUnit, unit: "units" } : { quantity: rawSeedCount, unit: "seeds" };
}
