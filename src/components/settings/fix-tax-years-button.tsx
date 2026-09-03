"use client";

import { useState } from "react";
import { fixMisfiledTaxYearsAction } from "@/lib/actions";

export function FixTaxYearsButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; fixed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fixMisfiledTaxYearsAction();
      setResult(res);
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
      {error && <p className="text-sm text-status-red mt-2">{error}</p>}
      {result && (
        <p className="text-sm text-forest mt-2">
          {result.fixed === 0
            ? `Checked ${result.checked} transactions — everything was already filed under the right year.`
            : `Checked ${result.checked} transactions and moved ${result.fixed} to the tax year matching their actual date.`}
        </p>
      )}
    </div>
  );
}
