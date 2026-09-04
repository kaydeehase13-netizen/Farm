import { listTransactions, listFarmCategories, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { TransactionsTable } from "@/components/money/transactions-table";
import { ReceiptRescanPanel } from "@/components/money/receipt-rescan-panel";
import type { Transaction } from "@/types/domain";

// Keyword groups for the kind of thing that tends to get lumped onto one
// receipt/check even though it needs to be booked separately — oil, gas,
// and mineral royalties above all, since those are a different tax
// schedule entirely (Schedule E, not Schedule F) and previously had no
// category to go to at all. A transaction matching 2+ distinct groups is
// the strongest signal it's a blended receipt that needs to be split; one
// match alone is still worth a second look, especially if it hasn't been
// moved to one of the new "Royalty:" categories yet.
const KEYWORD_GROUPS: { label: string; pattern: RegExp }[] = [
  { label: "mineral", pattern: /mineral/i },
  { label: "oil", pattern: /\boil\b|petroleum/i },
  { label: "gas", pattern: /\bgas\b|natural gas/i },
  { label: "royalty", pattern: /royalt/i },
  { label: "lease / bonus", pattern: /\blease\b|bonus|delay rental/i },
];

function matchedGroups(t: Transaction): string[] {
  const text = `${t.vendorName ?? ""} ${t.description ?? ""}`;
  return KEYWORD_GROUPS.filter((g) => g.pattern.test(text)).map((g) => g.label);
}

export default async function CategoryAuditPage() {
  const [transactions, farmCategories, fields] = await Promise.all([
    listTransactions({}), // every year — old receipts from before this existed need checking too
    listFarmCategories(),
    listFields(),
  ]);

  const royaltyCategoryIds = new Set(farmCategories.filter((c) => c.name.startsWith("Royalty:")).map((c) => c.id));

  const flagged = transactions
    .map((t) => ({ t, groups: matchedGroups(t) }))
    .filter((r) => r.groups.length > 0);

  const isRoyaltyCategorized = (t: Transaction) => Boolean(t.farmCategoryId && royaltyCategoryIds.has(t.farmCategoryId));

  const likelyCombined = flagged.filter((r) => r.groups.length >= 2).map((r) => r.t);
  const worthReviewing = flagged
    .filter((r) => r.groups.length === 1 && !isRoyaltyCategorized(r.t))
    .map((r) => r.t);

  return (
    <div>
      <PageHeader
        title="Category Audit"
        description="A back-check for receipts that quietly needed to be split — oil, gas, and mineral royalties above all, since those weren't even categorizable correctly until now."
      />

      <ReceiptRescanPanel />

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-forest mb-2">Likely combined receipts ({likelyCombined.length})</div>
        <p className="text-sm text-charcoal/55 mb-3">
          These mention two or more of mineral / oil / gas / royalty / lease-bonus — a strong sign the receipt covered more
          than one kind of income and got entered as a single line. Open each one; if it really is combined, delete it and
          re-enter it with &quot;split into multiple categories&quot; checked on the{" "}
          <a href="/money/transactions/new?type=income" className="text-forest font-medium hover:underline">Record Transaction</a> form.
        </p>
        {likelyCombined.length === 0 ? (
          <p className="text-sm text-charcoal/50">Nothing flagged — no transaction on file mentions more than one of these keywords.</p>
        ) : (
          <TransactionsTable transactions={likelyCombined} categories={farmCategories} fields={fields} />
        )}
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-2">Worth a second look ({worthReviewing.length})</div>
        <p className="text-sm text-charcoal/55 mb-3">
          These mention one of the same keywords but aren&apos;t yet filed under a &quot;Royalty:&quot; category — recategorize
          them below if they belong there (new Oil &amp; Gas Royalty / Mineral Royalty / Lease Bonus categories are in the
          Category dropdown now).
        </p>
        {worthReviewing.length === 0 ? (
          <p className="text-sm text-charcoal/50">Nothing left to review.</p>
        ) : (
          <TransactionsTable transactions={worthReviewing} categories={farmCategories} fields={fields} />
        )}
      </div>
    </div>
  );
}
