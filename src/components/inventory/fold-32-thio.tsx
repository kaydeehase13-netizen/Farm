"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preview32ThioFoldAction, apply32ThioFoldAction } from "@/lib/actions";

type Preview = Awaited<ReturnType<typeof preview32ThioFoldAction>>;
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/**
 * One-time fix: 32 Thio is each Kanza load (32-0-0 + Thio + Kanza Humic).
 * On every pass with 32 on it, those lines become one 32 Thio line, and
 * the field cost split under those names moves into 32 Thio. Humic or Thio
 * on a pass with no 32 stays as it is (that's your other humic).
 */
export function Fold32Thio() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [move, setMove] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function check() {
    setErr(null); setMsg(null);
    startTransition(async () => {
      try {
        const p = await preview32ThioFoldAction();
        setPreview(p);
        setMove(new Set(p.costs.map((c) => c.productName)));
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't check."); }
    });
  }

  function apply() {
    if (!preview) return;
    const total = preview.passesByYear.reduce((s, y) => s + y.count, 0);
    if (!window.confirm(`Make ${total} pass${total === 1 ? "" : "es"} one 32 Thio line each${move.size ? " and move the checked costs into 32 Thio" : ""}?`)) return;
    startTransition(async () => {
      try {
        const r = await apply32ThioFoldAction({ moveCostOf: [...move] });
        setMsg(`Done: ${r.passes} pass${r.passes === 1 ? "" : "es"} fixed.${r.results.length ? " " + r.results.join(" · ") : ""}`);
        setPreview(null);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't finish."); }
    });
  }

  const years = [...new Set(preview?.costs.map((c) => c.year) ?? [])].sort();

  return (
    <div className="card p-4 text-sm space-y-2">
      <div className="font-semibold text-forest">Fix 32 Thio passes</div>
      <p className="text-xs text-charcoal/60">
        32 Thio = a Kanza load: 32-0-0 + Thio + Kanza Humic. Any pass with 32 on it becomes one 32 Thio line. Humic or Thio on a pass
        with no 32 stays the same (that&apos;s your other humic). Check first; nothing changes until you tap Fix.
      </p>
      {!preview && (
        <button type="button" onClick={check} disabled={isPending} className="card px-3 py-1.5 text-xs font-medium hover:border-forest">
          {isPending ? "Checking…" : "Check passes"}
        </button>
      )}
      {preview && (
        <div className="space-y-2">
          <div>
            <b>Passes to fix:</b>{" "}
            {preview.passesByYear.length ? preview.passesByYear.map((y) => `${y.year}: ${y.count}`).join(" · ") : "none"}
          </div>
          {preview.examples.length > 0 && (
            <ul className="text-xs text-charcoal/65 list-disc pl-5">
              {preview.examples.map((x, i) => (
                <li key={i}>{x.date} {x.fieldName}: {x.parts.join(" + ")} → {Math.round(x.pounds).toLocaleString()} lb of 32 Thio</li>
              ))}
            </ul>
          )}
          <div className="text-xs text-charcoal/60">
            Left alone: {preview.standaloneHumic} pass{preview.standaloneHumic === 1 ? "" : "es"} with humic and no 32,
            {" "}{preview.standaloneThio} with Thio and no 32.
          </div>
          {preview.skipped.length > 0 && (
            <div className="text-xs text-status-amber">
              Skipped (unit not readable): {preview.skipped.map((s) => `${s.date} ${s.fieldName} (${s.why})`).join("; ")}
            </div>
          )}
          {years.length > 0 && (
            <div className="space-y-1">
              <b>Field cost to move into 32 Thio</b> <span className="text-xs text-charcoal/55">(uncheck any that isn&apos;t Kanza 32 Thio)</span>
              {years.map((y) => {
                const now = preview.blendNow.find((b) => b.year === y)?.amount ?? 0;
                const add = preview.costs.filter((c) => c.year === y && move.has(c.productName)).reduce((s, c) => s + c.amount, 0);
                return (
                  <div key={y} className="text-xs">
                    <div className="font-medium mt-1">{y}: 32 Thio {money(now)} → {money(now + add)}</div>
                    {preview.costs.filter((c) => c.year === y).map((c) => (
                      <label key={c.productName} className="flex items-center gap-2 ml-2">
                        <input type="checkbox" checked={move.has(c.productName)} onChange={() => setMove((m) => { const n = new Set(m); if (n.has(c.productName)) n.delete(c.productName); else n.add(c.productName); return n; })} />
                        {c.productName}: {money(c.amount)}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-3 items-center">
            <button type="button" onClick={apply} disabled={isPending || preview.passesByYear.length === 0} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {isPending ? "Fixing…" : "Fix"}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
          </div>
        </div>
      )}
      {msg && <div className="text-sm text-forest">{msg}</div>}
      {err && <div className="text-sm text-status-red">{err}</div>}
    </div>
  );
}
