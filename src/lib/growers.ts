export interface Grower {
  id?: string;
  name: string;
  ownFarm: boolean;
  suppliesOwnInputs: boolean;
  markupPct: number;
}

export type RateUnit = "acre" | "hour";

export interface BillingRate {
  activityType: string;
  /** $ per acre, or $ per hour when unit is "hour". */
  ratePerAcre: number;
  unit?: RateUnit;
}

/** Hours worked for a grower on an hourly job (harvest) in a year. */
export interface BillingHours {
  year: number;
  grower: string;
  activityType: string;
  hours: number;
}

/** Harvest is billed by the hour; everything else by the acre, unless changed. */
export function defaultUnit(type: string): RateUnit {
  return type === "harvest" ? "hour" : "acre";
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
