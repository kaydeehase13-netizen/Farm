"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scanTaxOpportunitiesAction } from "@/lib/actions";

export function ScanTaxOpportunitiesButton({ taxYear }: { taxYear: number }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ created: number; alreadyFlagged: number; checked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await scanTaxOpportunitiesAction(taxYear);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong running the scan.");
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
        {running ? `Scanning ${taxYear}…` : `Scan ${taxYear} for Tax Opportunities`}
      </button>
      {error && <p className="text-sm text-status-red mt-2">Ran into a problem: {error}</p>}
      {result && (
        <p className="text-sm mt-2 text-forest">
          {result.created === 0
            ? `Checked ${result.checked} records for ${taxYear} — nothing new to flag${result.alreadyFlagged ? ` (${result.alreadyFlagged} already flagged from an earlier scan)` : ""}.`
            : `Flagged ${result.created} new potential opportunit${result.created === 1 ? "y" : "ies"} for ${taxYear} — see below.`}
        </p>
      )}
    </div>
  );
}
