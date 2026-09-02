import { dashboardSummary, listTaxOpportunities, listTaxQuestions, getFarm } from "@/lib/data/repo";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import { createTaxQuestionAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function TaxCenterPage() {
  const farm = await getFarm();
  const summary = await dashboardSummary(farm.currentTaxYear);
  const opportunities = await listTaxOpportunities();
  const questions = await listTaxQuestions();

  async function askQuestion(formData: FormData) {
    "use server";
    await createTaxQuestionAction(formData);
    redirect("/tax");
  }

  return (
    <div>
      <PageHeader
        title="Tax Center"
        description="FarmLedger organizes your tax information. It does not file your return or make tax-law determinations — always ask your tax professional."
        action={<a href="/api/export/cpa-workbook?type=cpa" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">Export for CPA</a>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tax Readiness" value={`${summary.taxReadinessPct}%`} tone={summary.taxReadinessPct >= 80 ? "green" : "amber"} />
        <StatCard label="Missing Receipts" value={String(summary.needsAttention.missingReceipts)} tone={summary.needsAttention.missingReceipts > 0 ? "amber" : "green"} />
        <StatCard label="Transactions Needing Review" value={String(summary.needsAttention.transactionsNeedingReview)} tone={summary.needsAttention.transactionsNeedingReview > 0 ? "amber" : "green"} />
        <StatCard label="Open CPA Questions" value={String(summary.needsAttention.cpaQuestionsOpen)} tone={summary.needsAttention.cpaQuestionsOpen > 0 ? "blue" : "green"} />
      </div>

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-forest mb-1">Potential Tax Opportunities</div>
        <p className="text-xs text-charcoal/50 mb-4">These flag transactions or assets that may deserve a closer look — not a determination of tax treatment.</p>
        <div className="space-y-3">
          {opportunities.map((o) => (
            <div key={o.id} className="border border-[--border-color] rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="status-pill status-blue mb-1.5">Potential Tax Opportunity</div>
                  <div className="font-medium">{o.ruleTitle}</div>
                  <p className="text-sm text-charcoal/60 mt-1">{o.ruleDescription}</p>
                </div>
                <span className={`status-pill shrink-0 ${o.status === "ready_for_cpa" ? "status-green" : "status-amber"}`}>{o.status.replace(/_/g, " ")}</span>
              </div>
              {o.infoMissing.length > 0 && (
                <div className="mt-3 text-sm">
                  <div className="text-charcoal/50 mb-1">Information still needed:</div>
                  <ul className="list-disc list-inside text-charcoal/70">
                    {o.infoMissing.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 text-sm">
                {o.officialReference && <a href={o.officialReference} target="_blank" className="text-forest underline">Official reference</a>}
                <span className="text-charcoal/40">This may require tax-professional review. Ask your tax professional.</span>
              </div>
            </div>
          ))}
          {opportunities.length === 0 && <p className="text-sm text-charcoal/50">No potential tax opportunities flagged for {farm.currentTaxYear} yet.</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="text-sm font-semibold text-forest mb-3">CPA Questions</div>
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="border-b border-[--border-color] pb-3 last:border-0">
                <div className="text-sm">{q.question}</div>
                <div className="text-xs text-charcoal/45 mt-1">Raised by {q.raisedByName} · {q.status}</div>
                {q.cpaResponse && <div className="text-sm mt-2 bg-status-blue-bg text-status-blue rounded-lg px-3 py-2">{q.cpaResponse}</div>}
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-charcoal/50">No open questions.</p>}
          </div>
        </div>

        <form action={askQuestion} className="card p-5 h-fit">
          <div className="text-sm font-semibold text-forest mb-3">Ask My Tax Professional</div>
          <textarea name="question" rows={4} className="input" placeholder="What would you like your CPA to weigh in on?" required />
          <input type="hidden" name="raisedByName" value="Kaydee" />
          <button className="mt-3 bg-wheat text-forest font-semibold px-4 py-2 rounded-lg w-full">Send Question</button>
        </form>
      </div>
    </div>
  );
}
