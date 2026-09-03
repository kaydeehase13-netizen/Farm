import { listCustomers, listJobs } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default async function CustomersPage() {
  const customers = await listCustomers();
  const jobs = await listJobs();
  return (
    <div>
      <PageHeader title="Customers" description="Everyone you do custom work for." />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Jobs</th><th className="text-right">Balance Due</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{c.contactName} {c.phone && <span className="text-charcoal/50">· {c.phone}</span>}</td>
                <td>{jobs.filter((j) => j.customerId === c.id).length}</td>
                <td className={`text-right font-medium ${c.balanceDue > 0 ? "text-status-amber" : ""}`}>{money(c.balanceDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
