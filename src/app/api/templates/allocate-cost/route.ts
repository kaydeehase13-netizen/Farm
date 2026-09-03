import { NextResponse } from "next/server";
import { buildXlsxTemplate } from "@/lib/xlsx-import";
import { listFarmCategories, getFarm } from "@/lib/data/repo";

export async function GET() {
  const [categories, farm] = await Promise.all([listFarmCategories(), getFarm()]);

  const buffer = await buildXlsxTemplate({
    sheetName: "Allocate Product Cost",
    columns: [
      { header: "Year", width: 10, example: farm.currentTaxYear },
      { header: "Product Name", width: 26, example: "Roundup PowerMax" },
      { header: "Total Amount", width: 16, example: 2450.0, money: true },
      { header: "Category", width: 26, example: categories[0]?.name ?? "Chemicals" },
      { header: "Vendor (optional)", width: 22, example: "Co-op Supply" },
      { header: "Date (optional, YYYY-MM-DD)", width: 20 },
    ],
    categoryNames: categories.map((c) => c.name),
    notes: [
      "This splits one lump-sum product bill across the fields that actually used it, by their logged activity — the same thing the \"Allocate Product Cost\" form does, just for many products at once.",
      "Product Name must match how you (or an import) logged it on field activities — spray/fertilizer/seed products — for that year, or nothing will be found to allocate against.",
      "Category must match a name exactly from the \"Categories (reference)\" sheet.",
      "Leave Date blank to file it at Dec 31 of that Year.",
      "Delete the italic example row before importing, or leave it — rows with a blank Total Amount or Product Name are skipped.",
    ],
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="farmledger-allocate-cost-template.xlsx"',
    },
  });
}
