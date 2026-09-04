import ExcelJS from "exceljs";
import * as repo from "@/lib/data/repo";
import { taxCategoryLabel, taxCategoryScheduleRef, taxCategoryScheduleType } from "@/lib/tax-categories";
import type { Field, Job, FarmCategory } from "@/types/domain";

// -----------------------------------------------------------------------
// Professional CPA/tax workbook generator.
//
// Rules enforced throughout (per build spec):
//   - dates are real Excel dates, not text
//   - money is numeric with a currency format, not text
//   - acreage is numeric
//   - header row is frozen and filterable
//   - every sheet identifies farm, tax year, and generation date
//   - no merged cells that would break AutoFilter
// -----------------------------------------------------------------------

const CURRENCY_FMT = '"$"#,##0.00';
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

function addSheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number; style?: Partial<ExcelJS.Style> }[]) {
  const sheet = wb.addWorksheet(name.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18, style: c.style }));
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

function dateCell(iso?: string) {
  return iso ? new Date(iso + "T00:00:00") : undefined;
}

export type WorkbookScope =
  | "full" | "cpa"
  // Smaller, faster single-topic exports — each skips fetching (and never
  // even queries) data it doesn't need, so it downloads much quicker than
  // the full package. "field_report" / "custom_work" / "spray" are kept as
  // aliases of the closest new section for any existing callers.
  | "income_expenses" | "fields" | "work" | "equipment" | "other" | "tax_review"
  | "field_report" | "custom_work" | "spray";

export interface WorkbookOptions {
  scope: WorkbookScope;
  taxYear: number;
}

/** Sheets to KEEP for each scope. null/undefined = keep everything (the full package). */
const SECTION_SHEETS: Partial<Record<WorkbookScope, string[]>> = {
  cpa: [
    "Farm Summary", "Income", "Expenses", "Expenses by Tax Category", "Equipment & Assets",
    "Vehicles & Mileage", "Potential Tax Opportunities", "CPA Questions", "Missing Documentation", "Transaction Detail",
    "SE Income (Sch C)", "SE Expenses (Sch C)", "SE Expenses by Category", "Royalty Income (Sch E)",
  ],
  income_expenses: [
    "Farm Summary", "Income", "Expenses", "Expenses by Tax Category", "Expenses by Farm Category",
    "SE Income (Sch C)", "SE Expenses (Sch C)", "SE Expenses by Category", "Royalty Income (Sch E)",
    "Missing Documentation", "Transaction Detail",
  ],
  fields: ["Farm Summary", "Field Profitability", "Field Expenses", "Field Income", "Crop Summary", "Spray Records"],
  spray: ["Farm Summary", "Spray Records"],
  field_report: ["Farm Summary", "Field Profitability", "Field Expenses", "Field Income", "Crop Summary"],
  work: ["Farm Summary", "Custom Work", "Customer Invoices", "Customer Payments"],
  custom_work: ["Farm Summary", "Custom Work", "Customer Invoices", "Customer Payments"],
  equipment: ["Farm Summary", "Equipment & Assets", "Equipment Repairs", "Vehicles & Mileage"],
  other: ["Farm Summary", "Livestock", "Loans & Interest", "Inventory Purchases"],
  tax_review: ["Farm Summary", "Potential Tax Opportunities", "CPA Questions"],
};

