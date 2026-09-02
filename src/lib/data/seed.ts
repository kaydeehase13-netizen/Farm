import type {
  FarmBusiness, Field, CropYear, Vendor, FarmCategory, Transaction, Receipt,
  Product, InventoryItem, InventoryMovement, Activity, Customer, CustomerField,
  Job, Invoice, Payment, Asset, AssetRepair, MileageTrip, LivestockGroup,
  LivestockTransaction, Loan, DocumentRecord, TaxOpportunity, TaxQuestion,
} from "@/types/domain";

// Demo/seed dataset — "Mohler Farms", a Kansas grain / cattle / custom
// spraying operation, per the build spec's test-data section. This is the
// data new installs boot with in DEMO_MODE so every dashboard, report and
// export has something real to show immediately.

export const FARM: FarmBusiness = {
  id: "farm-mohler",
  name: "Mohler Farms",
  operationType: "mixed",
  state: "KS",
  county: "Reno County",
  currentTaxYear: 2026,
};

export const FIELDS: Field[] = [
  { id: "field-north80", farmBusinessId: FARM.id, name: "North 80", acres: 78.4, tillableAcres: 76.0, ownership: "owned", county: "Reno", fsaFarmNumber: "4821", fsaTractNumber: "1102", fsaFieldNumber: "1", irrigated: false, notes: "Rolling ground, terraced on the east side." },
  { id: "field-south160", farmBusinessId: FARM.id, name: "South 160", acres: 157, tillableAcres: 154, ownership: "owned", county: "Reno", fsaFarmNumber: "4821", fsaTractNumber: "1103", fsaFieldNumber: "1", irrigated: true, notes: "Center pivot, well #3." },
  { id: "field-home40", farmBusinessId: FARM.id, name: "Home 40", acres: 41, tillableAcres: 39.5, ownership: "owned", county: "Reno", fsaFarmNumber: "4821", fsaTractNumber: "1101", fsaFieldNumber: "1", irrigated: false },
  { id: "field-river80", farmBusinessId: FARM.id, name: "River 80", acres: 76, tillableAcres: 72, ownership: "rented_crop_share", landownerName: "Delbert Yoder", county: "Reno", irrigated: false, notes: "1/3-2/3 crop share with landowner." },
];

export const CROP_YEARS: CropYear[] = [
  { id: "cy-north80-2026", fieldId: "field-north80", year: 2026, cropName: "Corn", plantedAcres: 76.0, actualYield: 178, yieldUnit: "bu/ac" },
  { id: "cy-south160-2026", fieldId: "field-south160", year: 2026, cropName: "Corn", plantedAcres: 154, actualYield: 205, yieldUnit: "bu/ac" },
  { id: "cy-home40-2026", fieldId: "field-home40", year: 2026, cropName: "Milo", plantedAcres: 39.5, actualYield: 92, yieldUnit: "bu/ac" },
  { id: "cy-river80-2026", fieldId: "field-river80", year: 2026, cropName: "Soybeans", plantedAcres: 72, actualYield: 51, yieldUnit: "bu/ac" },
];

export const VENDORS: Vendor[] = [
  { id: "vendor-coop", farmBusinessId: FARM.id, name: "Reno County Co-op" },
  { id: "vendor-ts", farmBusinessId: FARM.id, name: "Tractor Supply Co." },
  { id: "vendor-jd", farmBusinessId: FARM.id, name: "Sunflower John Deere" },
  { id: "vendor-pioneer", farmBusinessId: FARM.id, name: "Pioneer Seed" },
  { id: "vendor-coop-fuel", farmBusinessId: FARM.id, name: "CHS Fuel" },
  { id: "vendor-elevator", farmBusinessId: FARM.id, name: "Hutchinson Grain Elevator" },
  { id: "vendor-insurance", farmBusinessId: FARM.id, name: "Rain and Hail Insurance" },
];

