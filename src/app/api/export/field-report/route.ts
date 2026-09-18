import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { allFieldProfitability, getFarm, fieldProductUsage, listActivities } from "@/lib/data/repo";
import type { FieldProfitability, Activity } from "@/types/domain";

const CURRENCY = '"$"#,##0.00';

/** One tab per product category (Seed / Fertilizer / Chemical): what was used on each field, and what it cost — the per-field breakdown behind the summary tab's Seed/Fertilizer/Chemical expense columns. */
function addProductBreakdownSheet(
  wb: ExcelJS.Workbook,
  title: string,
  category: "Seed" | "Fertilizer" | "Chemical",
  rows: FieldProfitability[],
  usageByField: Map<string, Awaited<ReturnType<typeof fieldProductUsage>>>
) {
  const sheet = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Field", key: "field", width: 18 },
    { header: "Crop", key: "crop", width: 14 },
    { header: "Product", key: "product", width: 26 },
    { header: "Quantity", key: "qty", width: 12 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Cost", key: "cost", width: 14, style: { numFmt: CURRENCY } },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } }));
  sheet.autoFilter = { from: "A1", to: "F1" };

  let any = false;
  for (const r of rows) {
    const usage = usageByField.get(r.fieldId) ?? [];
    for (const u of usage.filter((u) => u.category === category)) {
      any = true;
      sheet.addRow({
        field: r.fieldName, crop: r.cropName, product: u.productName,
        qty: u.totalQuantity, unit: u.unit ?? "", cost: u.allocatedCost,
      });
    }
  }
  if (!any) {
    sheet.addRow({ field: `No ${category.toLowerCase()} activity logged for this tax year.` });
  }
}

/**
 * The Seed/Fertilizer/Chemical Detail tabs total each product's use across
 * the whole year per field — they don't say how much ground got covered on
 * any one pass. This is the per-session companion: one row per spray/
 * planting/fertilizer activity per product, with that session's own date
 * and acres, straight from the logged activities rather than the
 * already-summed usage totals above.
 */
function addSessionSheet(
  wb: ExcelJS.Workbook,
  title: string,
  category: "Seed" | "Fertilizer" | "Chemical",
  activities: Activity[]
) {
  const sheet = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Field", key: "field", width: 18 },
    { header: "Product", key: "product", width: 26 },
    { header: "Acres", key: "acres", width: 10 },
    { header: "Rate", key: "rate", width: 12 },
    { header: "Rate Unit", key: "rateUnit", width: 12 },
    { header: "Quantity Used", key: "qty", width: 14 },
    { header: "Quantity Unit", key: "qtyUnit", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } }));
  sheet.autoFilter = { from: "A1", to: "H1" };

  let any = false;
  const addRow = (a: Activity, product: string, rate: number | undefined, rateUnit: string | undefined, qty: number | undefined, qtyUnit: string | undefined) => {
    any = true;
    sheet.addRow({
      date: a.activityDate, field: a.fieldName ?? a.customerFieldName ?? "", product, acres: a.acres ?? "",
      rate: rate ?? "", rateUnit: rateUnit ?? "", qty: qty ?? "", qtyUnit: qtyUnit ?? "",
    });
  };

  for (const a of activities) {
    if (category === "Chemical") {
      for (const p of a.sprayProducts ?? []) addRow(a, p.productName, p.rate, p.rateUnit, p.quantityUsed, p.quantityUnit);
    } else if (category === "Fertilizer") {
      for (const p of a.fertilizerProducts ?? []) addRow(a, p.productName, p.rate, p.rateUnit, p.quantityUsed, p.quantityUnit);
    } else if (category === "Seed" && a.seedProductName) {
      addRow(a, a.seedProductName, a.seedingRate, "seeds/ac", undefined, undefined);
    }
  }
  if (!any) {
    sheet.addRow({ date: `No ${category.toLowerCase()} sessions logged for this tax year.` });
  }
}

export async function GET(req: NextRequest) {
  const farm = await getFarm();
  const { searchParams } = new URL(req.url);
  const taxYear = Number(searchParams.get("taxYear")) || farm.currentTaxYear;
  const rows = await allFieldProfitability(taxYear);

  // One usage-by-product lookup per field, reused across the Seed /
  // Fertilizer / Chemical breakdown tabs below instead of each tab
  // re-deriving it from the raw activities/transactions itself.
  const usageEntries = await Promise.all(rows.map(async (r) => [r.fieldId, await fieldProductUsage(r.fieldId, taxYear)] as const));
  const usageByField = new Map(usageEntries);

  const wb = new ExcelJS.Workbook();
  wb.creator = "FarmLedger";
  const sheet = wb.addWorksheet("Field Report", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Field", key: "field", width: 18 },
    { header: "Crop", key: "crop", width: 14 },
    { header: "Acres", key: "acres", width: 10 },
    { header: "Income", key: "income", width: 14, style: { numFmt: CURRENCY } },
    { header: "Seed", key: "seed", width: 12, style: { numFmt: CURRENCY } },
    { header: "Fertilizer", key: "fert", width: 12, style: { numFmt: CURRENCY } },
    { header: "Chemical", key: "chem", width: 12, style: { numFmt: CURRENCY } },
    { header: "Fuel", key: "fuel", width: 12, style: { numFmt: CURRENCY } },
    { header: "Rent", key: "rent", width: 12, style: { numFmt: CURRENCY } },
    { header: "Insurance", key: "ins", width: 12, style: { numFmt: CURRENCY } },
    { header: "Harvest", key: "harvest", width: 12, style: { numFmt: CURRENCY } },
    { header: "Other Expense", key: "other", width: 14, style: { numFmt: CURRENCY } },
    { header: "Total Expense", key: "totalExp", width: 14, style: { numFmt: CURRENCY } },
    { header: "Income/Acre", key: "incAcre", width: 14, style: { numFmt: CURRENCY } },
    { header: "Expense/Acre", key: "expAcre", width: 14, style: { numFmt: CURRENCY } },
    { header: "Margin", key: "margin", width: 14, style: { numFmt: CURRENCY } },
    { header: "Margin/Acre", key: "marginAcre", width: 14, style: { numFmt: CURRENCY } },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } }));
  sheet.autoFilter = { from: "A1", to: "Q1" };

  for (const r of rows) {
    sheet.addRow({
      field: r.fieldName, crop: r.cropName, acres: r.acres, income: r.income, seed: r.expenseSeed,
      fert: r.expenseFertilizer, chem: r.expenseChemical, fuel: r.expenseFuel, rent: r.expenseRent,
      ins: r.expenseInsurance, harvest: r.expenseHarvest,
      other: r.expenseDrying + r.expenseTrucking + r.expenseCustomWork + r.expenseOther,
      totalExp: r.totalExpense, incAcre: r.incomePerAcre, expAcre: r.expensePerAcre, margin: r.margin, marginAcre: r.marginPerAcre,
    });
  }

  addProductBreakdownSheet(wb, "Seed Detail", "Seed", rows, usageByField);
  addProductBreakdownSheet(wb, "Fertilizer Detail", "Fertilizer", rows, usageByField);
  addProductBreakdownSheet(wb, "Chemical Detail", "Chemical", rows, usageByField);

  const activities = await listActivities({ year: taxYear });
  addSessionSheet(wb, "Planting Sessions", "Seed", activities);
  addSessionSheet(wb, "Fertilizer Sessions", "Fertilizer", activities);
  addSessionSheet(wb, "Spray Sessions", "Chemical", activities);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${taxYear}_${farm.name.replace(/\s+/g, "_")}_Field_Report.xlsx"`,
    },
  });
}
