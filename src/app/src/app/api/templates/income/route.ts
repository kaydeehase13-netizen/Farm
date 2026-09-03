import { NextResponse } from "next/server";
import { buildXlsxTemplate } from "@/lib/xlsx-import";
import { listFarmCategories } from "@/lib/data/repo";

export async function GET() {
  const categories = await listFarmCategories();

  const buffer = await buildXlsxTemplate({
    sheetName: "Income",
    columns: [
      { header: "Date (YYYY-MM-DD)", width: 18, example: new Date().toISOString().slice(0, 10) },
      { header: "Amount", width: 14, example: 1200.0, money: true },
      { header: "Description", width: 30, example: "Custom hire — spraying" },
      { header: "Category", width: 26, example: categories[0]?.name ?? "" },
      { header: "Customer (optional)", width: 22, example: "" },
    ],
    categoryNames: categories.map((c) => c.name),
    notes: [
      "Each row becomes one income transaction on the Transactions page.",
      "Category must match a name exactly from the \"Categories (reference)\" sheet — leave it blank to import as Uncategorized and sort it later.",
      "Customer is just kept as text on the transaction description right now — it doesn't need to match an existing customer record.",
      "Rows with a blank Date or Amount are skipped.",
    ],
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="farmledger-income-template.xlsx"',
    },
  });
}