export const FARM_CATEGORIES: FarmCategory[] = [
  { id: "cat-seed", name: "Seed", defaultTaxCategoryCode: "exp_seeds" },
  { id: "cat-fert", name: "Fertilizer", defaultTaxCategoryCode: "exp_fertilizer" },
  { id: "cat-chem", name: "Chemical", defaultTaxCategoryCode: "exp_chemicals" },
  { id: "cat-fuel", name: "Fuel", defaultTaxCategoryCode: "exp_fuel" },
  { id: "cat-rent", name: "Rent", defaultTaxCategoryCode: "exp_rent_lease_land" },
  { id: "cat-ins", name: "Insurance", defaultTaxCategoryCode: "exp_insurance" },
  { id: "cat-custom", name: "Custom Work", defaultTaxCategoryCode: "exp_custom_hire" },
  { id: "cat-repairs", name: "Repairs & Maintenance", defaultTaxCategoryCode: "exp_repairs_maintenance" },
  { id: "cat-trucking", name: "Trucking", defaultTaxCategoryCode: "exp_freight_trucking" },
  { id: "cat-supplies", name: "Supplies", defaultTaxCategoryCode: "exp_supplies" },
  { id: "cat-other", name: "Other", defaultTaxCategoryCode: "exp_other" },
];

export const PRODUCTS: Product[] = [
  { id: "prod-roundup", farmBusinessId: FARM.id, category: "chemical", name: "Roundup PowerMAX", epaRegistrationNumber: "524-549", defaultUnit: "gal" },
  { id: "prod-24d", farmBusinessId: FARM.id, category: "chemical", name: "2,4-D Amine", epaRegistrationNumber: "62719-3", defaultUnit: "gal" },
  { id: "prod-urea", farmBusinessId: FARM.id, category: "fertilizer", name: "Urea 46-0-0", defaultUnit: "ton" },
  { id: "prod-map", farmBusinessId: FARM.id, category: "fertilizer", name: "MAP 11-52-0", defaultUnit: "ton" },
  { id: "prod-corn-seed", farmBusinessId: FARM.id, category: "seed", name: "Pioneer P1197AM", defaultUnit: "bag" },
  { id: "prod-milo-seed", farmBusinessId: FARM.id, category: "seed", name: "Pioneer 84P80", defaultUnit: "bag" },
  { id: "prod-diesel", farmBusinessId: FARM.id, category: "fuel", name: "Off-Road Diesel", defaultUnit: "gal" },
];

export const INVENTORY_ITEMS: InventoryItem[] = [
  { id: "inv-roundup", farmBusinessId: FARM.id, productId: "prod-roundup", productName: "Roundup PowerMAX", category: "chemical", unit: "gal", quantityOnHand: 142, averageUnitCost: 21.5, reorderThreshold: 50 },
  { id: "inv-24d", farmBusinessId: FARM.id, productId: "prod-24d", productName: "2,4-D Amine", category: "chemical", unit: "gal", quantityOnHand: 38, averageUnitCost: 14.75, reorderThreshold: 20 },
  { id: "inv-urea", farmBusinessId: FARM.id, productId: "prod-urea", productName: "Urea 46-0-0", category: "fertilizer", unit: "ton", quantityOnHand: 12.4, averageUnitCost: 512, reorderThreshold: 5 },
  { id: "inv-map", farmBusinessId: FARM.id, productId: "prod-map", productName: "MAP 11-52-0", category: "fertilizer", unit: "ton", quantityOnHand: 4.2, averageUnitCost: 640, reorderThreshold: 3 },
  { id: "inv-diesel", farmBusinessId: FARM.id, productId: "prod-diesel", productName: "Off-Road Diesel", category: "fuel", unit: "gal", quantityOnHand: 620, averageUnitCost: 3.19, reorderThreshold: 200 },
];

export const INVENTORY_MOVEMENTS: InventoryMovement[] = [
  { id: "mv-1", inventoryItemId: "inv-roundup", movementType: "purchase", quantity: 250, unitCost: 21.5, createdAt: "2026-03-02" },
  { id: "mv-2", inventoryItemId: "inv-roundup", movementType: "use_own_field", quantity: -68, relatedActivityId: "act-spray-north80", createdAt: "2026-05-14" },
  { id: "mv-3", inventoryItemId: "inv-roundup", movementType: "use_customer_job", quantity: -40, relatedJobId: "job-smith-1", createdAt: "2026-05-20" },
];

export const CUSTOMERS: Customer[] = [
  { id: "cust-smith", farmBusinessId: FARM.id, name: "Smith Farms", contactName: "Gary Smith", phone: "(620) 555-0142", email: "gary@smithfarmsks.com", balanceDue: 4280 },
];

export const CUSTOMER_FIELDS: CustomerField[] = [
  { id: "cf-westquarter", customerId: "cust-smith", name: "West Quarter", acres: 160, county: "Reno" },
];

