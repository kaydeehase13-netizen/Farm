"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSeedRatesAction } from "@/lib/actions";

export type SeedPlantingRow = {
  activityId: string; year: number; date: string; fieldName: string; seed: string; acres: number;
  rate?: number; rateUnit?: string;
};

/**
 * Seed by the pound (wheat): AgFiniti doesn't record a seeding rate for
 * wheat, and the rate varies by field, so type the lb/acre for each
 * planting. The seed's cost is then split by pounds (lb/ac x acres)
 * instead of by acres; if it's already allocated, it's re-split on save.
 */
export function SeedPoundRates({ plantings, years, defaultYear }: { plantings: SeedPlantingRow[]; years: number[]; defaultYear: number }) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const seeds = [...new Set(plantings.filter((p) => p.year === year).map((p) => p.seed))].sort();
  const [seed, setSeed] = useState(() => seeds.find((s) => /wheat|prolific/i.test(s)) ?? seeds[0] ?? "");
  const rows = plantings.filter((p) => p.year === year && p.seed === seed);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rateFor = (r: SeedPlantingRow) =>
    rates[r.activityId] ?? (r.rate && /lb|pound/i.test(r.rateUnit ?? "") ? String(r.rate) : "");
  const totalLb = rows.reduce((s, r) => s + (Number(rateFor(r)) || 0) * r.acres, 0);
  const missing = rows.filter((r) => !(Number(rateFor(r)) > 0)).length;

  function save() {
    setMsg(null); setErr(null);
    startTransition(async () => {
      try {
        const res = await saveSeedRatesAction({
          year, productName: seed,
          entries: rows.map((r) => ({ activityId: r.activityId, lbPerAcre: Number(rateFor(r)) || null })),
        });
        setMsg(res.resplit
          ? (res.resplit.reallocated ? `Saved, and ${seed}'s ${year} cost was re-split by pounds.` : `Saved. Re-split didn't run: ${res.resplit.message}`)
          : `Saved. Now allocate ${seed} for ${year} above and it will split by pounds.`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold text-forest">Seed by the pound (wheat)</div>
        <p className="text-xs text-charcoal/55">
          For seed planted in lb/acre. Enter the rate for each field and the seed&apos;s cost is split by pounds (lb/acre × acres)
          instead of by acres. Every planting of that seed needs a rate. If the seed is already allocated, saving re-splits it.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs">Year
          <select className="input mt-0.5 w-28!" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); const s = [...new Set(plantings.filter((p) => p.year === y).map((p) => p.seed))].sort(); setSeed(s.find((x) => /wheat|prolific/i.test(x)) ?? s[0] ?? ""); setRates({}); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs">Seed
          <select className="input mt-0.5 w-56!" value={seed} onChange={(e) => { setSeed(e.target.value); setRates({}); }}>
            {seeds.length === 0 && <option value="">No plantings this year</option>}
            {seeds.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {rows.length > 0 && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-charcoal/50 text-right">
                <th className="text-left py-1 font-normal">Field</th>
                <th className="text-left py-1 font-normal">Planted</th>
                <th className="py-1 font-normal">Acres</th>
                <th className="py-1 font-normal">lb/acre</th>
                <th className="py-1 font-normal">Pounds</th>
              </tr>
            </thead>
            <tbody className="text-right">
              {rows.map((r) => (
                <tr key={r.activityId} className="border-t border-charcoal/10">
                  <td className="text-left py-1">{r.fieldName}</td>
                  <td className="text-left py-1 text-xs text-charcoal/60">{r.date}</td>
                  <td className="py-1">{r.acres.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="py-1">
                    <input className="input w-20! text-right py-1!" type="number" step="0.1" min="0" value={rateFor(r)}
                      onChange={(e) => setRates((m) => ({ ...m, [r.activityId]: e.target.value }))} />
                  </td>
                  <td className="py-1">{((Number(rateFor(r)) || 0) * r.acres).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-charcoal/20 font-semibold">
                <td className="text-left py-1" colSpan={2}>Total</td>
                <td className="py-1">{rows.reduce((s, r) => s + r.acres, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td />
                <td className="py-1">{totalLb.toLocaleString(undefined, { maximumFractionDigits: 0 })} lb</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={isPending} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {isPending ? "Saving…" : "Save lb/acre"}
            </button>
            {missing > 0 && <span className="text-xs text-status-amber">{missing} field{missing === 1 ? "" : "s"} still need a rate.</span>}
            {msg && <span className="text-xs text-forest">{msg}</span>}
            {err && <span className="text-xs text-status-red">{err}</span>}
          </div>
        </>
      )}
    </div>
  );
}
