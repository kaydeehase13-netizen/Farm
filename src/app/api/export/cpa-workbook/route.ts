import { NextRequest, NextResponse } from "next/server";
import { buildWorkbook, type WorkbookScope } from "@/lib/export/workbook";
import { getFarm } from "@/lib/data/repo";

const VALID_SCOPES: WorkbookScope[] = [
  "full", "cpa", "income_expenses", "fields", "work", "equipment", "other", "tax_review", "receipts_full_total",
  "field_report", "custom_work", "spray",
];

const FILE_LABEL: Record<WorkbookScope, string> = {
  full: "Tax_Records",
  cpa: "CPA_Workbook",
  income_expenses: "Income_and_Expenses",
  fields: "Field_Records",
  work: "Custom_Work",
  equipment: "Equipment_and_Vehicles",
  other: "Other_Records",
  tax_review: "Tax_Review",
  receipts_full_total: "Receipts_Full_Total",
  field_report: "Field_Records",
  custom_work: "Custom_Work",
  spray: "Spray_Records",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("type");
  const type: WorkbookScope = VALID_SCOPES.includes(requested as WorkbookScope) ? (requested as WorkbookScope) : "full";
  const farm = await getFarm();
  const taxYear = Number(searchParams.get("taxYear")) || farm.currentTaxYear;

  const buffer = await buildWorkbook({ scope: type, taxYear });

  const fileName = `${taxYear}_${farm.name.replace(/\s+/g, "_")}_${FILE_LABEL[type]}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
