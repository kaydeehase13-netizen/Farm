import { notFound } from "next/navigation";
import { getTransaction, listFarmCategories } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { SplitTransactionForm } from "@/components/money/split-transaction-form";

export default async function SplitTransactionPage({
  params,
}: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  const [transaction, farmCategories] = await Promise.all([
    getTransaction(transactionId),
    listFarmCategories(),
  ]);
  if (!transaction) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Split Transaction"
        description={`${transaction.vendorName ?? transaction.description ?? "Transaction"} — ${transaction.transactionDate}`}
      />
      <SplitTransactionForm
        transactionId={transaction.id}
        originalType={transaction.transactionType === "income" ? "income" : "expense"}
        originalAmount={transaction.amount}
        originalFarmCategoryId={transaction.farmCategoryId}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
