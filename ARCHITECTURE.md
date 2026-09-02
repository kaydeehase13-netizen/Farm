# FarmLedger — Architecture

This is the planning document the build spec asked for before writing code.
It reflects what's actually implemented in this repo plus the design for
what isn't built yet (mobile, live bank sync, PDF generation) — each
section says which is which.

## 1–3. Web / Mobile / Shared backend architecture

**One product, one backend, two clients.**

- **Web**: Next.js 16 (App Router), TypeScript, Tailwind v4. Server
  Components read data directly from the repository layer; mutations go
  through Server Actions (`src/lib/actions.ts`). Built and running in this
  repo.
- **Mobile** (designed, not yet scaffolded): Expo / React Native +
  TypeScript. Shares `src/types/domain.ts` (the domain model) and, once
  Supabase is connected, the same `@supabase/supabase-js` client and RLS
  policies as web. Bottom tab navigation mirrors the web sidebar
  (Home / Money / Fields / Work / More) exactly, per spec.
- **Shared backend**: Supabase — Postgres (schema in
  `supabase/migrations/`), Supabase Auth (email/password, MFA, OAuth),
  Supabase Storage (receipts/documents), and Row Level Security as the
  authorization layer both clients rely on. Because RLS is enforced at the
  database, a bug in either client's UI cannot leak another farm's data —
  the database itself refuses the query.

## 4. Technology stack

Next.js 16 · TypeScript everywhere · Tailwind CSS v4 · PostgreSQL via
Supabase · ExcelJS · (planned) Expo/React Native, WatermelonDB or a custom
outbox table for offline mobile, `@react-pdf/renderer` for PDF generation,
Plaid for bank aggregation.

## 5–6. PostgreSQL schema & ERD

Full DDL: `supabase/migrations/0001_core_schema.sql` (tables/enums/indexes),
`0002_rls.sql` (row level security), `0003_reference_data.sql` (seed
lookup data: crops, job services, Schedule‑F-aligned tax categories,
starter tax-opportunity rules).

Core entity groups (see the SQL for full columns):

```
Identity & tenancy:   app_user, farm_business, farm_membership, tax_year
Fields:                field, field_boundary, crop, crop_year
Customers/custom work: customer, customer_field, job_service, job
Products/inventory:    product, inventory_item, inventory_movement
Field activities:      activity (+ spray/planting/fertilizer/harvest detail
                        tables and *_product_line tables)
Money:                 vendor, tax_category, farm_category, document,
                        receipt, transaction, transaction_split
Invoicing:             invoice, invoice_line, payment
Assets:                asset, asset_repair, mileage_trip
Livestock:              livestock_group, livestock_transaction
Loans:                 loan, loan_payment
Bank integration:      bank_connection, bank_import_transaction
Tax rule engine:       jurisdiction, tax_rule, tax_rule_version,
                        tax_opportunity, tax_question, cpa_review
System:                notification, audit_log, export_job, report_definition
```

Design rules enforced throughout:

- Money is `numeric(14,2)` (never `float`/`double`).
- Nothing is a JSON blob where a relational column belongs — weather and
  OCR raw output are the two intentional exceptions (genuinely
  unstructured, non-financial data).
- A `transaction` can be split (`transaction_split`) across multiple
  fields, a customer job, equipment, a vehicle, or general overhead, each
  split independently categorized — this is what powers per-field cost
  allocation without duplicate entry.
- Every financial table is soft-delete/archive-only; nothing overwrites
  history silently (see §23, Audit History).

## 7–8. Authentication & roles/permissions

Supabase Auth: email/password + password reset out of the box; MFA and
Apple/Google OAuth are Supabase Auth features enabled in the dashboard, no
custom code required. `farm_membership.role` is one of the seven spec
roles (`owner_admin`, `manager`, `employee`, `equipment_operator`,
`applicator`, `bookkeeper`, `cpa`), and three boolean flags
(`can_view_financials`, `can_edit_financials`, `can_view_tax_records`) give
per-member overrides on top of the role default — e.g. an Applicator role
defaults to operational-only access, matching "an applicator can record
spray applications without seeing farm-wide financial information."
RLS policies in `0002_rls.sql` enforce this at the database: operational
tables require farm membership; `transaction`/`receipt`/`invoice`/
`payment`/`loan` require `can_view_financials`/`can_edit_financials`; the
tax tables require `can_view_tax_records`.

## 9. Offline mobile synchronization (design — not yet built)

Every domain type carries a `syncStatus` field
(`saved_offline | syncing | synced | sync_error`) already, so the UI
contract exists today even though mobile doesn't yet. Planned
implementation:

- Mobile writes for the twelve offline-critical workflows (receipt,
  expense, planting, spraying, fertilizing, harvest, mileage, custom work,
  notes, photos, inventory use, equipment repair) go to a local SQLite
  outbox first, tagged `saved_offline`, and render immediately.
- A background sync worker flushes the outbox when connectivity returns,
  flipping status to `syncing` then `synced`/`sync_error`.
