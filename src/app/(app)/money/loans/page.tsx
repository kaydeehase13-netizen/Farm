import { listLoans } from "@/lib/data/repo";
import { PageHeader, money } from "@/components/ui/stat-card";

export default async function LoansPage() {
  const loans = await listLoans();
  return (
    <div>
      <PageHeader title="Loans" description="Farm loans, balances, and interest." />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Lender</th><th>Original Principal</th><th>Rate</th><th>Origination</th><th className="text-right">Current Balance</th></tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td className="font-medium">{l.lenderName}<div className="text-xs text-charcoal/50">{l.notes}</div></td>
                <td>{l.originalPrincipal ? money(l.originalPrincipal) : "—"}</td>
                <td>{l.interestRate ? `${l.interestRate}%` : "—"}</td>
                <td>{l.originationDate}</td>
                <td className="text-right font-medium">{l.currentBalance ? money(l.currentBalance) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
