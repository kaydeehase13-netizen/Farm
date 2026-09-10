import { notFound } from "next/navigation";
import Link from "next/link";
import { getVendor, listVendorTransactions } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";
import { renameVendorAction } from "@/lib/actions";

export default async function VendorDetailPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const [vendor, transactions] = await Promise.all([
    getVendor(vendorId),
    listVendorTransactions(vendorId),
  ]);
  if (!vendor) notFound();

  async function action(formData: FormData) {
    "use server";
    await renameVendorAction(vendorId, formData);
  }

  return (
    <div>
      <PageHeader
        title={vendor.name}
        description="Rename this vendor/income source, or type an existing vendor's name to merge the two — every transaction below moves with it automatically."
      />

      <form action={action} className="card p-5 mb-6 flex items-end gap-3 max-w-lg">
        <label className="flex-1">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Name</div>
          <input name="name" defaultValue={vendor.name} required className="input" />
        </label>
        <button className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">
          Save
        </button>
      </form>

      <div className="text-sm font-semibold text-forest mb-3">
        {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
      </div>
      {transactions.length === 0 ? (
        <div className="card p-8 text-center text-charcoal/55">No transactions for this vendor yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{t.transactionDate}</td>
                  <td className="capitalize">{t.transactionType}</td>
                  <td>
                    <Link prefetch={false} href="/money/transactions" className="hover:underline">{t.description || "—"}</Link>
                  </td>
                  <td className={`text-right font-medium ${t.transactionType === "income" ? "text-status-green" : ""}`}>
                    {t.transactionType === "income" ? "+" : "-"}{money(t.amount)}
                  </td>
                  <td>
                    <span className={`status-pill ${
                      t.status === "needs_review" ? "status-amber" : t.status === "excluded_personal" ? "status-red" : "status-green"
                    }`}>{t.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
