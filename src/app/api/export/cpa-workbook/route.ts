import { NextRequest, NextResponse } from "next/server";
import { buildWorkbook } from "@/lib/export/workbook";
import { getFarm } from "@/lib/data/repo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "cpa" ? "cpa" : "full";
  const farm = await getFarm();
  const taxYear = Number(searchParams.get("taxYear")) || farm.currentTaxYear;

  const buffer = await buildWorkbook({ scope: type, taxYear });

  const fileName = `${taxYear}_${farm.name.replace(/\s+/g, "_")}_${type === "cpa" ? "CPA_Workbook" : "Tax_Records"}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