export const ACTIVITIES: Activity[] = [
  {
    id: "act-plant-north80", farmBusinessId: FARM.id, activityType: "plant",
    fieldId: "field-north80", fieldName: "North 80", cropYearId: "cy-north80-2026",
    activityDate: "2026-04-18", acres: 76, seedProductName: "Pioneer P1197AM", seedingRate: 32000,
    notes: "Good soil moisture, 2.25\" depth.", syncStatus: "synced", createdAt: "2026-04-18T14:00:00Z",
  },
  {
    id: "act-spray-north80", farmBusinessId: FARM.id, activityType: "spray",
    fieldId: "field-north80", fieldName: "North 80", cropYearId: "cy-north80-2026",
    activityDate: "2026-05-14", startTime: "07:30", endTime: "09:10", acres: 76,
    applicatorName: "Kaydee", applicatorCertification: "KS-APPL-88213",
    carrier: "Water", carrierRate: 15, tankMixNotes: "Burndown ahead of planting-cycle spray.",
    sprayProducts: [{ productId: "prod-roundup", productName: "Roundup PowerMAX", rate: 32, rateUnit: "oz/ac", quantityUsed: 68, quantityUnit: "gal", epaRegistrationNumber: "524-549" }],
    weather: { temp: 71, windSpeed: 6, windDirection: "SW", humidity: 54, conditions: "Clear" },
    syncStatus: "synced", createdAt: "2026-05-14T09:15:00Z",
  },
  {
    id: "act-fert-south160", farmBusinessId: FARM.id, activityType: "fertilize",
    fieldId: "field-south160", fieldName: "South 160", cropYearId: "cy-south160-2026",
    activityDate: "2026-04-02", acres: 154,
    fertilizerProducts: [
      { productName: "Urea 46-0-0", rate: 180, rateUnit: "lb/ac", quantityUsed: 6.9, quantityUnit: "ton" },
      { productName: "MAP 11-52-0", rate: 60, rateUnit: "lb/ac", quantityUsed: 2.3, quantityUnit: "ton" },
    ],
    syncStatus: "synced", createdAt: "2026-04-02T11:00:00Z",
  },
  {
    id: "act-harvest-north80", farmBusinessId: FARM.id, activityType: "harvest",
    fieldId: "field-north80", fieldName: "North 80", cropYearId: "cy-north80-2026",
    activityDate: "2026-10-09", acres: 76, yieldAmount: 178, yieldUnit: "bu/ac", moisturePct: 15.2,
    syncStatus: "synced", createdAt: "2026-10-09T18:30:00Z",
  },
  {
    id: "act-spray-smith", farmBusinessId: FARM.id, activityType: "spray",
    customerFieldId: "cf-westquarter", customerFieldName: "West Quarter", customerId: "cust-smith",
    jobId: "job-smith-1", activityDate: "2026-05-20", startTime: "13:00", endTime: "16:45", acres: 160,
    applicatorName: "Kaydee", applicatorCertification: "KS-APPL-88213", carrier: "Water", carrierRate: 15,
    sprayProducts: [{ productId: "prod-roundup", productName: "Roundup PowerMAX", rate: 32, rateUnit: "oz/ac", quantityUsed: 40, quantityUnit: "gal", epaRegistrationNumber: "524-549" }],
    weather: { temp: 79, windSpeed: 9, windDirection: "S", humidity: 48, conditions: "Partly cloudy" },
    syncStatus: "synced", createdAt: "2026-05-20T17:00:00Z",
  },
];

export const JOBS: Job[] = [
  {
    id: "job-smith-1", farmBusinessId: FARM.id, customerId: "cust-smith", customerName: "Smith Farms",
    customerFieldId: "cf-westquarter", customerFieldName: "West Quarter", jobService: "Spraying",
    status: "invoiced", scheduledDate: "2026-05-20", completedDate: "2026-05-20", acres: 160,
    rate: 12.5, rateUnit: "per_acre", productSource: "our_business", directCost: 860, revenue: 2000,
    notes: "Roundup burndown, customer wanted done before rain Thursday.", invoiceId: "inv-smith-1001",
  },
];

export const INVOICES: Invoice[] = [
  {
    id: "inv-smith-1001", farmBusinessId: FARM.id, customerId: "cust-smith", customerName: "Smith Farms",
    invoiceNumber: "1001", status: "partial", issueDate: "2026-05-21", dueDate: "2026-06-20",
    lines: [
      { id: "il-1", description: "Custom spraying — West Quarter (160 ac @ $12.50/ac)", quantity: 160, unitRate: 12.5, amount: 2000, jobId: "job-smith-1" },
    ],
    subtotal: 2000, additionalCharges: 0, total: 2000, amountPaid: 500, sentAt: "2026-05-21T10:00:00Z",
  },
];

