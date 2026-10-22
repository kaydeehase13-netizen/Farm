"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { planAutoAllocateAction, runAutoAllocateStepAction, finishResplitAllAction } from "@/lib/actions";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

type Done = { year: number; productName: string; ok: boolean; message: string; from: number; to?: number };

/**
 * Splits every Prices Paid total across the fields that used it that year,
 * one product per request (a whole season in one request runs out of time).
 * runKey: bump it to start a run on its own (after an upload).
 */
export function AutoAllocate({ years, resplitOthers = false, runKey, showButton = true }: {
  years?: number[]; resplitOthers?: boolean; runKey?: number; showButton?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [done, setDone] = useState<Done[] | null>(null);
  const [notUsed, setNotUsed] = useState<{ year: number; productName: string; total: number }[]>([]);
  const [noDate, setNoDate] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const lastKey = useRef<number | undefined>(undefined);

  async function run() {
    if (running) return;
    setRunning(true); setErr(null); setDone(null); stop.current = false;
    try {
      const plan = await planAutoAllocateAction({ years, resplitOthers });
      setNotUsed(plan.notUsed); setNoDate(plan.noDate);
      const out: Done[] = [];
      for (let i = 0; i < plan.steps.length && !stop.current; i++) {
        const st = plan.steps[i];
        setProgress({ done: i, total: plan.steps.length, name: `${st.year} ${st.productName}` });
        try {
          const r = await runAutoAllocateStepAction(st);
          out.push({ year: st.year, productName: st.productName, ok: r.reallocated, message: r.message, from: st.current, to: r.totalAmount ?? st.total });
        } catch (e) {
          out.push({ year: st.year, productName: st.productName, ok: false, message: e instanceof Error ? e.message : "Failed.", from: st.current });
        }
      }
      setDone(out);
      if (out.length) { await finishResplitAllAction(); router.refresh(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't update field costs.");
    } finally {
      setProgress(null); setRunning(false);
    }
  }

  useEffect(() => {
    if (runKey == null || runKey <= 0 || runKey === lastKey.current) return;
    const t = window.setTimeout(() => { lastKey.current = runKey; void run(); }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const ok = done?.filter((d) => d.ok) ?? [];
  const failed = done?.filter((d) => !d.ok) ?? [];

  return (
    <div className="text-sm space-y-2">
      {showButton && !running && (
        <button type="button" onClick={run} className="card px-3 py-1.5 text-xs font-medium hover:border-forest">
          {resplitOthers ? "Update all field costs" : "Update field costs from Prices Paid"}
        </button>
      )}
      {running && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span>
            Updating field costs{progress ? ` ${progress.done + 1} of ${progress.total}: ${progress.name}` : "…"}
          </span>
          <button type="button" onClick={() => { stop.current = true; }} className="text-status-red hover:underline">Stop</button>
        </div>
      )}
      {err && <div className="text-xs text-status-red">{err}</div>}
      {done && (
        <div className="text-xs space-y-1">
          <div className="text-forest">
            {done.length === 0 ? "Field costs already match Prices Paid." : `Updated ${ok.length} product${ok.length === 1 ? "" : "s"} on the fields.`}
          </div>
          {ok.length > 0 && (
            <details>
              <summary className="cursor-pointer text-charcoal/60">What changed</summary>
              <ul className="list-disc pl-5 text-charcoal/70">
                {ok.map((d, i) => <li key={i}>{d.year} {d.productName}: {d.to != null && Math.abs((d.to ?? 0) - d.from) >= 0.01 ? `${money(d.from)} → ${money(d.to)}` : `re-split ${money(d.to ?? d.from)}`}</li>)}
              </ul>
            </details>
          )}
          {failed.length > 0 && (
            <div className="text-status-amber">
              Couldn&apos;t do {failed.length}:
              <ul className="list-disc pl-5">{failed.map((d, i) => <li key={i}>{d.year} {d.productName}: {d.message}</li>)}</ul>
            </div>
          )}
          {notUsed.length > 0 && (
            <details>
              <summary className="cursor-pointer text-charcoal/60">{notUsed.length} bought but not used on a field that year (left alone)</summary>
              <ul className="list-disc pl-5 text-charcoal/60">{notUsed.map((d, i) => <li key={i}>{d.year} {d.productName}: {money(d.total)}</li>)}</ul>
            </details>
          )}
          {noDate > 0 && <div className="text-charcoal/55">{noDate} purchase{noDate === 1 ? " has" : "s have"} no date, so no year to put {noDate === 1 ? "it" : "them"} in.</div>}
        </div>
      )}
    </div>
  );
}
