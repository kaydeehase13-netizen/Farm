import { PageHeader } from "@/components/ui/stat-card";
import { getFarm } from "@/lib/data/repo";

const REPORTS = [
  { title: "Income Summary", desc: "Income by source and category", href: "/money/transactions?type=income" },
  { title: "Expense Summary", desc: "Expenses by category", href: "/money/transactions?type=expense" },
  { title: "Field Profitability", desc: "Income, expense and margin per field", href: "/fields" },
  { title: "Cost / Revenue / Margin per Acre", desc: "Per-acre economics by field", href: "/fields" },
  { title: "Custom Job Profitability", desc: "Revenue vs. direct cost by job", href: "/work/jobs" },
  { title: "Outstanding Invoices", desc: "Unpaid & overdue customer balances", href: "/work/invoices" },
  { title: "Equipment Repair Costs", desc: "Repair history & spend by asset", href: "/more/equipment" },
  { title: "Livestock Summary", desc: "Herd counts, purchases, sales, losses", href: "/more/livestock" },
  { title: "Mileage", desc: "Vehicle trips & total miles", href: "/more/vehicles" },
  { title: "Tax Organization", desc: "Readiness, missing docs, CPA questions", href: "/tax" },
];

export default function ReportsPage() {
  const farm = getFarm();
  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Tax year ${farm.currentTaxYear}. Every report below can be viewed, filtered, exported to Excel/CSV, or printed.`}
        action={
          <div className="flex gap-2">
            <a href="/api/export/cpa-workbook?type=full" className="card px-4 py-2 text-sm font-medium hover:border-forest">Full Excel Workbook</a>
            <a href="/api/export/field-report" className="card px-4 py-2 text-sm font-medium hover:border-forest">Field Report</a>
          </div>
        }
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
    </div>
  );
}
