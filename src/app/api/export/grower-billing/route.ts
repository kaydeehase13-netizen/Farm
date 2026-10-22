import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listFields, listGrowers, listTransactions, listActivities } from "@/lib/data/repo";
import { growerBilling } from "@/lib/grower-billing";

const CURRENCY = '"$"#,##0.00';

/** Grower billing for a year: a summary tab, then one tab per grower (product, work, by field). */
export async function GET(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const [fields, { growers, rates }, transactions, activities] = await Promise.all([
    listFields(), listGrowers(), listTransactions({ taxYear: year, type: "expense" }), listActivities({ year }),
  ]);
  const bills = growerBilling({ fields, growers, rates, transactions, activities });

  const wb = new ExcelJS.Workbook();
  const head = (ws: ExcelJS.Worksheet, row: number) => {
    ws.getRow(row).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(row).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } }));
  };

  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { header: "Grower", key: "g", width: 22 }, { header: "Fields", key: "f", width: 8 }, { header: "Acres", key: "a", width: 10 },
    { header: "Product at cost", key: "pc", width: 16, style: { numFmt: CURRENCY } }, { header: "Markup", key: "m", width: 12, style: { numFmt: CURRENCY } },
    { header: "Work", key: "w", width: 12, style: { numFmt: CURRENCY } }, { header: "Total", key: "t", width: 14, style: { numFmt: CURRENCY } },
    { header: "Note", key: "n", width: 30 },
  ];
  head(sum, 1);
  for (const b of bills) {
    sum.addRow({ g: b.grower, f: b.fields.length, a: Math.round(b.fields.reduce((s, x) => s + x.acres, 0) * 100) / 100,
      pc: b.productCost, m: b.markup, w: b.workTotal, t: b.total, n: b.ownFarm ? "Your farm: cost only" : "" });
  }

  for (const b of bills) {
    const ws = wb.addWorksheet(b.grower.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Grower");
    ws.columns = [{ width: 30 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }];
    ws.addRow([`${b.grower} — ${year}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.addRow(["Product", "Quantity", "Unit", "Cost"]); head(ws, ws.rowCount);
    for (const p of b.products) ws.addRow([p.productName, p.quantity || null, p.unit, p.cost]).getCell(4).numFmt = CURRENCY;
    ws.addRow(["Product at cost", null, null, b.productCost]).font = { bold: true };
    if (b.markup) ws.addRow([`Markup ${b.markupPct}%`, null, null, b.markup]);
    ws.addRow([]);
    ws.addRow(["Work", "Passes", "Acres", "Rate / ac", "Amount"]); head(ws, ws.rowCount);
    for (const w of b.work) { const r = ws.addRow([w.label, w.passes, Math.round(w.acres * 100) / 100, w.rate, w.amount]); r.getCell(4).numFmt = CURRENCY; r.getCell(5).numFmt = CURRENCY; }
    ws.addRow(["Work total", null, null, null, b.workTotal]).font = { bold: true };
    ws.addRow([]);
    ws.addRow([b.ownFarm ? "Your cost" : "TOTAL TO BILL", null, null, null, b.total]).font = { bold: true, size: 12 };
    ws.addRow([]);
    ws.addRow(["By field", "Acres", null, "Product", "Work"]); head(ws, ws.rowCount);
    for (const f of b.fields) { const r = ws.addRow([f.fieldName, f.acres, null, f.productCost, b.ownFarm ? 0 : f.workTotal]); r.getCell(4).numFmt = CURRENCY; r.getCell(5).numFmt = CURRENCY; }
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "number" && !c.numFmt) c.numFmt = "#,##0.##"; }));
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grower-billing-${year}.xlsx"`,
    },
  });
}
