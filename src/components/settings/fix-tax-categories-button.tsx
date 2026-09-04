"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backfillTaxCategoriesAction } from "@/lib/actions";

export function FixTaxCategoriesButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; fixed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await backfillTaxCategoriesAction();
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong running the repair.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        onClick={run} disabled={running}
        className="card px-4 py-2 text-sm font-medium hover:border-forest disabled:opacity-50"
      >
        {running ? "Checking…" : "Fix Missing Tax Categories"}
      </button>
      {error && <p className="text-sm text-status-red mt-2">Ran into a problem: {error}</p>}
      {result && (
        <div className="text-sm mt-2">
          <p className="text-forest">
            {result.checked === 0
              ? "No categorized transactions found on this farm to check."
              : result.fixed === 0
              ? `Checked ${result.checked} transactions — their tax categories already matched their farm category.`
              : `Checked ${result.checked} transactions and filled in the tax category on ${result.fixed} that were missing one. Refresh Reports or the CPA Workbook to see the update.`}
          </p>
        </div>
      )}
    </div>
  );
}