export const PAYMENTS: Payment[] = [
  { id: "pay-1", farmBusinessId: FARM.id, invoiceId: "inv-smith-1001", customerId: "cust-smith", amount: 500, paymentDate: "2026-06-01", paymentMethod: "Check #4471" },
];

export const ASSETS: Asset[] = [
  { id: "asset-jd8r", farmBusinessId: FARM.id, assetType: "equipment", name: "John Deere 8R 250", make: "John Deere", model: "8R 250", year: 2023, purchaseDate: "2023-02-14", purchasePrice: 385000, placedInServiceDate: "2023-03-01", businessUsePercent: 100, status: "active" },
  { id: "asset-sprayer", farmBusinessId: FARM.id, assetType: "equipment", name: "John Deere R4045 Sprayer", make: "John Deere", model: "R4045", year: 2021, purchaseDate: "2021-01-20", purchasePrice: 298000, placedInServiceDate: "2021-02-01", businessUsePercent: 100, status: "active" },
  { id: "asset-f350", farmBusinessId: FARM.id, assetType: "vehicle", name: "Ford F-350", make: "Ford", model: "F-350 Super Duty", year: 2022, purchaseDate: "2022-06-10", purchasePrice: 68500, placedInServiceDate: "2022-06-15", businessUsePercent: 85, status: "active" },
];

export const ASSET_REPAIRS: AssetRepair[] = [
  { id: "rep-1", assetId: "asset-sprayer", repairDate: "2026-05-11", description: "Boom section valve replacement", cost: 640, odometerOrHours: 1120 },
  { id: "rep-2", assetId: "asset-jd8r", repairDate: "2026-04-01", description: "Spring service — oil, filters, hydraulic fluid", cost: 1180, odometerOrHours: 890 },
];

export const MILEAGE_TRIPS: MileageTrip[] = [
  { id: "mi-1", farmBusinessId: FARM.id, vehicleAssetId: "asset-f350", vehicleName: "Ford F-350", tripDate: "2026-05-20", miles: 34, purpose: "Delivered spray equipment to West Quarter", customerId: "cust-smith", jobId: "job-smith-1", source: "manual" },
  { id: "mi-2", farmBusinessId: FARM.id, vehicleAssetId: "asset-f350", vehicleName: "Ford F-350", tripDate: "2026-03-02", miles: 18, purpose: "Parts run — Sunflower John Deere", source: "manual" },
];

export const LIVESTOCK_GROUPS: LivestockGroup[] = [
  { id: "lg-cowcalf", farmBusinessId: FARM.id, name: "Cow-Calf Herd", species: "cattle", purpose: "breeding", headCount: 42, notes: "Angus/SimAngus cross" },
];

export const LIVESTOCK_TXNS: LivestockTransaction[] = [
  { id: "lt-1", livestockGroupId: "lg-cowcalf", txnType: "sale", txnDate: "2026-03-15", headCount: 8, totalAmount: 14200, weightLbs: 5680 },
];

export const LOANS: Loan[] = [
  { id: "loan-op", farmBusinessId: FARM.id, lenderName: "Farm Credit Services of America", originalPrincipal: 240000, originationDate: "2025-01-15", interestRate: 6.75, termMonths: 12, currentBalance: 118000, notes: "Operating line of credit" },
  { id: "loan-jd8r", farmBusinessId: FARM.id, lenderName: "John Deere Financial", originalPrincipal: 300000, originationDate: "2023-02-14", interestRate: 5.9, termMonths: 84, currentBalance: 214000, notes: "8R 250 tractor loan" },
];

export const DOCUMENTS: DocumentRecord[] = [
  { id: "doc-1", farmBusinessId: FARM.id, category: "chemical_label", fileName: "roundup-powermax-label.pdf", tags: ["Roundup", "label"], createdAt: "2026-01-05T00:00:00Z" },
  { id: "doc-2", farmBusinessId: FARM.id, category: "insurance", fileName: "2026-crop-insurance-policy.pdf", tags: ["crop insurance"], createdAt: "2026-02-10T00:00:00Z" },
];

