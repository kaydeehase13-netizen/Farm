import { listTransactions, listTaxQuestions, dashboardSummary, getFarm, listAssets } from "@/lib/data/repo";
import { PageHeader, StatCard, money } from "@/components/ui/stat-card";
import { answerTaxQuestionAction, toggleCpaReviewAction } from "@/lib/actions";
import { redirect } from "next/navigation";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function CpaPortalPage() {
  const farm = await getFarm();
  const taxYear = await getViewTaxYear();
  const summary = await dashboardSummary(taxYear);
  const flagged = (await listTransactions({ taxYear: taxYear })).filter((t) => t.cpaFlag);
  const questions = await listTaxQuestions();
  const assets = await listAssets();

  async function answer(formData: FormData) {
    "use server";
    await answerTaxQuestionAction(formData);
    redirect("/cpa");
  }
  async function toggleReview(formData: FormData) {
    "use server";
    await toggleCpaReviewAction(formData);
    redirect("/cpa");
  }

  return (
    <div>
      <PageHeader
        title="CPA Portal"
        description={`${farm.name} · Tax year ${taxYear} — full web experience, no mobile app needed.`}
        action={
          <div className="flex gap-2">
            <a href="/api/export/cpa-workbook?type=cpa" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">Download CPA Workbook (.xlsx)</a>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Income" value={money(summary.income)} />
        <StatCard label="Expenses" value={money(summary.expenses)} />
        <StatCard label="Farm Margin" value={money(summary.margin)} tone={summary.margin >= 0 ? "green" : "red"} />
        <StatCard label="Tax Readiness" value={`${summary.taxReadinessPct}%`} />
      </div>

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-forest mb-3">Flagged for CPA Review</div>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Description</th><th className="text-right">Amount</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>
            {flagged.map((t) => (
              <tr key={t.id}>
                <td>{t.transactionDate}</td>
                <td>{t.description}</td>
                <td className="text-right">{money(t.amount)}</td>
                <td className="text-charcoal/60 text-xs">{t.cpaNote}</td>
                <td>
                  <form action={toggleReview}>
                    <input type="hidden" name="transactionId" value={t.id} />
                    <button className={`status-pill ${t.status === "reconciled" ? "status-green" : "status-amber"}`}>
                      {t.status === "reconciled" ? "Reviewed ✓" : "Mark Reviewed"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {flagged.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-charcoal/50">Nothing flagged.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-forest mb-3">Assets on File</div>
        <table className="data-table">
          <thead><tr><th>Asset</th><th>Purchased</th><th className="text-right">Price</th><th>Use %</th></tr></thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.purchaseDate}</td><td className="text-right">{a.purchasePrice ? money(a.purchasePrice) : "—"}</td><td>{a.businessUsePercent}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-3">Client Questions</div>
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="border-b border-[--border-color] pb-4 last:border-0">
              <div className="text-sm font-medium">{q.question}</div>
              <div className="text-xs text-charcoal/45 mt-1">From {q.raisedByName} · {q.status}</div>
              {q.cpaResponse ? (
                <div className="text-sm mt-2 bg-status-blue-bg text-status-blue rounded-lg px-3 py-2">{q.cpaResponse}</div>
              ) : (
                <form action={answer} className="mt-2 flex gap-2">
                  <input type="hidden" name="questionId" value={q.id} />
                  <input name="response" className="input" placeholder="Your response…" required />
                  <button className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium">Reply</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
