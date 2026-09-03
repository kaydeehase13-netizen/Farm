import Link from "next/link";
import { listReceipts } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";

export default async function ReceiptsPage() {
  const receipts = await listReceipts();
  return (
    <div>
      <PageHeader
        title="Receipts"
        description={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"} on file`}
        action={
          <div className="flex gap-2">
            <Link href="/money/receipts/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Scan / Upload Receipt</Link>
            <Link href="/money/receipts/batch" className="card px-4 py-2 text-sm font-medium hover:border-forest">Batch Upload</Link>
          </div>
        }
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {receipts.map((r) => (
          <div key={r.id} className="card p-4">
            {r.fileDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.fileDataUrl} alt="" className="w-full h-32 object-cover rounded-lg bg-charcoal/5 mb-3" />
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-charcoal/50">{r.captureSource.replace("_", " ")}</span>
              <span className={`status-pill ${r.ocrStatus === "confirmed" ? "status-green" : r.ocrStatus === "failed" ? "status-red" : "status-amber"}`}>
                {r.ocrStatus}
              </span>
            </div>
            <div className="font-medium">{r.ocrVendorGuess ?? "Vendor unknown"}</div>
            <div className="text-sm text-charcoal/55">{r.ocrDateGuess ?? "—"} · {r.ocrAmountGuess ? `$${r.ocrAmountGuess.toFixed(2)}` : "—"}</div>
            {r.ocrStatus !== "confirmed" ? (
              <Link href={`/money/receipts/${r.id}/confirm`} className="mt-3 inline-block text-sm font-medium text-forest hover:underline">
                Review & confirm →
              </Link>
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-status-green">Linked to transaction</span>
                <Link href={`/money/receipts/${r.id}/edit`} className="text-sm font-medium text-forest hover:underline">Edit →</Link>
              </div>
            )}
          </div>
        ))}
        {receipts.length === 0 && <div className="text-charcoal/50">No receipts yet.</div>}
      </div>
    </div>
  );
}