export const TRANSACTIONS: Transaction[] = [
  {
    id: "txn-1", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "categorized",
    transactionDate: "2026-03-02", vendorId: "vendor-coop", vendorName: "Reno County Co-op",
    description: "Roundup PowerMAX — 250 gal", amount: 5375, salesTax: 0, paymentMethod: "Farm Credit Card",
    farmCategoryId: "cat-chem", taxCategoryCode: "exp_chemicals", isPersonalExcluded: false, cpaFlag: false,
    syncStatus: "synced", createdAt: "2026-03-02T09:00:00Z",
    splits: [
      { id: "sp-1a", transactionId: "txn-1", targetType: "field", fieldId: "field-north80", allocationMethod: "quantity", allocatedAmount: 1462, farmCategoryId: "cat-chem" },
      { id: "sp-1b", transactionId: "txn-1", targetType: "customer_job", jobId: "job-smith-1", allocationMethod: "quantity", allocatedAmount: 860, farmCategoryId: "cat-chem" },
      { id: "sp-1c", transactionId: "txn-1", targetType: "general_overhead", allocationMethod: "manual", allocatedAmount: 3053, farmCategoryId: "cat-chem", notes: "Remaining inventory, not yet applied." },
    ],
  },
  {
    id: "txn-2", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "categorized",
    transactionDate: "2026-04-02", vendorId: "vendor-coop", vendorName: "Reno County Co-op",
    description: "Urea + MAP fertilizer blend", amount: 8110.80, farmCategoryId: "cat-fert", taxCategoryCode: "exp_fertilizer",
    isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced", createdAt: "2026-04-02T10:00:00Z",
    splits: [{ id: "sp-2a", transactionId: "txn-2", targetType: "field", fieldId: "field-south160", allocationMethod: "manual", allocatedAmount: 8110.80, farmCategoryId: "cat-fert" }],
  },
  {
    id: "txn-3", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "needs_review",
    transactionDate: "2026-06-11", vendorId: "vendor-ts", vendorName: "Tractor Supply Co.",
    description: "Fence posts, mineral tubs, work gloves", amount: 412.37, farmCategoryId: "cat-supplies",
    taxCategoryCode: "exp_supplies", isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced",
    createdAt: "2026-06-11T15:20:00Z",
    splits: [{ id: "sp-3a", transactionId: "txn-3", targetType: "general_overhead", allocationMethod: "manual", allocatedAmount: 412.37, farmCategoryId: "cat-supplies", notes: "Split pending: fence posts / mineral / gloves." }],
  },
  {
    id: "txn-4", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "categorized",
    transactionDate: "2026-02-14", vendorId: "vendor-jd", vendorName: "Sunflower John Deere",
    description: "John Deere 8R 250 — tractor purchase", amount: 385000, farmCategoryId: "cat-other",
    taxCategoryCode: "exp_depreciation", isPersonalExcluded: false, cpaFlag: true,
    cpaNote: "Section 179 / bonus depreciation review needed.", syncStatus: "synced", createdAt: "2026-02-14T12:00:00Z",
    splits: [{ id: "sp-4a", transactionId: "txn-4", targetType: "equipment", equipmentAssetId: "asset-jd8r", allocationMethod: "manual", allocatedAmount: 385000, farmCategoryId: "cat-other" }],
  },
  {
    id: "txn-5", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "income", status: "categorized",
    transactionDate: "2026-10-15", vendorId: "vendor-elevator", vendorName: "Hutchinson Grain Elevator",
    description: "Corn sale — North 80, 178 bu/ac x 76 ac", amount: 61864, farmCategoryId: "cat-other",
    taxCategoryCode: "income_sales_livestock_produce", isPersonalExcluded: false, cpaFlag: false,
    syncStatus: "synced", createdAt: "2026-10-15T16:00:00Z",
    splits: [{ id: "sp-5a", transactionId: "txn-5", targetType: "field", fieldId: "field-north80", allocationMethod: "manual", allocatedAmount: 61864, farmCategoryId: "cat-other" }],
  },
  {
    id: "txn-6", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "income", status: "categorized",
    transactionDate: "2026-06-01", customerId: "cust-smith", description: "Payment — Invoice #1001",
    amount: 500, farmCategoryId: "cat-custom", taxCategoryCode: "income_custom_hire", isPersonalExcluded: false,
    cpaFlag: false, syncStatus: "synced", createdAt: "2026-06-01T09:00:00Z",
    splits: [{ id: "sp-6a", transactionId: "txn-6", targetType: "customer_job", jobId: "job-smith-1", allocationMethod: "manual", allocatedAmount: 500, farmCategoryId: "cat-custom" }],
  },
  {
    id: "txn-7", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "needs_review",
    transactionDate: "2026-07-22", vendorId: "vendor-coop-fuel", vendorName: "CHS Fuel",
    description: "Off-road diesel, 620 gal", amount: 1977.80, farmCategoryId: "cat-fuel", taxCategoryCode: "exp_fuel",
    isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced", createdAt: "2026-07-22T08:00:00Z",
    splits: [{ id: "sp-7a", transactionId: "txn-7", targetType: "general_overhead", allocationMethod: "manual", allocatedAmount: 1977.80, farmCategoryId: "cat-fuel" }],
  },
  {
    id: "txn-8", farmBusinessId: FARM.id, taxYear: 2026, transactionType: "expense", status: "categorized",
    transactionDate: "2026-05-11", vendorId: "vendor-jd", vendorName: "Sunflower John Deere",
    description: "Sprayer boom section valve", amount: 640, farmCategoryId: "cat-repairs", taxCategoryCode: "exp_repairs_maintenance",
    isPersonalExcluded: false, cpaFlag: false, syncStatus: "synced", createdAt: "2026-05-11T13:00:00Z",
    splits: [{ id: "sp-8a", transactionId: "txn-8", targetType: "equipment", equipmentAssetId: "asset-sprayer", allocationMethod: "manual", allocatedAmount: 640, farmCategoryId: "cat-repairs" }],
  },
];

