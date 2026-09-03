import { notFound } from "next/navigation";
import { getReceipt, listTransactions, listFarmCategories } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { EditReceiptForm } from "@/components/money/edit-receipt-form";
import { ReceiptThumbnail } from "@/components/money/receipt-thumbnail";

export default async function EditReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const [receipt, transactions, farmCategories] = await Promise.all([
    getReceipt(receiptId), listTransactions({}), listFarmCategories(),
  ]);
  if (!receipt) notFound();
  const txn = transactions.find((t) => t.receiptId === receiptId);

  return (
    <div className="max-w-lg">
      <PageHeader title="Edit Receipt" description="Fix the amount, date, vendor, or category — this updates the linked expense too." />
      <ReceiptThumbnail receiptId={receipt.id} className="w-full max-h-72 object-contain bg-charcoal/5 rounded-xl mb-4 border border-[--border-color]" />
      <EditReceiptForm
        receiptId={receipt.id}
        hasTransaction={Boolean(txn)}
        vendorName={txn?.vendorName ?? receipt.ocrVendorGuess ?? ""}
        date={txn?.transactionDate ?? receipt.ocrDateGuess ?? new Date().toISOString().slice(0, 10)}
        amount={txn?.amount ?? receipt.ocrAmountGuess ?? 0}
        salesTax={txn?.salesTax ?? receipt.ocrTaxGuess ?? 0}
        farmCategoryId={txn?.farmCategoryId ?? ""}
        farmCategories={farmCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
