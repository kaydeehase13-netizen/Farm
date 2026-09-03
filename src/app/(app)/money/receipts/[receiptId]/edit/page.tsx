import { notFound } from "next/navigation";
import { listReceipts, listTransactions, listFarmCategories } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { EditReceiptForm } from "@/components/money/edit-receipt-form";

export default async function EditReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const [receipts, transactions, farmCategories] = await Promise.all([
    listReceipts(), listTransactions({}), listFarmCategories(),
  ]);
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) notFound();
  const txn = transactions.find((t) => t.receiptId === receiptId);

  return (
    <div className="max-w-lg">
      <PageHeader title="Edit Receipt" description="Fix the amount, date, vendor, or category — this updates the linked expense too." />
      {receipt.fileDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={receipt.fileDataUrl} alt="Receipt" className="w-full max-h-72 object-contain bg-charcoal/5 rounded-xl mb-4 border border-[--border-color]" />
      ) : (
        <p className="text-xs text-charcoal/45 mb-4">No photo saved for this receipt — it was uploaded before photo storage was added, or storage isn&apos;t set up yet.</p>
      )}
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