export const RECEIPTS: Receipt[] = [
  {
    id: "rec-1", farmBusinessId: FARM.id, fileName: "coop-receipt-0302.jpg", captureSource: "mobile_camera",
    ocrStatus: "confirmed", ocrVendorGuess: "Reno County Co-op", ocrDateGuess: "2026-03-02", ocrAmountGuess: 5375,
    linkedTransactionId: "txn-1", confirmedAt: "2026-03-02T09:05:00Z", syncStatus: "synced", createdAt: "2026-03-02T09:00:00Z",
  },
  {
    id: "rec-2", farmBusinessId: FARM.id, fileName: "ts-receipt-0611.jpg", captureSource: "mobile_camera",
    ocrStatus: "processed", ocrVendorGuess: "Tractor Supply Co.", ocrDateGuess: "2026-06-11", ocrAmountGuess: 412.37,
    ocrLineItems: [
      { description: "T-posts (25ct)", amount: 187.5, suggestedCategory: "Supplies" },
      { description: "Redmond mineral tub", amount: 148.87, suggestedCategory: "Veterinary & Medicine" },
      { description: "Work gloves x3", amount: 76, suggestedCategory: "Supplies" },
    ],
    linkedTransactionId: "txn-3", syncStatus: "synced", createdAt: "2026-06-11T15:18:00Z",
  },
];

export const TAX_OPPORTUNITIES: TaxOpportunity[] = [
  {
    id: "to-1", farmBusinessId: FARM.id, taxYear: 2026, ruleTitle: "Section 179 / Bonus Depreciation Review",
    ruleDescription: "A farm equipment purchase may be eligible for accelerated expensing. Elections and limits change by tax year.",
    officialReference: "https://www.irs.gov/forms-pubs/about-publication-225", sourceTransactionId: "txn-4",
    sourceAssetId: "asset-jd8r", status: "ready_for_cpa", infoMissing: [], documentsCollectedCount: 1,
    createdAt: "2026-02-14T12:05:00Z",
  },
  {
    id: "to-2", farmBusinessId: FARM.id, taxYear: 2026, ruleTitle: "Breeding Livestock Capital Gain Treatment",
    ruleDescription: "Sale of breeding livestock held for the required period may qualify for different tax treatment than resale stock.",
    officialReference: "https://www.irs.gov/forms-pubs/about-publication-225", status: "info_needed",
    infoMissing: ["Original acquisition date for sold head", "Whether animals were raised or purchased"],
    documentsCollectedCount: 0, createdAt: "2026-03-15T00:00:00Z",
  },
];

export const TAX_QUESTIONS: TaxQuestion[] = [
  { id: "tq-1", farmBusinessId: FARM.id, taxYear: 2026, question: "Should the West Quarter custom spraying revenue be reported net of the chemical we supplied, or gross with the chemical as a separate expense?", raisedByName: "Kaydee", status: "open", createdAt: "2026-05-22T00:00:00Z" },
];
