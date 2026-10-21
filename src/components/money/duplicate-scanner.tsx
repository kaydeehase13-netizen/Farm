"use client";

import { useEffect, useState, useTransition } from "react";
import { scanDuplicatesAction } from "@/lib/actions";
import { DuplicateGroups } from "@/components/money/duplicate-groups";

type Result = Awaited<ReturnType<typeof scanDuplicatesAction>>;

/**
 * Check for Duplicates: runs as soon as the page opens (all years, within
 * 3 days), and again whenever the window or years are changed.
 */
export function DuplicateScanner({ taxYear, names }: {
  taxYear: number;
  names: { categories: Record<string, string>; fields: Record<string, string> };
}) {
  const [days, setDays] = useState(3);
  const [scope, setScope] = useState<"all" | "year">("all");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [runId, setRunId] = useState(0);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await scanDuplicatesAction({ days, taxYear: scope === "year" ? taxYear : undefined }));
        setRunId((n) => n + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The check didn't finish — try again.");
      }
    });
  }

  useEffect(() => {
    // Run once when the page opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    run();
  }, []);

  const exact = result?.active.filter((g) => g.kind === "exact").length ?? 0;
  const close = (result?.active.length ?? 0) - exact;

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">Look at
            <select className="input mt-0.5 w-44!" value={scope} onChange={(e) => setScope(e.target.value as "all" | "year")}>
              <option value="all">Every year</option>
              <option value="year">Tax year {taxYear} only</option>
            </select>
          </label>
          <label className="text-xs">Same amount within
            <select className="input mt-0.5 w-36!" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={0}>Same day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
            </select>
          </label>
          <button type="button" onClick={run} disabled={isPending} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {isPending ? "Checking…" : result ? "Check again" : "Check for duplicates"}
          </button>
        </div>
        <p className="text-xs text-charcoal/55">
          Checks every kind of transaction (farm, W-2, royalties, house project, medical and personal), not just the farm.
          <b> Exact</b> = same name, date and amount. <b>Close</b> = same amount within the days above, even if the name is
          spelled differently (bank line vs receipt) or it was entered on a different day. Lines of one split receipt and the
          per-field lines of one cost split across fields are left out because they&apos;re meant to look alike.
        </p>
        {error && <p className="text-sm text-status-red">{error}</p>}
        {result && !isPending && (
          <p className="text-sm text-charcoal/70">
            Checked {result.scanned.toLocaleString()} transactions: {exact} exact and {close} close match group{close === 1 ? "" : "s"} to look at.
          </p>
        )}
      </div>

      {result && (
        <div className="card p-5" key={runId}>
          <p className="text-xs text-charcoal/55 mb-3">
            Tap <b>Compare</b> to see the copies side by side (differences highlighted) or <b>Open</b> each one. If they&apos;re
            both real, tap <b>Not a duplicate</b>. If one is a copy, pick which to keep and delete the rest.
          </p>
          <DuplicateGroups
            groups={result.active}
            reviewed={result.reviewed}
            names={names}
            emptyText="No possible duplicates found with these settings."
          />
        </div>
      )}
    </div>
  );
}
