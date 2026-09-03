import { NextResponse } from "next/server";
import { buildXlsxTemplate } from "@/lib/xlsx-import";
import { listFarmCategories, listActivities } from "@/lib/data/repo";
import { distinctProductUsageByYear } from "@/lib/product-usage";

export async function GET() {
  const [categories, activities] = await Promise.all([listFarmCategories(), listActivities({})]);
  const usage = distinctProductUsageByYear(activities);

  // Prefill one row per (year, product) actually logged on field activities
  // — this is exactly the list of things that still need a real dollar
  // amount, so there's nothing to retype or mistype.
  const dataRows = usage.map((u) => [u.year, u.productName, "", "", "", ""]);

  const buffer = await buildXlsxTemplate({
    sheetName: "Allocate Product Cost",
    columns: [
      { header: "Year", width: 10 },
      { header: "Product Name", width: 26 },
      { header: "Total Amount", width: 16, money: true },
      { header: "Category", width: 26, example: categories[0]?.name ?? "Chemicals" },
      { header: "Vendor (optional)", width: 22 },
      { header: "Date (optional, YYYY-MM-DD)", width: 20 },
    ],
    dataRows: dataRows.length ? dataRows : undefined,
    categoryNames: categories.map((c) => c.name),
    notes: [
      "This splits one lump-sum product bill across the fields that actually used it, by their logged activity — the same thing the \"Allocate Product Cost\" form does, just for many products at once.",
      "The Year and Product Name columns are already filled in from your actual field activity history — every product/year combo that's been logged and still needs a dollar amount. Just fill in Total Amount, Category, and (optionally) Vendor/Date for each row you want to allocate.",
      "Don't need to allocate a row right now? Leave its Total Amount blank and it'll be skipped — no need to delete the row.",
      "Want to allocate something not listed? Add a new row — Product Name just needs to match how it was logged on field activities for that year.",
      "Category must match a name exactly from the \"Categories (reference)\" sheet.",
      "Leave Date blank to file it at Dec 31 of that Year.",
    ],
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="farmledger-allocate-cost-template.xlsx"',
    },
  });
}