export async function buildWorkbook(opts: WorkbookOptions): Promise<ExcelJS.Buffer> {
  const farm = await repo.getFarm();
  // The activity → spray/fertilizer/seed join is the single heaviest query
  // this workbook can make (every activity, every year, with four joined
  // tables). Only fetch it for the scopes that actually use Spray Records.
  const wantActivities = opts.scope === "full" || opts.scope === "fields" || opts.scope === "spray";
  const [
    fields, cropYears, yearTxns, farmCategories, jobs, customers, invoices, payments,
    assets, assetRepairs, mileageTrips, livestockGroups, livestockTransactions, loans,
    inventoryItems, activities, taxOpportunities, taxQuestions,
  ] = await Promise.all([
    repo.listFields(), repo.listCropYears(), repo.listTransactions({ taxYear: opts.taxYear }), repo.listFarmCategories(),
    repo.listJobs(), repo.listCustomers(), repo.listInvoices(), repo.listPayments(),
    repo.listAssets(), repo.listAssetRepairs(), repo.listMileageTrips(), repo.listLivestockGroups(), repo.listLivestockTransactions(),
    repo.listLoans(), repo.listInventory(), wantActivities ? repo.listActivities() : Promise.resolve([]), repo.listTaxOpportunities(), repo.listTaxQuestions(),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "FarmLedger";
  wb.created = new Date();

  const cover = wb.addWorksheet("Farm Summary");
  cover.columns = [{ width: 28 }, { width: 40 }];
  const coverRows: [string, string | number][] = [
    ["Farm / Business", farm.name],
    ["State", farm.state ?? ""],
    ["Operation Type", farm.operationType],
    ["Tax Year", opts.taxYear],
    ["Report", opts.scope === "cpa" ? "CPA Export" : opts.scope === "full" ? "Full Financial Records" : opts.scope],
    ["Generated", new Date().toLocaleString()],
  ];
  cover.addRow(["FarmLedger — Farm Tax Records", ""]).font = { bold: true, size: 14, color: { argb: "FF1F3D2E" } };
  cover.addRow([]);
  coverRows.forEach((r) => cover.addRow(r));
  cover.getColumn(1).font = { bold: true };

  // --- Income ---
  const incomeSheet = addSheet(wb, "Income", [
    { header: "Date", key: "date", width: 14 },
    { header: "Source", key: "source", width: 26 },
    { header: "Description", key: "description", width: 36 },
    { header: "Tax Category", key: "taxCategory", width: 30 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } },
    { header: "Field", key: "field", width: 18 },
    { header: "Documentation", key: "doc", width: 16 },
  ]);
  for (const t of yearTxns.filter((t) => t.transactionType === "income" && !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_f")) {
    incomeSheet.addRow({
      date: dateCell(t.transactionDate), source: t.vendorName ?? t.customerId ?? "—", description: t.description,
      taxCategory: taxCategoryLabel(t.taxCategoryCode), amount: t.amount,
      field: fieldNamesForTxn(t, fields), doc: t.receiptId ? "On file" : "Missing",
    });
  }
  incomeSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  incomeSheet.addRow({});
  const incomeTotalRow = incomeSheet.addRow({ description: "TOTAL", amount: { formula: `SUM(E2:E${incomeSheet.rowCount - 1})` } });
  incomeTotalRow.font = { bold: true };

  // --- Expenses ---
  const expenseSheet = addSheet(wb, "Expenses", [
    { header: "Date", key: "date", width: 14 },
    { header: "Vendor", key: "vendor", width: 26 },
    { header: "Description", key: "description", width: 36 },
    { header: "Farm Category", key: "farmCategory", width: 22 },
    { header: "Tax Category", key: "taxCategory", width: 30 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } },
    { header: "Sales Tax", key: "salesTax", width: 12, style: { numFmt: CURRENCY_FMT } },
    { header: "Field / Job", key: "field", width: 20 },
    { header: "Documentation", key: "doc", width: 16 },
    { header: "CPA Flag", key: "cpaFlag", width: 12 },
  ]);
  for (const t of yearTxns.filter((t) => t.transactionType === "expense" && !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_f")) {
    expenseSheet.addRow({
      date: dateCell(t.transactionDate), vendor: t.vendorName, description: t.description,
      farmCategory: farmCategoryLabel(t.farmCategoryId, farmCategories), taxCategory: taxCategoryLabel(t.taxCategoryCode),
      amount: t.amount, salesTax: t.salesTax ?? 0, field: fieldNamesForTxn(t, fields),
      doc: t.receiptId ? "On file" : "Missing", cpaFlag: t.cpaFlag ? "Yes" : "",
    });
  }
  expenseSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  expenseSheet.addRow({});
  const expTotalRow = expenseSheet.addRow({ description: "TOTAL", amount: { formula: `SUM(F2:F${expenseSheet.rowCount - 1})` } });
  expTotalRow.font = { bold: true };

  // --- Expenses by Tax Category ---
  const byTax = addSheet(wb, "Expenses by Tax Category", [
    { header: "Tax Category", key: "cat", width: 34 }, { header: "Schedule Reference", key: "ref", width: 24 },
    { header: "Total", key: "total", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  const taxTotals = new Map<string, number>();
  for (const t of yearTxns.filter((t) => t.transactionType === "expense" && !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_f")) {
    const key = t.taxCategoryCode ?? "uncategorized";
    taxTotals.set(key, (taxTotals.get(key) ?? 0) + t.amount);
  }
  for (const [code, total] of taxTotals) byTax.addRow({ cat: taxCategoryLabel(code), ref: taxCategoryScheduleRef(code), total });

  // --- Expenses by Farm Category ---
  const byFarm = addSheet(wb, "Expenses by Farm Category", [
    { header: "Category", key: "cat", width: 28 }, { header: "Total", key: "total", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  const farmTotals = new Map<string, number>();
  for (const t of yearTxns.filter((t) => t.transactionType === "expense" && !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_f")) {
    const key = t.farmCategoryId ?? "uncategorized";
    farmTotals.set(key, (farmTotals.get(key) ?? 0) + t.amount);
  }
  for (const [id, total] of farmTotals) byFarm.addRow({ cat: farmCategoryLabel(id, farmCategories), total });

  // --- Self-Employment (Schedule C) — income, expenses, and by-category totals ---
  const seTxns = yearTxns.filter((t) => !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_c");
  const seIncomeSheet = addSheet(wb, "SE Income (Sch C)", [
    { header: "Date", key: "date", width: 14 }, { header: "Source", key: "source", width: 26 },
    { header: "Description", key: "description", width: 36 }, { header: "Tax Category", key: "taxCategory", width: 30 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } }, { header: "Documentation", key: "doc", width: 16 },
  ]);
  for (const t of seTxns.filter((t) => t.transactionType === "income")) {
    seIncomeSheet.addRow({
      date: dateCell(t.transactionDate), source: t.vendorName ?? t.customerId ?? "—", description: t.description,
      taxCategory: taxCategoryLabel(t.taxCategoryCode), amount: t.amount, doc: t.receiptId ? "On file" : "Missing",
    });
  }
  seIncomeSheet.getColumn("date").numFmt = "mm/dd/yyyy";

  const seExpenseSheet = addSheet(wb, "SE Expenses (Sch C)", [
    { header: "Date", key: "date", width: 14 }, { header: "Vendor", key: "vendor", width: 26 },
    { header: "Description", key: "description", width: 36 }, { header: "Tax Category", key: "taxCategory", width: 30 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } }, { header: "Documentation", key: "doc", width: 16 },
  ]);
  for (const t of seTxns.filter((t) => t.transactionType === "expense")) {
    seExpenseSheet.addRow({
      date: dateCell(t.transactionDate), vendor: t.vendorName, description: t.description,
      taxCategory: taxCategoryLabel(t.taxCategoryCode), amount: t.amount, doc: t.receiptId ? "On file" : "Missing",
    });
  }
  seExpenseSheet.getColumn("date").numFmt = "mm/dd/yyyy";

  const seByTax = addSheet(wb, "SE Expenses by Category", [
    { header: "Tax Category", key: "cat", width: 34 }, { header: "Schedule Reference", key: "ref", width: 24 },
    { header: "Total", key: "total", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  const seTaxTotals = new Map<string, number>();
  for (const t of seTxns.filter((t) => t.transactionType === "expense")) {
    const key = t.taxCategoryCode ?? "uncategorized";
    seTaxTotals.set(key, (seTaxTotals.get(key) ?? 0) + t.amount);
  }
  for (const [code, total] of seTaxTotals) seByTax.addRow({ cat: taxCategoryLabel(code), ref: taxCategoryScheduleRef(code), total });

  // --- Oil/Gas/Mineral Royalties (Schedule E) — separate from Schedule F
  // farm income on purpose; these don't belong mixed in with crop/livestock
  // sales. Income and expenses share one sheet since Schedule E royalty
  // volume is usually much lighter than Schedule F/C.
  const royaltyTxns = yearTxns.filter((t) => !t.isPersonalExcluded && taxCategoryScheduleType(t.taxCategoryCode) === "schedule_e");
  const royaltySheet = addSheet(wb, "Royalty Income (Sch E)", [
    { header: "Date", key: "date", width: 14 }, { header: "Type", key: "type", width: 10 },
    { header: "Payer/Vendor", key: "who", width: 26 }, { header: "Description", key: "description", width: 36 },
    { header: "Tax Category", key: "taxCategory", width: 34 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } }, { header: "Documentation", key: "doc", width: 16 },
  ]);
  for (const t of royaltyTxns) {
    royaltySheet.addRow({
      date: dateCell(t.transactionDate), type: t.transactionType, who: t.vendorName ?? "—", description: t.description,
      taxCategory: taxCategoryLabel(t.taxCategoryCode), amount: t.amount, doc: t.receiptId ? "On file" : "Missing",
    });
  }
  royaltySheet.getColumn("date").numFmt = "mm/dd/yyyy";
  royaltySheet.addRow({});
  const royaltyTotalRow = royaltySheet.addRow({ description: "NET TOTAL", amount: { formula: `SUMIF(B2:B${royaltySheet.rowCount - 1},"income",F2:F${royaltySheet.rowCount - 1})-SUMIF(B2:B${royaltySheet.rowCount - 1},"expense",F2:F${royaltySheet.rowCount - 1})` } });
  royaltyTotalRow.font = { bold: true };

  // --- Field Profitability ---
  const fieldProfit = addSheet(wb, "Field Profitability", [
    { header: "Field", key: "field", width: 18 }, { header: "Crop", key: "crop", width: 14 },
    { header: "Acres", key: "acres", width: 10 }, { header: "Income", key: "income", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Total Expense", key: "expense", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Margin", key: "margin", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Income/Acre", key: "incAcre", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Expense/Acre", key: "expAcre", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Margin/Acre", key: "marginAcre", width: 14, style: { numFmt: CURRENCY_FMT } },
  ]);
  for (const fp of await repo.allFieldProfitability(opts.taxYear)) {
    fieldProfit.addRow({
      field: fp.fieldName, crop: fp.cropName, acres: fp.acres, income: fp.income, expense: fp.totalExpense,
      margin: fp.margin, incAcre: fp.incomePerAcre, expAcre: fp.expensePerAcre, marginAcre: fp.marginPerAcre,
    });
  }

  // --- Field Expenses (detail) & Field Income (detail) ---
  const fieldExpenses = addSheet(wb, "Field Expenses", [
    { header: "Field", key: "field", width: 18 }, { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "cat", width: 20 }, { header: "Description", key: "desc", width: 30 },
    { header: "Allocated Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  fieldExpenses.getColumn("date").numFmt = "mm/dd/yyyy";
  const fieldIncome = addSheet(wb, "Field Income", [
    { header: "Field", key: "field", width: 18 }, { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "desc", width: 30 }, { header: "Allocated Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  fieldIncome.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const t of yearTxns) {
    for (const s of t.splits) {
      if (!s.fieldId) continue;
      const field = fields.find((f) => f.id === s.fieldId);
      if (t.transactionType === "expense") {
        fieldExpenses.addRow({ field: field?.name, date: dateCell(t.transactionDate), cat: farmCategoryLabel(t.farmCategoryId, farmCategories), desc: t.description, amount: s.allocatedAmount });
      } else if (t.transactionType === "income") {
        fieldIncome.addRow({ field: field?.name, date: dateCell(t.transactionDate), desc: t.description, amount: s.allocatedAmount });
      }
    }
  }

  // --- Crop Summary ---
  const cropSummary = addSheet(wb, "Crop Summary", [
    { header: "Field", key: "field", width: 18 }, { header: "Crop", key: "crop", width: 16 },
    { header: "Planted Acres", key: "acres", width: 14 }, { header: "Actual Yield", key: "yield", width: 14 },
    { header: "Yield Unit", key: "unit", width: 12 },
  ]);
  for (const cy of cropYears.filter((c) => c.year === opts.taxYear)) {
    const field = fields.find((f) => f.id === cy.fieldId);
    cropSummary.addRow({ field: field?.name, crop: cy.cropName, acres: cy.plantedAcres, yield: cy.actualYield, unit: cy.yieldUnit });
  }

  // --- Custom Work / Invoices / Payments ---
  const customWork = addSheet(wb, "Custom Work", [
    { header: "Date", key: "date", width: 14 }, { header: "Customer", key: "customer", width: 20 },
    { header: "Field", key: "field", width: 18 }, { header: "Service", key: "service", width: 18 },
    { header: "Acres", key: "acres", width: 10 }, { header: "Revenue", key: "revenue", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Direct Cost", key: "cost", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Margin", key: "margin", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Status", key: "status", width: 14 },
  ]);
  customWork.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const j of jobs) {
    customWork.addRow({
      date: dateCell(j.completedDate ?? j.scheduledDate), customer: j.customerName, field: j.customerFieldName,
      service: j.jobService, acres: j.acres, revenue: j.revenue, cost: j.directCost, margin: await repo.jobMargin(j), status: j.status,
    });
  }

  const invoicesSheet = addSheet(wb, "Customer Invoices", [
    { header: "Invoice #", key: "num", width: 12 }, { header: "Customer", key: "customer", width: 20 },
    { header: "Issue Date", key: "issue", width: 14 }, { header: "Due Date", key: "due", width: 14 },
    { header: "Total", key: "total", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Paid", key: "paid", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Balance", key: "balance", width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: "Status", key: "status", width: 14 },
  ]);
  invoicesSheet.getColumn("issue").numFmt = "mm/dd/yyyy";
  invoicesSheet.getColumn("due").numFmt = "mm/dd/yyyy";
  for (const inv of invoices) {
    invoicesSheet.addRow({
      num: inv.invoiceNumber, customer: inv.customerName, issue: dateCell(inv.issueDate), due: dateCell(inv.dueDate),
      total: inv.total, paid: inv.amountPaid, balance: inv.total - inv.amountPaid, status: inv.status,
    });
  }

  const paymentsSheet = addSheet(wb, "Customer Payments", [
    { header: "Date", key: "date", width: 14 }, { header: "Customer", key: "customer", width: 20 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FMT } }, { header: "Method", key: "method", width: 18 },
  ]);
  paymentsSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const p of payments) {
    const customer = customers.find((c) => c.id === p.customerId);
    paymentsSheet.addRow({ date: dateCell(p.paymentDate), customer: customer?.name, amount: p.amount, method: p.paymentMethod });
  }

  // --- Equipment & Assets, Repairs ---
  const assetSheet = addSheet(wb, "Equipment & Assets", [
    { header: "Asset", key: "name", width: 24 }, { header: "Type", key: "type", width: 14 },
    { header: "Purchase Date", key: "purchaseDate", width: 14 }, { header: "Purchase Price", key: "price", width: 16, style: { numFmt: CURRENCY_FMT } },
    { header: "Placed In Service", key: "pis", width: 16 }, { header: "Business Use %", key: "use", width: 14 }, { header: "Status", key: "status", width: 12 },
  ]);
  assetSheet.getColumn("purchaseDate").numFmt = "mm/dd/yyyy";
  assetSheet.getColumn("pis").numFmt = "mm/dd/yyyy";
  for (const a of assets) {
    assetSheet.addRow({ name: a.name, type: a.assetType, purchaseDate: dateCell(a.purchaseDate), price: a.purchasePrice, pis: dateCell(a.placedInServiceDate), use: a.businessUsePercent, status: a.status });
  }

  const repairsSheet = addSheet(wb, "Equipment Repairs", [
    { header: "Asset", key: "asset", width: 22 }, { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "desc", width: 32 }, { header: "Cost", key: "cost", width: 14, style: { numFmt: CURRENCY_FMT } },
  ]);
  repairsSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const r of assetRepairs) {
    const asset = assets.find((a) => a.id === r.assetId);
    repairsSheet.addRow({ asset: asset?.name, date: dateCell(r.repairDate), desc: r.description, cost: r.cost });
  }

  // --- Vehicles & Mileage ---
  const mileageSheet = addSheet(wb, "Vehicles & Mileage", [
    { header: "Date", key: "date", width: 14 }, { header: "Vehicle", key: "vehicle", width: 20 },
    { header: "Miles", key: "miles", width: 10 }, { header: "Purpose", key: "purpose", width: 30 },
  ]);
  mileageSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const m of mileageTrips) mileageSheet.addRow({ date: dateCell(m.tripDate), vehicle: m.vehicleName, miles: m.miles, purpose: m.purpose });
  mileageSheet.addRow({});
  mileageSheet.addRow({ purpose: "TOTAL MILES", miles: { formula: `SUM(C2:C${mileageSheet.rowCount - 1})` } });

  // --- Livestock ---
  const livestockSheet = addSheet(wb, "Livestock", [
    { header: "Group", key: "group", width: 20 }, { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 14 }, { header: "Head Count", key: "head", width: 12 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FMT } }, { header: "Weight (lbs)", key: "weight", width: 12 },
  ]);
  livestockSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const t of livestockTransactions) {
    const g = livestockGroups.find((g) => g.id === t.livestockGroupId);
    livestockSheet.addRow({ group: g?.name, date: dateCell(t.txnDate), type: t.txnType, head: t.headCount, amount: t.totalAmount, weight: t.weightLbs });
  }

  // --- Loans & Interest ---
  const loansSheet = addSheet(wb, "Loans & Interest", [
    { header: "Lender", key: "lender", width: 26 }, { header: "Original Principal", key: "principal", width: 16, style: { numFmt: CURRENCY_FMT } },
    { header: "Rate", key: "rate", width: 10 }, { header: "Origination", key: "orig", width: 14 },
    { header: "Current Balance", key: "balance", width: 16, style: { numFmt: CURRENCY_FMT } },
  ]);
  loansSheet.getColumn("orig").numFmt = "mm/dd/yyyy";
  for (const l of loans) loansSheet.addRow({ lender: l.lenderName, principal: l.originalPrincipal, rate: l.interestRate, orig: dateCell(l.originationDate), balance: l.currentBalance });

  // --- Inventory Purchases ---
  const inventorySheet = addSheet(wb, "Inventory Purchases", [
    { header: "Product", key: "product", width: 24 }, { header: "Category", key: "cat", width: 14 },
    { header: "On Hand", key: "qty", width: 12 }, { header: "Unit", key: "unit", width: 10 },
    { header: "Avg Unit Cost", key: "cost", width: 14, style: { numFmt: CURRENCY_FMT } },
  ]);
  for (const i of inventoryItems) inventorySheet.addRow({ product: i.productName, cat: i.category, qty: i.quantityOnHand, unit: i.unit, cost: i.averageUnitCost });

  // --- Spray / Application Records ---
  const spraySheet = addSheet(wb, "Spray Records", [
    { header: "Date", key: "date", width: 14 }, { header: "Field / Customer Field", key: "field", width: 22 },
    { header: "Acres", key: "acres", width: 10 }, { header: "Product", key: "product", width: 20 },
    { header: "EPA Reg #", key: "epa", width: 14 }, { header: "Rate", key: "rate", width: 10 }, { header: "Rate Unit", key: "rateUnit", width: 10 },
    { header: "Quantity Used", key: "qty", width: 14 }, { header: "Unit", key: "unit", width: 8 }, { header: "Applicator", key: "applicator", width: 18 },
  ]);
  spraySheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const a of activities.filter((a) => a.activityType === "spray")) {
    for (const p of a.sprayProducts ?? []) {
      spraySheet.addRow({
        date: dateCell(a.activityDate), field: a.fieldName ?? a.customerFieldName, acres: a.acres,
        product: p.productName, epa: p.epaRegistrationNumber, rate: p.rate, rateUnit: p.rateUnit,
        qty: p.quantityUsed, unit: p.quantityUnit, applicator: a.applicatorName,
      });
    }
  }

  // --- Potential Tax Opportunities / CPA Questions / Missing Docs ---
  const opportunitiesSheet = addSheet(wb, "Potential Tax Opportunities", [
    { header: "Title", key: "title", width: 30 }, { header: "Description", key: "desc", width: 46 },
    { header: "Status", key: "status", width: 16 }, { header: "Info Missing", key: "missing", width: 40 },
  ]);
  for (const o of taxOpportunities.filter((o) => o.taxYear === opts.taxYear)) {
    opportunitiesSheet.addRow({ title: o.ruleTitle, desc: o.ruleDescription, status: o.status, missing: o.infoMissing.join("; ") });
  }

  const questionsSheet = addSheet(wb, "CPA Questions", [
    { header: "Question", key: "q", width: 50 }, { header: "Raised By", key: "by", width: 16 },
    { header: "Status", key: "status", width: 14 }, { header: "CPA Response", key: "resp", width: 40 },
  ]);
  for (const q of taxQuestions) questionsSheet.addRow({ q: q.question, by: q.raisedByName, status: q.status, resp: q.cpaResponse });

  const missingDocsSheet = addSheet(wb, "Missing Documentation", [
    { header: "Date", key: "date", width: 14 }, { header: "Description", key: "desc", width: 32 }, { header: "Amount", key: "amount", width: 14, style: { numFmt: CURRENCY_FMT } },
  ]);
  missingDocsSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const t of yearTxns.filter((t) => t.transactionType === "expense" && !t.receiptId)) {
    missingDocsSheet.addRow({ date: dateCell(t.transactionDate), desc: t.description, amount: t.amount });
  }

  // --- Transaction Detail (everything, one row per split) ---
  const detailSheet = addSheet(wb, "Transaction Detail", [
    { header: "Date", key: "date", width: 14 }, { header: "Type", key: "type", width: 10 },
    { header: "Schedule", key: "schedule", width: 12 },
    { header: "Vendor/Source", key: "vendor", width: 22 }, { header: "Description", key: "desc", width: 32 },
    { header: "Farm Category", key: "farmCat", width: 20 }, { header: "Tax Category", key: "taxCat", width: 30 },
    { header: "Split Target", key: "target", width: 20 }, { header: "Allocated Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FMT } },
    { header: "Status", key: "status", width: 16 }, { header: "Documentation", key: "doc", width: 14 },
  ]);
  detailSheet.getColumn("date").numFmt = "mm/dd/yyyy";
  for (const t of yearTxns) {
    for (const s of t.splits) {
      detailSheet.addRow({
        date: dateCell(t.transactionDate), type: t.transactionType,
        schedule: taxCategoryScheduleType(t.taxCategoryCode) === "schedule_c" ? "Schedule C"
          : taxCategoryScheduleType(t.taxCategoryCode) === "schedule_e" ? "Schedule E" : "Schedule F",
        vendor: t.vendorName, desc: t.description,
        farmCat: farmCategoryLabel(t.farmCategoryId, farmCategories), taxCat: taxCategoryLabel(t.taxCategoryCode),
        target: splitTargetLabel(s, fields, jobs), amount: s.allocatedAmount, status: t.status, doc: t.receiptId ? "On file" : "Missing",
      });
    }
  }

  // Trim to just the sheets this scope needs. "full" has no entry in
  // SECTION_SHEETS, so it keeps everything built above.
  const sheetsToKeep = SECTION_SHEETS[opts.scope];
  if (sheetsToKeep) {
    const keep = new Set(sheetsToKeep);
    [...wb.worksheets].forEach((ws) => { if (!keep.has(ws.name)) wb.removeWorksheet(ws.id); });
  }

  return wb.xlsx.writeBuffer();
}

function fieldNamesForTxn(t: { splits: { fieldId?: string }[] }, fields: Field[]) {
  return t.splits.map((s) => s.fieldId && fields.find((f) => f.id === s.fieldId)?.name).filter(Boolean).join(", ");
}
function farmCategoryLabel(id: string | undefined, farmCategories: FarmCategory[]) {
  return farmCategories.find((c) => c.id === id)?.name ?? "Uncategorized";
}
function splitTargetLabel(s: { targetType: string; fieldId?: string; jobId?: string }, fields: Field[], jobs: Job[]) {
  if (s.targetType === "field") return fields.find((f) => f.id === s.fieldId)?.name ?? "Field";
  if (s.targetType === "customer_job") return jobs.find((j) => j.id === s.jobId)?.customerName ?? "Custom Job";
  return "General Overhead";
}
