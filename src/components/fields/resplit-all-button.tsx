"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAllocatedProductsAction,
  resplitProductAction,
  finishResplitAllAction,
  type ReallocationResult,
} from "@/lib/actions";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * One button that re-splits every product already allocated for the year by
 * the usage currently on file - e.g. after importing more field activity or
 * merging product names. Each product keeps its total, category, vendor and
 * date; only which fields share it (and how much) is recalculated. Runs one
 * product per request so a long list can't time out.
 */
export function ResplitAllButton({ years, defaultYear }: { years: number[]; defaultYear: number }) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [results, setResults] = useState<ReallocationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const products = await listAllocatedProductsAction(year);
      if (products.length === 0) {
        setError(`Nothing is allocated by usage for ${year} yet.`);
        return;
      }
      const out: ReallocationResult[] = [];
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        setProgress({ done: i, total: products.length, current: p.productName });
        try {
          out.push(await resplitProductAction({ year, productName: p.productName }));
        } catch (e) {
          out.push({ productName: p.productName, year, reallocated: false, message: e instanceof Error ? e.message : "Failed — try again." });
        }
        setResults([...out]);
      }
      setProgress({ done: products.length, total: products.length });
      await finishResplitAllAction().catch(() => {});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't re-split.");
    } finally {
      setBusy(false);
    }
  }

  const ok = results?.filter((r) => r.reallocated) ?? [];
  const failed = results?.filter((r) => !r.reallocated) ?? [];

  return (
    <div className="card p-5 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[16rem]">
          <div className="text-sm font-semibold text-forest">Re-split all product costs</div>
          <p className="text-xs text-charcoal/55">
            Recalculates every product already allocated for the year using the field activity on file now — after an import, a
            name merge, or edits. Totals, categories, vendors and dates stay the same; fields you added by hand keep their quantities.
          </p>
        </div>
        <select className="input w-28" value={year} disabled={busy} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" onClick={run} disabled={busy} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Re-splitting…" : "Re-split all"}
        </button>
      </div>

      {busy && progress && progress.done < progress.total && (
        <div className="mt-3 text-sm text-charcoal/70">
          {progress.done + 1} of {progress.total}{progress.current ? ` — ${progress.current}` : ""}… keep this page open.
          <div className="mt-2 h-1.5 rounded bg-charcoal/10 overflow-hidden">
            <div className="h-full bg-forest transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <div className="mt-3 text-sm text-status-red">{error}</div>}

      {results && results.length > 0 && (
        <div className="mt-4 border-t border-[--border-color] pt-3 text-sm">
          <div className="font-medium mb-2">
            {ok.length} of {progress?.total ?? results.length} re-split
            {failed.length > 0 && <span className="text-status-red"> · {failed.length} need attention</span>}
          </div>
          {failed.length > 0 && (
            <div className="space-y-1 mb-2">
              {failed.map((r, i) => (
                <div key={i} className="text-xs text-status-red">{r.productName}: {r.message}</div>
              ))}
            </div>
          )}
          <button type="button" className="text-xs text-forest hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Hide" : "Show"} field-by-field results
          </button>
          {showAll && (
            <div className="mt-2 max-h-96 overflow-y-auto space-y-2">
              {ok.map((r, i) => (
                <div key={i} className="text-xs">
                  <div className="font-medium">{r.productName} — {r.totalAmount != null ? money(r.totalAmount) : ""}</div>
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 text-charcoal/65">
                    {(r.fields ?? []).filter((f) => !f.excluded).map((f, j) => (
                      <div key={j} className="contents"><span>{f.fieldName}</span><span className="text-right">{money(f.amount)}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