- **Conflict resolution**: every syncable row carries `updated_at` +
  `updated_by`. On conflict (two users edited the same record while both
  were offline), the server keeps both versions as an `audit_log` entry and
  applies **last-write-wins on the field level for non-financial fields**,
  but a financial-amount conflict is never silently resolved — it's
  surfaced as a `notification` to a manager/bookkeeper to pick a version.
  This mirrors §23 (never silently overwrite financial history).

## 10. File/document storage

Supabase Storage, one bucket (`documents`), object path convention
`{farm_business_id}/{category}/{document_id}-{filename}`. The `document`
table stores metadata + `storage_path`; `receipt` references `document`.
Access is gated by a Storage policy mirroring the `document` table's RLS.

## 11. Receipt OCR

`POST /api/receipts/ocr` (`src/app/api/receipts/ocr/route.ts`) sends the
photographed/uploaded receipt to a vision-capable OpenAI model
(`gpt-4o-mini` by default) with a strict JSON-extraction prompt (vendor,
date, amount, sales tax, line items, suggested category). The result is
**always** routed through a human-confirmation screen
(`src/components/money/receipt-scanner.tsx` →
`confirmReceiptAction`/`saveReceiptAndCreateExpenseAction`) before it
becomes a real transaction — the API route itself never writes to the
database. Without an `OPENAI_API_KEY`, the route returns a clearly-labeled
stub so the confirm flow still works end to end in demo mode.

## 12. AI architecture

`POST /api/assistant/ask` builds a JSON snapshot of the farm's **real**
data (dashboard summary, field profitability, customers, inventory, a
transaction sample, missing-receipt list) and sends it to OpenAI with a
system prompt that forbids inventing figures and requires the model to say
plainly when the data needed isn't available — directly implementing the
spec's "never invent financial values" requirement. The chat panel
(`src/components/assistant/assistant-panel.tsx`) is available from every
screen.

## 13. Field mapping / GPS (design)

`field_boundary` / `customer_field.boundary` are PostGIS `geometry(Polygon,
4326)` columns (`postgis` extension enabled in `0001_core_schema.sql`), so
"draw boundary → calculate acreage" is a `ST_Area(geography(boundary))`
query away once a map UI (Mapbox GL / MapLibre) is wired to it. Not yet
built in this pass — the field forms use manually-entered acreage today.

## 14. Inventory logic

`inventory_item` tracks quantity-on-hand and average unit cost;
`inventory_movement` is the append-only ledger (`purchase`,
`use_own_field`, `use_customer_job`, `adjustment`, `waste_loss`,
`transfer`). Recording a spray or fertilizer activity
(`createFieldActivity` → `repo.createActivity`) automatically deducts the
product used and writes a movement row — the "record spraying → subtract
inventory → assign cost to field" pipeline from the spec, working in the
demo build today.

## 15. Invoice/payment logic

Invoices are generated **from completed jobs** (`createInvoiceFromJob`),
never typed from scratch, matching "create invoices from completed jobs."
Recording a payment (`recordPayment`) updates the invoice's paid amount and
status, decrements the customer's balance, and **automatically creates the
associated income transaction** — no duplicate entry, per the spec's core
UX principle.

## 16. Tax-rule architecture

Covered in README.md's "tax-rule engine" section and implemented in
`jurisdiction` / `tax_rule` / `tax_rule_version` / `tax_opportunity` /
`tax_question`. Rule versions are keyed by `effective_tax_year`, so a rule
can change every year without touching a single historical `transaction`
row. The seed data in `0003_reference_data.sql` includes eight starter
rules (Section 179/bonus depreciation, trade-in basis, prepaid supplies
limits, breeding livestock capital gain treatment, disaster/casualty,
conservation expense, government payment reporting, crop insurance
deferral) — **these are illustrative starting points and must be reviewed
by a qualified tax professional before being relied on in production**, as
called out directly in the SQL comments.

## 17. CPA portal

`/cpa` (`src/app/(app)/cpa/page.tsx`) is a full web experience — financial
summary, flagged-transaction review queue with a one-click "mark
reviewed," asset list, and a question/response thread — built so a CPA
never needs the mobile app, per spec. Production wiring would gate this
route behind the `cpa` role and `can_view_tax_records`.

## 18. Excel/XLSX export architecture

`src/lib/export/workbook.ts` builds a real `.xlsx` via ExcelJS with the
spec's professional-workbook requirements: frozen header row, AutoFilter,
real Excel dates (not text), numeric currency columns with a currency
number format, farm/entity + tax-year + generated-date on a cover sheet,
and no merged cells. 22 tabs are implemented today (Farm Summary, Income,
Expenses, Expenses by Tax Category, Expenses by Farm Category, Field
Profitability, Field Expenses, Field Income, Crop Summary, Custom Work,
Customer Invoices, Customer Payments, Equipment & Assets, Equipment
Repairs, Vehicles & Mileage, Livestock, Loans & Interest, Inventory
Purchases, Spray Records, Potential Tax Opportunities, CPA Questions,
Missing Documentation, Transaction Detail) — `type=cpa` trims this to the
accountant-priority subset for the "Export for CPA" button.
`/api/export/field-report` produces the single-sheet field comparison
report. Both are live, downloadable endpoints today (verified: 22-sheet
workbook, real `datetime` cells, numeric amounts).

