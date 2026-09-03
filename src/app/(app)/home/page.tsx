import Link from "next/link";
import { dashboardSummary, listTransactions, getFarm } from "@/lib/data/repo";
import { StatCard, PageHeader, money } from "@/components/ui/stat-card";
import { AlertTriangle, FileWarning, HelpCircle, Receipt, Boxes, WifiOff } from "lucide-react";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function HomePage() {
  const taxYear = await getViewTaxYear();
  const [farm, summary, allTxns] = await Promise.all([
    getFarm(),
    dashboardSummary(taxYear),
    listTransactions({ taxYear }),
  ]);
  const recent = allTxns.slice(0, 6);

  const attention = [
    { label: "Missing Receipts", count: summary.needsAttention.missingReceipts, href: "/money/receipts", icon: Receipt },
    { label: "Transactions Needing Review", count: summary.needsAttention.transactionsNeedingReview, href: "/money/transactions?status=needs_review", icon: FileWarning },
    { label: "CPA Questions", count: summary.needsAttention.cpaQuestionsOpen, href: "/tax", icon: HelpCircle },
    { label: "Overdue Invoices", count: summary.needsAttention.overdueInvoices, href: "/work/invoices", icon: AlertTriangle },
    { label: "Inventory Alerts", count: summary.needsAttention.lowInventory, href: "/more/inventory", icon: Boxes },
    { label: "Sync Problems", count: 0, href: "/more/settings", icon: WifiOff },
  ].filter((a) => a.count > 0);

  return (
    <div>
      <PageHeader
        title={`Good to see you — ${farm.name}, ${taxYear}`}
        description="Here's where things stand across the farm."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Income" value={money(summary.income)} sub={`Tax year ${taxYear}`} />
        <StatCard label="Expenses" value={money(summary.expenses)} />
        <StatCard label="Farm Margin" value={money(summary.margin)} tone={summary.margin >= 0 ? "green" : "red"} sub="Not the same as taxable income — ask your tax professional." />
        <StatCard
          label="Tax Readiness"
          value={`${summary.taxReadinessPct}%`}
          tone={summary.taxReadinessPct >= 80 ? "green" : summary.taxReadinessPct >= 50 ? "amber" : "red"}
        />
      </div>

      {attention.length > 0 && (
        <div className="card p-5 mb-8">
          <div className="text-sm font-semibold text-forest mb-3">Needs Attention</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {attention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-status-amber-bg text-status-amber text-sm font-medium hover:opacity-80"
              >
                <span className="flex items-center gap-2">
                  <a.icon size={16} /> {a.label}
                </span>
                <span className="font-semibold">{a.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Scan Receipt", href: "/money/receipts/new" },
          { label: "Spray a Field", href: "/fields/activities/new?type=spray" },
          { label: "Create Invoice", href: "/work/invoices/new" },
        ].map((q) => (
          <Link key={q.label} href={q.href} className="card p-5 text-center font-medium text-forest hover:border-forest">
            + {q.label}
          </Link>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-forest">Recent Activity</div>
          <Link href="/money/transactions" className="text-sm text-forest hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{t.transactionDate}</td>
                  <td>{t.description}</td>
                  <td>{t.vendorName ?? "—"}</td>
                  <td className={`text-right font-medium ${t.transactionType === "income" ? "text-status-green" : ""}`}>
                    {t.transactionType === "income" ? "+" : "-"}{money(t.amount)}
                  </td>
                  <td>
                    <span className={`status-pill ${t.status === "needs_review" ? "status-amber" : "status-green"}`}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
