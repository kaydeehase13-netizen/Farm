import fs from "node:fs";
import path from "node:path";
import * as seed from "./seed";
import type {
  Field, CropYear, Vendor, FarmCategory, Transaction, Receipt, Product,
  InventoryItem, InventoryMovement, Activity, Customer, CustomerField, Job,
  Invoice, Payment, Asset, AssetRepair, MileageTrip, LivestockGroup,
  LivestockTransaction, Loan, DocumentRecord, TaxOpportunity, TaxQuestion,
} from "@/types/domain";

// -----------------------------------------------------------------------
// Demo data store.
//
// FarmLedger's real, permanent backend is Postgres via Supabase (see
// supabase/migrations/*.sql and src/lib/supabase/*). This file is a small
// JSON-file-backed repository that lets the app run with real, mutable,
// persisted state *before* a Supabase project is connected -- so every
// screen is genuinely interactive out of the box instead of a static mock.
//
// IMPORTANT: this only works where the filesystem is writable and durable
// between requests (local dev, a long-lived server). Netlify/serverless
// functions have an ephemeral, often read-only filesystem, so production
// deploys MUST set the Supabase env vars (see .env.example) -- the app
// switches to `src/lib/supabase/repo.ts` automatically when they're
// present. See README.md "Two data layers" for the full explanation.
// -----------------------------------------------------------------------

export interface DB {
  fields: Field[];
  cropYears: CropYear[];
  vendors: Vendor[];
  farmCategories: FarmCategory[];
  transactions: Transaction[];
  receipts: Receipt[];
  products: Product[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  activities: Activity[];
  customers: Customer[];
  customerFields: CustomerField[];
  jobs: Job[];
  invoices: Invoice[];
  payments: Payment[];
  assets: Asset[];
  assetRepairs: AssetRepair[];
  mileageTrips: MileageTrip[];
  livestockGroups: LivestockGroup[];
  livestockTransactions: LivestockTransaction[];
  loans: Loan[];
  documents: DocumentRecord[];
  taxOpportunities: TaxOpportunity[];
  taxQuestions: TaxQuestion[];
}

function freshSeed(): DB {
  return {
    fields: structuredClone(seed.FIELDS),
    cropYears: structuredClone(seed.CROP_YEARS),
    vendors: structuredClone(seed.VENDORS),
    farmCategories: structuredClone(seed.FARM_CATEGORIES),
    transactions: structuredClone(seed.TRANSACTIONS),
    receipts: structuredClone(seed.RECEIPTS),
    products: structuredClone(seed.PRODUCTS),
    inventoryItems: structuredClone(seed.INVENTORY_ITEMS),
    inventoryMovements: structuredClone(seed.INVENTORY_MOVEMENTS),
    activities: structuredClone(seed.ACTIVITIES),
    customers: structuredClone(seed.CUSTOMERS),
    customerFields: structuredClone(seed.CUSTOMER_FIELDS),
    jobs: structuredClone(seed.JOBS),
    invoices: structuredClone(seed.INVOICES),
    payments: structuredClone(seed.PAYMENTS),
    assets: structuredClone(seed.ASSETS),
    assetRepairs: structuredClone(seed.ASSET_REPAIRS),
    mileageTrips: structuredClone(seed.MILEAGE_TRIPS),
    livestockGroups: structuredClone(seed.LIVESTOCK_GROUPS),
    livestockTransactions: structuredClone(seed.LIVESTOCK_TXNS),
    loans: structuredClone(seed.LOANS),
    documents: structuredClone(seed.DOCUMENTS),
    taxOpportunities: structuredClone(seed.TAX_OPPORTUNITIES),
    taxQuestions: structuredClone(seed.TAX_QUESTIONS),
  };
}

const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "db.json");

let cache: DB | null = null;

function load(): DB {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      return cache!;
    }
  } catch {
    // fall through to reseed on any read/parse error
  }
  cache = freshSeed();
  persist();
  return cache;
}

function persist() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Read-only filesystem (e.g. serverless): keep working in-memory for
    // this invocation. Data will reset on cold start -- expected in demo
    // mode without Supabase configured.
  }
}

export function getDB(): DB {
  return load();
}

export function mutate<T>(fn: (db: DB) => T): T {
  const db = load();
  const result = fn(db);
  persist();
  return result;
}

export function resetDemoData(): void {
  cache = freshSeed();
  persist();
}
