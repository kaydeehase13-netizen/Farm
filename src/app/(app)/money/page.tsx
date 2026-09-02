import Link from "next/link";
import { dashboardSummary, getFarm, listInvoices, listLoans } from "@/lib/data/repo";
import { StatCard, PageHeader, money } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";

const TILES = [
  { href: "/money/transactions", label: "Transactions", desc: "All income & expenses, filterable and bulk-editable" },
  { href: "/money/receipts", label: "Receipts", desc: "Scanned & uploaded receipts, OCR review queue" },
  { href: "/money/transactions?type=income", label: "Income", desc: "Grain sales, custom work, government payments" },
  { href: "/money/transactions?type=expense", label: "Expenses", desc: "Every farm expense, categorized" },
  { href: "/work/invoices", label: "Invoices", desc: "Customer invoices & balances" },
  { href: "/work/invoices", label: "Payments", desc: "Payments received against invoices" },
  { href: "/money/banking", label: "Banking", desc: "Connected bank & credit-card accounts" },
  { href: "/money/loans", label: "Loans", desc: "Farm loans, balances & interest" },
];

export default async function MoneyOverviewPage() {
  const farm = await getFarm();
  const taxYear = await getViewTaxYear();
  const summary = await dashboardSummary(taxYear);
  const invoices = await listInvoices();
  const loans = await listLoans();
  const outstanding = invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const loanBalance = loans.reduce((s, l) => s + (l.currentBalance ?? 0), 0);

  return (
    <div>
      <PageHeader title="Money" description="Everything financial, in one place." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Income (YTD)" value={money(summary.income)} />
        <StatCard label="Expenses (YTD)" value={money(summary.expenses)} />
        <StatCard label="Outstanding Invoices" value={money(outstanding)} tone={outstanding > 0 ? "amber" : "green"} />
        <StatCard label="Loan Balance" value={money(loanBalance)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href} className="card p-5 hover:border-forest transition-colors">
            <div className="font-semibold text-forest">{t.label}</div>
            <div className="text-sm text-charcoal/55 mt-1">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
