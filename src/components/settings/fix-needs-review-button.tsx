"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fixStaleNeedsReviewAction } from "@/lib/actions";

export function FixNeedsReviewButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; fixed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fixStaleNeedsReviewAction();
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
        {running ? "Checking…" : "Fix Stuck \"Needs Review\" Flags"}
      </button>
      {error && <p className="text-sm text-status-red mt-2">Ran into a problem: {error}</p>}
      {result && (
        <div className="text-sm mt-2">
          <p className="text-forest">
            {result.checked === 0
              ? "Nothing stuck — no categorized transactions found still flagged Needs Review."
              : `Checked ${result.checked} transactions still flagged Needs Review — cleared the flag on ${result.fixed} that already had a category. Refresh the Home or Tax page to see the updated count.`}
          </p>
        </div>
      )}
    </div>
  );
}
