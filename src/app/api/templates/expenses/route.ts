import { NextResponse } from "next/server";
import { buildXlsxTemplate } from "@/lib/xlsx-import";
import { listFarmCategories } from "@/lib/data/repo";

export async function GET() {
  const categories = await listFarmCategories();

  const buffer = await buildXlsxTemplate({
    sheetName: "Expenses",
    columns: [
      { header: "Date (YYYY-MM-DD)", width: 18, example: new Date().toISOString().slice(0, 10) },
      { header: "Amount", width: 14, example: 340.5, money: true },
      { header: "Vendor", width: 22, example: "Tractor Supply Co." },
      { header: "Description", width: 30, example: "" },
      { header: "Category", width: 26, example: categories[0]?.name ?? "" },
      { header: "Product / Variety (optional)", width: 26, example: "AMS" },
      { header: "Quantity Purchased (optional)", width: 20, example: 2040 },
      { header: "Unit (optional)", width: 14, example: "lbs" },
    ],
    categoryNames: categories.map((c) => c.name),
    notes: [
      "For expenses you have paper/no receipt for and just want logged fast — each row becomes one expense transaction on the Transactions page.",
      "This does NOT attach a receipt photo. If you have the receipt image, use Receipts → Scan a Receipt instead so the photo stays linked.",
      "Category must match a name exactly from the \"Categories (reference)\" sheet — leave it blank to import as Uncategorized and sort it later.",
      "Rows with a blank Date or Amount are skipped.",
      "Fill in Product/Variety + Quantity Purchased + Unit for a Seed/Chemical/Fertilizer receipt and it also adds that quantity to Inventory, blending this row's price into the running average cost — great for logging several receipts of the same product bought at different prices (e.g. two AMS receipts at different $/lb).",
    ],
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="farmledger-expenses-template.xlsx"',
    },
  });
}
