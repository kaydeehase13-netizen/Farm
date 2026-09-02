/**
 * Canonical mapping of FarmLedger's tax categories to the official IRS
 * Schedule F (Form 1040), 2025 revision, line numbers.
 *
 * This is the single source of truth for category → line-number labels
 * shown in the app (CPA workbook export, category pickers, etc.). It
 * mirrors supabase/migrations/0004_fix_schedule_f_categories.sql, which
 * applies the same corrections to the live Supabase `tax_category` table
 * — keep the two in sync if either changes.
 *
 * Informational only — never a legal or tax determination. "Ask your tax
 * professional."
 */
export interface TaxCategoryDef {
  code: string;
  label: string;
  scheduleReference: string | null;
  type: "income" | "expense";
}

export const TAX_CATEGORIES: TaxCategoryDef[] = [
  { code: "income_sales_livestock_resale", label: "Sales of Purchased Livestock and Other Resale Items (Net)", scheduleReference: "Schedule F, Line 1c", type: "income" },
  { code: "income_sales_livestock_produce", label: "Sales of Livestock, Produce, Grains, and Other Products Raised", scheduleReference: "Schedule F, Line 2", type: "income" },
  { code: "income_coop_distributions", label: "Cooperative Distributions (Form 1099-PATR)", scheduleReference: "Schedule F, Line 3a", type: "income" },
  { code: "income_govt_payments", label: "Agricultural Program Payments", scheduleReference: "Schedule F, Line 4a", type: "income" },
  { code: "income_ccc_loans", label: "Commodity Credit Corporation (CCC) Loans", scheduleReference: "Schedule F, Line 5a", type: "income" },
  { code: "income_crop_insurance", label: "Crop Insurance Proceeds and Federal Crop Disaster Payments", scheduleReference: "Schedule F, Line 6a", type: "income" },
  { code: "income_custom_hire", label: "Custom Hire (Machine Work) Income", scheduleReference: "Schedule F, Line 7", type: "income" },
  { code: "income_other", label: "Other Farm Income", scheduleReference: "Schedule F, Line 8", type: "income" },
  { code: "exp_car_truck", label: "Car and Truck Expenses", scheduleReference: "Schedule F, Line 10", type: "expense" },
  { code: "exp_chemicals", label: "Chemicals", scheduleReference: "Schedule F, Line 11", type: "expense" },
  { code: "exp_conservation", label: "Conservation Expenses", scheduleReference: "Schedule F, Line 12", type: "expense" },
  { code: "exp_custom_hire", label: "Custom Hire (Machine Work)", scheduleReference: "Schedule F, Line 13", type: "expense" },
  { code: "exp_depreciation", label: "Depreciation and Section 179 Expense", scheduleReference: "Schedule F, Line 14", type: "expense" },
  { code: "exp_employee_benefits", label: "Employee Benefit Programs", scheduleReference: "Schedule F, Line 15", type: "expense" },
  { code: "exp_feed", label: "Feed", scheduleReference: "Schedule F, Line 16", type: "expense" },
  { code: "exp_fertilizer", label: "Fertilizers and Lime", scheduleReference: "Schedule F, Line 17", type: "expense" },
  { code: "exp_freight_trucking", label: "Freight and Trucking", scheduleReference: "Schedule F, Line 18", type: "expense" },
  { code: "exp_fuel", label: "Gasoline, Fuel, and Oil", scheduleReference: "Schedule F, Line 19", type: "expense" },
  { code: "exp_insurance", label: "Insurance (Other Than Health)", scheduleReference: "Schedule F, Line 20", type: "expense" },
  { code: "exp_interest_mortgage", label: "Interest — Mortgage (Paid to Banks, Etc.)", scheduleReference: "Schedule F, Line 21a", type: "expense" },
  { code: "exp_interest_other", label: "Interest — Other", scheduleReference: "Schedule F, Line 21b", type: "expense" },
  { code: "exp_labor_hired", label: "Labor Hired", scheduleReference: "Schedule F, Line 22", type: "expense" },
  { code: "exp_pension", label: "Pension and Profit-Sharing Plans", scheduleReference: "Schedule F, Line 23", type: "expense" },
  { code: "exp_rent_lease_equipment", label: "Rent/Lease — Vehicles, Machinery, Equipment", scheduleReference: "Schedule F, Line 24a", type: "expense" },
  { code: "exp_rent_lease_land", label: "Rent/Lease — Other (Land, Animals, Etc.)", scheduleReference: "Schedule F, Line 24b", type: "expense" },
  { code: "exp_repairs_maintenance", label: "Repairs and Maintenance", scheduleReference: "Schedule F, Line 25", type: "expense" },
  { code: "exp_seeds", label: "Seeds and Plants Purchased", scheduleReference: "Schedule F, Line 26", type: "expense" },
  { code: "exp_storage_warehousing", label: "Storage and Warehousing", scheduleReference: "Schedule F, Line 27", type: "expense" },
  { code: "exp_supplies", label: "Supplies", scheduleReference: "Schedule F, Line 28", type: "expense" },
  { code: "exp_taxes", label: "Taxes", scheduleReference: "Schedule F, Line 29", type: "expense" },
  { code: "exp_utilities", label: "Utilities", scheduleReference: "Schedule F, Line 30", type: "expense" },
  { code: "exp_vet_breeding_medicine", label: "Veterinary, Breeding, and Medicine", scheduleReference: "Schedule F, Line 31", type: "expense" },
  { code: "exp_other", label: "Other Expenses (Specify)", scheduleReference: "Schedule F, Line 32", type: "expense" },
  { code: "personal_excluded", label: "Personal / Not a Farm Expense", scheduleReference: null, type: "expense" },
];

export function taxCategoryMeta(code?: string): TaxCategoryDef | undefined {
  return TAX_CATEGORIES.find((c) => c.code === code);
}

export function taxCategoryLabel(code?: string): string {
  if (!code) return "Uncategorized";
  return taxCategoryMeta(code)?.label ?? code.replace(/^(exp|income)_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function taxCategoryScheduleRef(code?: string): string {
  return taxCategoryMeta(code)?.scheduleReference ?? "";
}
