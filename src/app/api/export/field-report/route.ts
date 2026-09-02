import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { allFieldProfitability, getFarm } from "@/lib/data/repo";

export async function GET(req: NextRequest) {
  const farm = await getFarm();
  const { searchParams } = new URL(req.url);
  const taxYear = Number(searchParams.get("taxYear")) || farm.currentTaxYear;
  const rows = await allFieldProfitability(taxYear);

  const wb = new ExcelJS.Workbook();
  wb.creator = "FarmLedger";
  const sheet = wb.addWorksheet("Field Report", { views: [{ state: "frozen", ySplit: 1 }] });
  const CURRENCY = '"$"#,##0.00';

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

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${taxYear}_${farm.name.replace(/\s+/g, "_")}_Field_Report.xlsx"`,
    },
  });
}
