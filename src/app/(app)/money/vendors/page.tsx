import Link from "next/link";
import { listVendors } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default async function VendorsPage() {
  const vendors = await listVendors();
  return (
    <div>
      <PageHeader
        title="Vendors & Income Sources"
        description={'Everyone you\'ve paid or been paid by — the same list, since "Vendor" on an expense and "Source / Buyer" on income are the same field. Click into one to fix a name or merge a duplicate.'}
      />
      {vendors.length === 0 ? (
        <div className="card p-8 text-center text-charcoal/55">
          No vendors or income sources yet — they show up here as soon as you enter a transaction with one.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th className="text-right">Transactions</th><th className="text-right">Total Income</th><th className="text-right">Total Expense</th></tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">
                    <Link prefetch={false} href={`/money/vendors/${v.id}`} className="text-forest hover:underline">{v.name}</Link>
                  </td>
                  <td className="text-right">{v.transactionCount}</td>
                  <td className="text-right">{v.totalIncome ? money(v.totalIncome) : "—"}</td>
                  <td className="text-right">{v.totalExpense ? money(v.totalExpense) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
