import { PageHeader } from "@/components/ui/stat-card";
import { Landmark } from "lucide-react";

export default function BankingPage() {
  return (
    <div>
      <PageHeader title="Banking" description="Connect a bank or credit card to import transactions automatically." />
      <div className="card p-10 text-center max-w-lg mx-auto">
        <Landmark className="mx-auto text-forest" size={36} />
        <div className="font-semibold mt-3">No accounts connected</div>
        <p className="text-sm text-charcoal/55 mt-2">
          Bank connections use a secure, read-only aggregator (e.g. Plaid) &mdash; FarmLedger never
          sees or stores your online banking credentials. Imported transactions go through
          the same receipt-matching and category-confirmation flow as everything else before
          they touch your books.
        </p>
        <button disabled className="mt-4 bg-cream-deep text-charcoal/40 px-5 py-2.5 rounded-lg font-medium cursor-not-allowed">
          Connect a Bank Account (requires production credentials)
        </button>
        <p className="text-xs text-charcoal/40 mt-3">
          See ARCHITECTURE.md &rarr; &ldquo;Bank Integration&rdquo; for the connection flow and duplicate-prevention design.
        </p>
      </div>
    </div>
  );
}
