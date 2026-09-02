import Link from "next/link";
import { listJobs } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default function JobsPage() {
  const jobs = listJobs();
  return (
    <div>
      <PageHeader
        title="Custom Work Jobs"
        description={`${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
        action={<Link href="/work/jobs/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ New Job</Link>}
      />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Customer</th><th>Field</th><th>Service</th><th>Acres</th><th>Source</th><th className="text-right">Revenue</th><th className="text-right">Cost</th><th className="text-right">Margin</th><th>Status</th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="whitespace-nowrap">{j.completedDate ?? j.scheduledDate}</td>
                <td className="font-medium">{j.customerName}</td>
                <td>{j.customerFieldName ?? "—"}</td>
                <td>{j.jobService}</td>
                <td>{j.acres ?? "—"}</td>
                <td className="text-xs">{j.productSource === "our_business" ? "Our product" : "Customer supplied"}</td>
                <td className="text-right">{money(j.revenue)}</td>
                <td className="text-right">{money(j.directCost)}</td>
                <td className="text-right font-medium text-status-green">{money(j.revenue - j.directCost)}</td>
                <td><span className="status-pill status-blue">{j.status.replace("_", " ")}</span></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-charcoal/50">No jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
