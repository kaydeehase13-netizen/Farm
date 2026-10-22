export interface Grower {
  id?: string;
  name: string;
  ownFarm: boolean;
  suppliesOwnInputs: boolean;
  markupPct: number;
}

export interface BillingRate {
  activityType: string;
  ratePerAcre: number;
}

/** Job types that can carry a per-acre work charge, in the order shown. */
export const BILLABLE_WORK: { type: string; label: string }[] = [
  { type: "spray", label: "Spraying" },
  { type: "fertilize", label: "Fertilizing" },
  { type: "plant", label: "Planting" },
  { type: "harvest", label: "Harvest" },
  { type: "till", label: "Tillage" },
  { type: "disk", label: "Disking" },
  { type: "cultivate", label: "Cultivating" },
  { type: "bale", label: "Baling" },
  { type: "mow", label: "Mowing" },
  { type: "lime", label: "Lime" },
  { type: "manure", label: "Manure" },
  { type: "other", label: "Other" },
];

export const UNASSIGNED = "No grower set";
