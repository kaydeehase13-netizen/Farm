import type { Asset } from "@/types/domain";

/**
 * Simple straight-line depreciation, for a quick at-a-glance estimate on the
 * Equipment page — not a substitute for the CPA's actual Section 179 / MACRS
 * elections on the tax return. Requires purchasePrice and usefulLifeYears;
 * everything else is optional and defaults sensibly.
 */
export function straightLineDepreciation(asset: Asset, asOf: Date = new Date()) {
  const cost = asset.purchasePrice ?? 0;
  const life = asset.usefulLifeYears ?? 0;
  const salvage = asset.salvageValue ?? 0;
  const depreciableBase = Math.max(cost - salvage, 0);

  if (!(cost > 0) || !(life > 0)) {
    return { annualDepreciation: 0, accumulatedDepreciation: 0, bookValue: cost, yearsInService: 0 };
  }

  const placedInService = asset.placedInServiceDate ?? asset.purchaseDate;
  const startDate = placedInService ? new Date(placedInService) : asOf;
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsInService = Math.max((asOf.getTime() - startDate.getTime()) / msPerYear, 0);

  const annualDepreciation = depreciableBase / life;
  const accumulatedDepreciation = Math.min(annualDepreciation * yearsInService, depreciableBase);
  const bookValue = cost - accumulatedDepreciation;

  return { annualDepreciation, accumulatedDepreciation, bookValue, yearsInService };
}
