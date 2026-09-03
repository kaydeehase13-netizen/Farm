// Core domain types — mirror supabase/migrations/0001_core_schema.sql.
// Kept hand-written (not generated) so they stay readable; regenerate with
// `supabase gen types typescript` once a live project exists and reconcile.

export type UserRole =
  | "owner_admin" | "manager" | "employee" | "equipment_operator"
  | "applicator" | "bookkeeper" | "cpa";

export type OperationType =
  | "grain" | "row_crop" | "livestock" | "dairy" | "custom_application"
  | "hay_forage" | "mixed" | "other";

export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "needs_review" | "categorized" | "reconciled" | "excluded_personal";
export type SyncStatus = "saved_offline" | "syncing" | "synced" | "sync_error";
export type ActivityType =
  | "plant" | "spray" | "fertilize" | "harvest" | "till" | "disk" | "cultivate"
  | "bale" | "mow" | "irrigate" | "graze" | "scout" | "soil_sample" | "lime"
  | "manure" | "conservation" | "other";
export type FieldOwnership = "owned" | "rented_cash" | "rented_crop_share" | "rented_flex";
export type ProductCategory = "chemical" | "fertilizer" | "seed" | "feed" | "veterinary" | "fuel" | "parts_supplies" | "other";
export type ProductSource = "our_business" | "customer_supplied";
export type JobStatus = "scheduled" | "in_progress" | "completed" | "invoiced" | "paid" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
export type AssetType = "equipment" | "vehicle" | "building" | "land_improvement" | "other";
export type LivestockPurpose = "breeding" | "dairy" | "draft" | "resale" | "feeding_production" | "other";
export type DocumentCategory =
  | "receipt" | "invoice" | "tax" | "equipment" | "land" | "insurance"
  | "usda_fsa" | "chemical_label" | "sds" | "income" | "loan" | "contract"
  | "livestock" | "other";

export interface FarmBusiness {
  id: string;
  name: string;
  operationType: OperationType;
  state: string;
  county?: string;
  currentTaxYear: number;
}

export interface Field {
  id: string;
  farmBusinessId: string;
  name: string;
  acres: number;
  tillableAcres?: number;
  ownership: FieldOwnership;
  landownerName?: string;
  county?: string;
  fsaFarmNumber?: string;
  fsaTractNumber?: string;
  fsaFieldNumber?: string;
  irrigated: boolean;
  notes?: string;
}

export interface CropYear {
  id: string;
  fieldId: string;
  year: number;
  cropName?: string;
  plantedAcres?: number;
  actualYield?: number;
  yieldUnit?: string;
}

export interface Vendor { id: string; farmBusinessId: string; name: string; }

export interface FarmCategory { id: string; name: string; defaultTaxCategoryCode?: string; }

export interface TransactionSplit {
  id: string;
  transactionId: string;
  targetType: "field" | "customer_job" | "equipment" | "livestock_group" | "vehicle" | "general_overhead";
  fieldId?: string;
  cropYearId?: string;
  jobId?: string;
  equipmentAssetId?: string;
  allocationMethod: "acres" | "percentage" | "dollar_amount" | "quantity" | "manual";
  allocatedAmount: number;
  farmCategoryId?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  farmBusinessId: string;
  taxYear: number;
  transactionType: TransactionType;
  status: TransactionStatus;
  transactionDate: string; // ISO date
  vendorId?: string;
  vendorName?: string;
  customerId?: string;
  description?: string;
  amount: number;
  salesTax?: number;
  paymentMethod?: string;
  farmCategoryId?: string;
  taxCategoryCode?: string;
  receiptId?: string;
  isPersonalExcluded: boolean;
  cpaFlag: boolean;
  cpaNote?: string;
  syncStatus: SyncStatus;
  splits: TransactionSplit[];
  createdAt: string;
}