## 19. PDF/printing architecture (design — not yet built)

Planned: `@react-pdf/renderer` (server-rendered, no headless-browser
dependency) producing the Year-End Farm Tax Organizer and per-field
printable reports, with farm name / entity / tax year / report title /
generated date / page numbers on every page, per spec. Not implemented in
this pass — the Reports page links to the working Excel exports today.

## 20. Complete CPA package generation (design — not yet built)

Planned: an `export_job` row of type `cpa_package` triggers a server-side
job that (a) calls the same workbook builder, (b) renders the PDF
organizer once §19 exists, (c) pulls every `document` row for the tax year
into a folder structure (`/Receipts`, `/Income`, `/Equipment`,
`/Livestock`, `/Loans`, `/Insurance`, `/Tax_Documents`, `/Other_Documents`)
from Supabase Storage, and (d) zips it as
`{year}_{Farm_Name}_CPA_Package.zip`, uploaded back to Storage with a
signed download URL delivered via `notification`.

## 21. Bank integration architecture (design — not yet built)

`bank_connection` / `bank_import_transaction` model a Plaid-style
read-only aggregator connection. Planned flow: Plaid Link on the client →
webhook writes raw `bank_import_transaction` rows → a matching pass
attempts to pair each import against an existing `receipt` (by amount +
date proximity) and suggests a vendor/category → user confirms → a real
`transaction` is created, with `bank_import_transaction.status` flipped to
`matched` (duplicate imports are rejected by the `unique(bank_connection_id,
provider_transaction_id)` constraint). The Money → Banking screen in this
build explains this flow to the user; no live Plaid connection exists yet.

## 22. Accounting integration architecture (design — not yet built)

FarmLedger stays the operational source of truth for fields, activities,
applications, receipts, custom work, and field profitability (per spec).
A planned QuickBooks connector would be one-directional for those records
(FarmLedger → QBO, as journal entries/bills) and import only a
chart-of-accounts mapping in the other direction — never overwriting
FarmLedger's operational data from QBO.

## 23. Security

- RLS on every tenant table (see §8) — the database enforces tenancy, not
  just the API layer.
- Secrets (`OPENAI_API_KEY`, Supabase service role key) live in
  environment variables only, never in source (`.env.local` is
  git-ignored; `.env.example` documents the shape).
- Server Actions validate/derive server-side values (farm ID, tax year)
  rather than trusting client input for anything that determines data
  ownership.
- Audit trail: financial tables are designed to be soft-delete/archive
  only; `audit_log` captures created/modified by+at and previous values
  for sensitive changes (schema in place; write-side triggers are a
  follow-up).
- Input validation on every Server Action via typed `FormData` parsing;
  production hardening would add `zod` schemas per action (the dependency
  is already installed).

## 24. Backup/recovery strategy

Supabase provides automated daily backups and point-in-time recovery on
paid tiers; Storage objects are redundant by default. The "Download Full
Account Export" button (Settings page, and `/api/export/cpa-workbook?type=full`)
gives the user their own on-demand full export at any time, satisfying the
spec's "user must be able to download their data" requirement independent
of the hosting provider's backup posture.

## 25. Third-party services/credentials required for full production

- **Supabase** (Postgres, Auth, Storage) — required for real persistence.
- **OpenAI** (or another vision+chat provider) — receipt OCR + AI
  assistant. Optional; app degrades to manual entry without it.
- **Plaid** (or similar) — bank/credit-card import. Not yet connected.
- **Resend/Postfix or similar** — transactional email (invoice emailing,
  invite emails). Not yet connected.
- **Mapbox/MapLibre + tile provider** — satellite field-boundary drawing.
  Not yet connected.
- **Apple/Google OAuth app credentials** — for "Sign in with Apple/Google"
  (configured in Supabase Auth, not custom code).

## 26. Features requiring legal/tax/compliance review before production

- Every `tax_rule`/`tax_rule_version` seed row is illustrative and must be
  reviewed and maintained by a qualified tax professional — this is a
  running compliance obligation, not a one-time review.
- State-specific pesticide/applicator record-keeping requirements
  (`spray_activity_detail`) are modeled as configurable jurisdiction/year
  data, not hard-coded — the actual required-field sets per state should
  be reviewed against each state's Department of Agriculture rules before
  claiming compliance.
- Bank integration (Plaid) has its own compliance surface (GLBA, data
  retention) that needs legal review before launch.
- The AI assistant and OCR features process financial documents through a
  third-party model provider — data-processing terms with that provider
  should be reviewed for farm financial data sensitivity.
- No SSNs are collected anywhere in the schema; if a future feature
  requires one (e.g. 1099 generation), that's a deliberate, reviewed
  addition, not an incidental one.
