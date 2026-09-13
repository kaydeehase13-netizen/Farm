import { PageHeader } from "@/components/ui/stat-card";
import { listTaxYears } from "@/lib/data/repo";
import { getViewTaxYear } from "@/lib/tax-year";
import { ExportYearPicker } from "@/components/reports/export-year-picker";

const REPORTS = [
  { title: "Income Summary", desc: "Income by source and category", href: "/money/transactions?type=income" },
  { title: "Expense Summary", desc: "Expenses by category", href: "/money/transactions?type=expense" },
  { title: "Field Profitability", desc: "Income, expense and margin per field", href: "/fields" },
  { title: "Chemical & Seed Usage", desc: "Every product used farm-wide, quantities and cost", href: "/reports/products" },
  { title: "Cost / Revenue / Margin per Acre", desc: "Per-acre economics by field", href: "/fields" },
  { title: "Custom Job Profitability", desc: "Revenue vs. direct cost by job", href: "/work/jobs" },
  { title: "Outstanding Invoices", desc: "Unpaid & overdue customer balances", href: "/work/invoices" },
  { title: "Equipment Repair Costs", desc: "Repair history & spend by asset", href: "/more/equipment" },
  { title: "Livestock Summary", desc: "Herd counts, purchases, sales, losses", href: "/more/livestock" },
  { title: "Mileage", desc: "Vehicle trips & total miles", href: "/more/vehicles" },
  { title: "Tax Organization", desc: "Readiness, missing docs, CPA questions", href: "/tax" },
];

const QUICK_EXPORTS = [
  { title: "Income & Expenses", scope: "income_expenses", desc: "Income, expenses, and category breakdowns only" },
  { title: "Receipts — Full Totals", scope: "receipts_full_total", desc: "One row per receipt/check at its full original amount — the companion to the itemized breakdown above, for split receipts" },
  { title: "Fields", scope: "fields", desc: "Field profitability, income/expense detail, crop & spray records" },
  { title: "Custom Work", scope: "work", desc: "Custom jobs, invoices, and payments" },
  { title: "Equipment & Vehicles", scope: "equipment", desc: "Assets, repairs, and mileage" },
  { title: "Livestock, Loans & Inventory", scope: "other", desc: "Livestock, loan, and inventory records" },
  { title: "Tax Review", scope: "tax_review", desc: "Potential tax opportunities & open CPA questions" },
];

export default async function ReportsPage() {
  const [taxYear, availableYears] = await Promise.all([getViewTaxYear(), listTaxYears()]);
  // Always offer the currently-viewed year even if listTaxYears() somehow
  // didn't include it, so the picker's default selection is never missing
  // from its own dropdown.
  const years = Array.from(new Set([...availableYears, taxYear])).sort((a, b) => b - a);
  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Tax year ${taxYear}. Every report below can be viewed, filtered, exported to Excel/CSV, or printed.`}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <a key={r.title} href={r.href} className="card p-5 hover:border-forest transition-colors block">
            <div className="font-semibold text-forest">{r.title}</div>
            <p className="text-sm text-charcoal/55 mt-1">{r.desc}</p>
            <div className="mt-3 flex gap-3 text-xs font-medium text-forest">
              <span>VIEW</span><span>·</span><span>FILTER</span><span>·</span><span>PRINT</span>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10">
        <div className="text-sm font-semibold text-forest mb-1">Excel Exports</div>
        <p className="text-sm text-charcoal/55 mb-4">
          Pick which year to export before downloading — it doesn&apos;t have to match whatever year you&apos;re currently viewing elsewhere in the app.
        </p>
        <ExportYearPicker years={years} defaultYear={taxYear}>
          {(exportYear) => (
            <>
              <div className="flex gap-2 mb-4">
                <a href={`/api/export/cpa-workbook?type=full&taxYear=${exportYear}`} className="card px-4 py-2 text-sm font-medium hover:border-forest">Full Excel Workbook</a>
                <a href={`/api/export/field-report?taxYear=${exportYear}`} className="card px-4 py-2 text-sm font-medium hover:border-forest">Field Report</a>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {QUICK_EXPORTS.map((e) => (
                  <a
                    key={e.scope}
                    href={`/api/export/cpa-workbook?type=${e.scope}&taxYear=${exportYear}`}
                    className="card p-5 hover:border-forest transition-colors block"
                  >
                    <div className="font-semibold text-forest">{e.title}</div>
                    <p className="text-sm text-charcoal/55 mt-1">{e.desc}</p>
                    <div className="mt-3 text-xs font-medium text-forest">DOWNLOAD .XLSX</div>
                  </a>
                ))}
              </div>
            </>
          )}
        </ExportYearPicker>
      </div>
    </div>
  );
}