export interface Receipt {
  id: string;
  farmBusinessId: string;
  fileName: string;
  fileDataUrl?: string; // demo-mode inline storage
  captureSource: "mobile_camera" | "web_upload" | "web_drag_drop";
  ocrStatus: "pending" | "processed" | "confirmed" | "failed";
  ocrVendorGuess?: string;
  ocrDateGuess?: string;
  ocrAmountGuess?: number;
  ocrTaxGuess?: number;
  ocrLineItems?: { description: string; amount: number; suggestedCategory?: string }[];
  confirmedAt?: string;
  linkedTransactionId?: string;
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface Product {
  id: string;
  farmBusinessId: string;
  category: ProductCategory;
  name: string;
  epaRegistrationNumber?: string;
  defaultUnit: string;
}

export interface InventoryItem {
  id: string;
  farmBusinessId: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  unit: string;
  quantityOnHand: number;
  averageUnitCost: number;
  reorderThreshold?: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  movementType: "purchase" | "use_own_field" | "use_customer_job" | "adjustment" | "waste_loss" | "transfer";
  quantity: number;
  unitCost?: number;
  relatedTransactionId?: string;
  relatedActivityId?: string;
  relatedJobId?: string;
  note?: string;
  createdAt: string;
}

export interface SprayProductLine {
  productId: string;
  productName: string;
  rate: number;
  rateUnit: string;
  quantityUsed: number;
  quantityUnit: string;
  epaRegistrationNumber?: string;
}

export interface Activity {
  id: string;
  farmBusinessId: string;
  activityType: ActivityType;
  fieldId?: string;
  fieldName?: string;
  customerFieldId?: string;
  customerFieldName?: string;
  customerId?: string;
  jobId?: string;
  cropYearId?: string;
  activityDate: string;
  startTime?: string;
  endTime?: string;
  acres?: number;
  equipmentAssetId?: string;
  operatorName?: string;
  applicatorName?: string;
  applicatorCertification?: string;
  carrier?: string;
  carrierRate?: number;
  tankMixNotes?: string;
  sprayProducts?: SprayProductLine[];
  seedProductName?: string;
  seedingRate?: number;
  fertilizerProducts?: { productName: string; rate: number; rateUnit: string; quantityUsed: number; quantityUnit: string }[];
  yieldAmount?: number;
  yieldUnit?: string;
  moisturePct?: number;
  notes?: string;
  weather?: { temp?: number; windSpeed?: number; windDirection?: string; humidity?: number; conditions?: string };
  syncStatus: SyncStatus;
  createdAt: string;
}

export interface Customer {
  id: string;
  farmBusinessId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  billingAddress?: string;
  balanceDue: number;
}

export interface CustomerField {
  id: string;
  customerId: string;
  name: string;
  acres?: number;
  county?: string;
}

export interface Job {
  id: string;
  farmBusinessId: string;
  customerId: string;
  customerName: string;
  customerFieldId?: string;
  customerFieldName?: string;
  jobService: string;
  status: JobStatus;
  scheduledDate?: string;
  completedDate?: string;
  acres?: number;
  rate?: number;
  rateUnit: "per_acre" | "flat" | "per_hour";
  productSource: ProductSource;
  directCost: number;
  revenue: number;
  notes?: string;
  invoiceId?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
  jobId?: string;
}

export interface Invoice {
  id: string;
  farmBusinessId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate?: string;
  lines: InvoiceLine[];
  subtotal: number;
  additionalCharges: number;
  total: number;
  amountPaid: number;
  sentAt?: string;
}

export interface Payment {
  id: string;
  farmBusinessId: string;
  invoiceId?: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
}

export interface Asset {
  id: string;
  farmBusinessId: string;
  assetType: AssetType;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  placedInServiceDate?: string;
  businessUsePercent: number;
  status: "active" | "sold" | "traded" | "retired";
  soldDate?: string;
  soldPrice?: number;
  notes?: string;
}

export interface AssetRepair {
  id: string;
  assetId: string;
  repairDate: string;
  description: string;
  cost?: number;
  odometerOrHours?: number;
}

export interface MileageTrip {
  id: string;
  farmBusinessId: string;
  vehicleAssetId: string;
  vehicleName: string;
  tripDate: string;
  miles: number;
  purpose?: string;
  fieldId?: string;
  customerId?: string;
  jobId?: string;
  source: "manual" | "gps";
}

export interface LivestockGroup {
  id: string;
  farmBusinessId: string;
  name: string;
  species: string;
  purpose: LivestockPurpose;
  headCount: number;
  notes?: string;
}

export interface LivestockTransaction {
  id: string;
  livestockGroupId: string;
  txnType: "purchase" | "sale" | "birth" | "death_loss" | "transfer_in" | "transfer_out";
  txnDate: string;
  headCount: number;
  totalAmount?: number;
  weightLbs?: number;
  notes?: string;
}

export interface Loan {
  id: string;
  farmBusinessId: string;
  lenderName: string;
  originalPrincipal?: number;
  originationDate?: string;
  interestRate?: number;
  termMonths?: number;
  currentBalance?: number;
  notes?: string;
}

export interface DocumentRecord {
  id: string;
  farmBusinessId: string;
  category: DocumentCategory;
  fileName: string;
  fileDataUrl?: string;
  relatedFieldId?: string;
  relatedEquipmentAssetId?: string;
  tags: string[];
  createdAt: string;
}

export interface TaxOpportunity {
  id: string;
  farmBusinessId: string;
  taxYear: number;
  ruleTitle: string;
  ruleDescription: string;
  officialReference?: string;
  sourceTransactionId?: string;
  sourceAssetId?: string;
  sourceLivestockTxnId?: string;
  status: "open" | "info_needed" | "ready_for_cpa" | "dismissed";
  infoMissing: string[];
  documentsCollectedCount: number;
  createdAt: string;
}

export interface TaxQuestion {
  id: string;
  farmBusinessId: string;
  taxYear: number;
  question: string;
  raisedByName: string;
  status: "open" | "answered" | "reviewed" | "dismissed";
  cpaResponse?: string;
  createdAt: string;
}

export interface FieldProfitability {
  fieldId: string;
  fieldName: string;
  acres: number;
  cropName?: string;
  income: number;
  expenseSeed: number;
  expenseFertilizer: number;
  expenseChemical: number;
  expenseFuel: number;
  expenseRent: number;
  expenseInsurance: number;
  expenseCustomWork: number;
  expenseHarvest: number;
  expenseDrying: number;
  expenseTrucking: number;
  expenseOther: number;
  totalExpense: number;
  margin: number;
  incomePerAcre: number;
  expensePerAcre: number;
  marginPerAcre: number;
}
