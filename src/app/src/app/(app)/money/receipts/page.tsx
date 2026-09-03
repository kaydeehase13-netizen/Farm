import Link from "next/link";
import { listReceipts } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { DeleteReceiptButton } from "@/components/money/delete-receipt-button";
import { ReceiptThumbnail } from "@/components/money/receipt-thumbnail";

export default async function ReceiptsPage() {
  const receipts = await listReceipts();
  return (
    <div>
      <PageHeader
        title="Receipts"
        description={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"} on file`}
        action={
          <div className="flex gap-2">
            <Link prefetch={false} href="/money/receipts/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Scan / Upload Receipt</Link>
            <Link prefetch={false} href="/money/receipts/batch" className="card px-4 py-2 text-sm font-medium hover:border-forest">Batch Upload</Link>
            <Link prefetch={false} href="/money/transactions/import-excel" className="card px-4 py-2 text-sm font-medium hover:border-forest">Import from Excel</Link>
          </div>
        }
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {receipts.map((r) => (
          <div key={r.id} className="card p-4">
            <ReceiptThumbnail receiptId={r.id} className="w-full h-32 object-cover rounded-lg bg-charcoal/5 mb-3" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-charcoal/50">{r.captureSource.replace("_", " ")}</span>
              <span className={`status-pill ${r.ocrStatus === "confirmed" ? "status-green" : r.ocrStatus === "failed" ? "status-red" : "status-amber"}`}>
                {r.ocrStatus}
              </span>
            </div>
            <div className="font-medium">{r.ocrVendorGuess ?? "Vendor unknown"}</div>
            <div className="text-sm text-charcoal/55">{r.ocrDateGuess ?? "—"} · {r.ocrAmountGuess ? `$${r.ocrAmountGuess.toFixed(2)}` : "—"}</div>
            {r.ocrStatus !== "confirmed" ? (
              <div className="mt-3 flex items-center justify-between">
                <Link prefetch={false} href={`/money/receipts/${r.id}/confirm`} className="text-sm font-medium text-forest hover:underline">
                  Review & confirm →
                </Link>
                <DeleteReceiptButton receiptId={r.id} hasTransaction={Boolean(r.linkedTransactionId)} />
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-status-green">Linked to transaction</span>
                <div className="flex items-center gap-3">
                  <Link prefetch={false} href={`/money/receipts/${r.id}/edit`} className="text-sm font-medium text-forest hover:underline">Edit →</Link>
                  <DeleteReceiptButton receiptId={r.id} hasTransaction={Boolean(r.linkedTransactionId)} />
                </div>
              </div>
            )}
          </div>
        ))}
        {receipts.length === 0 && <div className="text-charcoal/50">No receipts yet.</div>}
      </div>
    </div>
  );
}
