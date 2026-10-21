"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { rescanReceiptsForSplitsAction, type ReceiptRescanFlag } from "@/lib/actions";

/**
 * "Review the ones already uploaded" — lets Kaydee kick off a re-scan of
 * every already-saved receipt photo, looking line-by-line for receipts that
 * quietly cover more than one category (the same check that now runs on new
 * receipts as they're scanned). Batches itself (see MAX_PER_RUN in the
 * action) so no single request times out; one click then runs batch after
 * batch on its own until every receipt has been looked at (Stop pauses it,
 * and a failed batch stops with a "Pick up where it left off" button).
 */
export function ReceiptRescanPanel() {
  const [isPending, setIsPending] = useState(false);
  const [started, setStarted] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [totalScanned, setTotalScanned] = useState(0);
  const [totalCandidates, setTotalCandidates] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<ReceiptRescanFlag[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  // Runs one batch after another until there are none left, Stop is
  // pressed, or a batch fails (then it can pick up from the same spot).
  async function runAll(fromCursor: number) {
    stopRef.current = false;
    setError(null);
    setIsPending(true);
    let next: number | null = fromCursor;
    try {
      while (next !== null && !stopRef.current) {
        const result = await rescanReceiptsForSplitsAction(next);
        setStarted(true);
        setTotalCandidates(result.totalCandidates);
        setTotalScanned((n) => n + result.scanned);
        setFlagged((prev) => [...prev, ...result.flagged]);
        next = result.nextCursor;
        if (next === null) setDone(true);
        else setCursor(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That scan didn't go through — try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-semibold text-forest">Re-check already-uploaded receipt photos</div>
        {!done && (isPending ? (
          <button
            type="button"
            onClick={() => { stopRef.current = true; }}
            className="rounded-full border border-forest text-forest text-sm font-medium px-4 py-1.5"
          >
            Scanning… Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => runAll(cursor)}
            className="rounded-full bg-forest text-white text-sm font-medium px-4 py-1.5"
          >
            {started ? "Pick up where it left off" : "Scan uploaded receipts"}
          </button>
        ))}
      </div>
      <p className="text-sm text-charcoal/55 mb-3">
        Looks at each already-uploaded receipt photo line by line, the same way a new receipt gets scanned, and flags any
        that look like they cover more than one category. Nothing is changed automatically — review a flagged receipt and
        use Split to actually break it out.
      </p>

      {error && <p className="text-sm text-rust mb-3">{error}</p>}

      {started && (
        <p className="text-sm text-charcoal/50 mb-3">
          Scanned {totalScanned}
          {totalCandidates !== null ? ` of ${totalCandidates}` : ""} receipt photo{totalScanned === 1 ? "" : "s"} so far.
          {done ? " That's all of them." : isPending ? " It keeps going on its own — leave this page open." : " Paused."}
        </p>
      )}

      {flagged.length > 0 && (
        <div className="space-y-3">
          {flagged.map((f) => (
            <div key={f.receiptId} className="rounded-xl border border-cream-dark/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-charcoal">
                  {f.vendorName ?? "Unknown vendor"} — {f.transactionDate ?? "no date on file"}
                </div>
                {f.linkedTransactionId ? (
                  <Link
                    href={`/money/transactions/${f.linkedTransactionId}/split`}
                    className="text-sm text-forest font-medium hover:underline shrink-0"
                  >
                    Split this transaction →
                  </Link>
                ) : (
                  <span className="text-xs text-charcoal/40 shrink-0">No linked transaction found</span>
                )}
              </div>
              <ul className="mt-1 text-sm text-charcoal/60">
                {f.categoryBreakdown.map((c, i) => (
                  <li key={i}>
                    {c.category}: ${c.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {done && flagged.length === 0 && (
        <p className="text-sm text-charcoal/50">No already-uploaded receipts looked like they needed splitting.</p>
      )}
    </div>
  );
}
