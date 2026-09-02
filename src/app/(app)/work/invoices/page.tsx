import { listInvoices, listJobs } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";
import { createInvoiceAction, recordPaymentAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default function InvoicesPage() {
  const invoices = listInvoices();
  const uninvoicedJobs = listJobs().filter((j) => j.status === "completed" || (j.status === "scheduled" && !j.invoiceId));

  async function makeInvoice(formData: FormData) {
    "use server";
    await createInvoiceAction(formData);
    redirect("/work/invoices");
  }
  async function pay(formData: FormData) {
    "use server";
    await recordPaymentAction(formData);
    redirect("/work/invoices");
  }

  return (
    <div>
      <PageHeader title="Invoices & Payments" description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} />

      <div className="card overflow-x-auto mb-8">
        <table className="data-table">
          <thead><tr><th>#</th><th>Customer</th><th>Issued</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {invoices.map((inv) => {
              const balance = inv.total - inv.amountPaid;
              return (
                <tr key={inv.id}>
                  <td className="font-mono text-xs">#{inv.invoiceNumber}</td>
                  <td className="font-medium">{inv.customerName}</td>
                  <td>{inv.issueDate}</td>
                  <td>{inv.dueDate}</td>
                  <td className="text-right">{money(inv.total)}</td>
                  <td className="text-right">{money(inv.amountPaid)}</td>
                  <td className="text-right font-medium">{money(balance)}</td>
                  <td><span className={`status-pill ${inv.status === "paid" ? "status-green" : inv.status === "overdue" ? "status-red" : "status-amber"}`}>{inv.status}</span></td>
                  <td>
                    {balance > 0 && (
                      <details className="relative">
                        <summary className="text-forest text-sm cursor-pointer list-none underline">Record payment</summary>
                        <form action={pay} className="absolute right-0 z-10 mt-2 card p-4 w-64 space-y-2 shadow-lg bg-white">
                          <input type="hidden" name="invoiceId" value={inv.id} />
                          <input type="hidden" name="customerId" value={inv.customerId} />
                          <input type="number" step="0.01" name="amount" placeholder="Amount" defaultValue={balance} className="input" required />
                          <input type="date" name="paymentDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" required />
                          <input name="paymentMethod" placeholder="Check #, Cash, ACH…" className="input" />
                          <button className="bg-forest text-white w-full py-2 rounded-lg text-sm font-medium">Save Payment</button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {uninvoicedJobs.length > 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold text-forest mb-3">Completed jobs ready to invoice</div>
          <div className="space-y-2">
            {uninvoicedJobs.map((j) => (
              <form key={j.id} action={makeInvoice} className="flex items-center justify-between gap-3 text-sm border-b border-[--border-color] pb-2 last:border-0">
                <input type="hidden" name="jobId" value={j.id} />
                <div>{j.customerName} — {j.jobService} ({j.acres} ac) — {money(j.revenue)}</div>
                <button className="bg-wheat text-forest font-semibold px-3 py-1.5 rounded-lg text-xs">Create Invoice</button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
