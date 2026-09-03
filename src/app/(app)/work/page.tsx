import Link from "next/link";
import { listCustomers, listJobs, listInvoices } from "@/lib/data/repo";
import { PageHeader, StatCard, money } from "@/components/ui/stat-card";

export default async function WorkOverviewPage() {
  const customers = await listCustomers();
  const jobs = await listJobs();
  const invoices = await listInvoices();
  const outstanding = invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const jobMargin = jobs.reduce((s, j) => s + (j.revenue - j.directCost), 0);

  return (
    <div>
      <PageHeader title="Custom Work" description="Customers, jobs, invoicing and payments for work performed for others." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Customers" value={String(customers.length)} />
        <StatCard label="Jobs (YTD)" value={String(jobs.length)} />
        <StatCard label="Outstanding" value={money(outstanding)} tone={outstanding > 0 ? "amber" : "green"} />
        <StatCard label="Job Margin" value={money(jobMargin)} tone="green" />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Link prefetch={false} href="/work/customers" className="card p-5 hover:border-forest"><div className="font-semibold text-forest">Customers</div><p className="text-sm text-charcoal/55 mt-1">Customer list & balances</p></Link>
        <Link prefetch={false} href="/work/jobs" className="card p-5 hover:border-forest"><div className="font-semibold text-forest">Jobs</div><p className="text-sm text-charcoal/55 mt-1">Custom work jobs & margins</p></Link>
        <Link prefetch={false} href="/work/invoices" className="card p-5 hover:border-forest"><div className="font-semibold text-forest">Invoices & Payments</div><p className="text-sm text-charcoal/55 mt-1">Bill customers, record payments</p></Link>
      </div>
    </div>
  );
}
