"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fixMisfiledTaxYearsAction } from "@/lib/actions";

export function FixTaxYearsButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; fixed: number; failed?: number; sample?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fixMisfiledTaxYearsAction();
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
        {running ? "Checking…" : "Re-file Transactions by Their Actual Date"}
      </button>
      {error && <p className="text-sm text-status-red mt-2">Ran into a problem: {error}</p>}
      {result && (
        <div className="text-sm mt-2">
          <p className="text-forest">
            {result.checked === 0
              ? "No transactions found on this farm to check."
              : result.fixed === 0
              ? `Checked ${result.checked} transactions — everything was already filed under the right year.`
              : `Checked ${result.checked} transactions and moved ${result.fixed} to the tax year matching their actual date. Refresh the Home or Transactions page to see the update.`}
          </p>
          {!!result.failed && (
            <p className="text-status-amber mt-1">
              {result.failed} couldn&apos;t be updated{result.sample?.length ? `: ${result.sample.join("; ")}` : "."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
