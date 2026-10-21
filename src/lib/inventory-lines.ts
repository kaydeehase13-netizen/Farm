/**
 * Lines on an invoice that change what a product cost but aren't a product
 * you can have on hand: seed cash/volume discounts, Bayer LCR, credits,
 * rebates, finance charges, fees, tonnage tax, pallet/seed-pak rental.
 * They belong in the cost (they're already in the transaction amounts),
 * never as an inventory item.
 */
const COST_ONLY = /discount|\blcr\b|rebate|credit|refund|finance charge|\bfee\b|tonnage tax|sales tax|rental|deposit|freight|delivery|adjustment/i;

export function isCostOnlyLine(name: string | undefined | null): boolean {
  return !!name && COST_ONLY.test(name);
}
