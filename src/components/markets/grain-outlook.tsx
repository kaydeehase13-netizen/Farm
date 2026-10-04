"use client";

import { useEffect, useState } from "react";
import { netPrice, type CropOutlook, type CropKey } from "@/lib/grain-markets";

type Settings = Record<CropKey, { basis: string; storage: string; bushels: string; overrides: Record<string, string> }>;
const STORE = "farmledger-grain-outlook-v1";

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

/**
 * Grain price outlook table: per crop, today's price and the forward
 * (futures) price at 30/60/90/120 days and a year, turned into an estimated
 * cash price with your basis, then a net after storage and interest, with
 * the best time to sell highlighted. Your basis, storage, interest and
 * bushels are remembered in this browser.
 */
export function GrainOutlook({ outlook }: { outlook: CropOutlook[] }) {
  const initial = () => Object.fromEntries(outlook.map((o) => [o.crop.key, {
    basis: o.crop.defaultBasis.toFixed(2), storage: "3", bushels: "", overrides: {},
  }])) as unknown as Settings;
  const [settings, setSettings] = useState<Settings>(initial);
  const [interest, setInterest] = useState("7");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (saved.settings) setSettings((s) => ({ ...s, ...saved.settings }));
        if (saved.interest) setInterest(saved.interest);
      }
    } catch { /* storage unavailable: keep defaults */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(STORE, JSON.stringify({ settings, interest })); } catch { /* ignore */ }
  }, [settings, interest, loaded]);

  const set = (k: CropKey, patch: Partial<Settings[CropKey]>) => setSettings((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const anyMissing = outlook.some((o) => o.points.some((p) => p.futures == null));

  return (
    <div className="space-y-6">
      <div className="card p-4 text-sm text-charcoal/70 space-y-1">
        <p>
          <b>How to read this:</b> the futures price for a later month is what the market is paying <i>today</i> for grain delivered then —
          it&apos;s the market&apos;s own forecast, not a guarantee. <b>Est. cash</b> = futures + your basis. <b>Net</b> subtracts storage and the
          interest you give up by not having the money now, so it compares fairly with selling today. The <b>best</b> column is highlighted.
        </p>
        <p className="text-xs text-charcoal/50">
          &quot;Past years&quot; shows how prices actually moved over the same window starting this month in the last ~10 years. Prices refresh
          about every 30 minutes and may be delayed. Not financial advice.
        </p>
        <label className="inline-flex items-center gap-2 text-xs mt-1">
          Interest rate on operating money (%)
          <input className="input w-20!" type="number" step="0.1" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </label>
      </div>

      {anyMissing && (
        <div className="text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          Some futures prices didn&apos;t load from the price feed. You can type them in (in $/bu) where a cell shows a box.
        </div>
      )}

      {outlook.map((o) => {
        const s = settings[o.crop.key];
        const basis = Number(s.basis) || 0;
        const storage = Number(s.storage) || 0;
        const bushels = Number(s.bushels) || 0;
        const futs = o.points.map((p) => p.futures ?? (Number(s.overrides[p.horizon]) || null));
        const cashToday = futs[0] != null ? futs[0] + basis : null;
        const nets = o.points.map((p, i) => futs[i] == null || cashToday == null ? null
          : netPrice({ futures: futs[i]!, basis, days: p.days, storageCentsPerMonth: storage, interestPct: Number(interest) || 0, cashToday }));
        const best = nets.reduce<number | null>((b, n, i) => (n != null && (b == null || n > (nets[b] ?? -Infinity) + 0.0001) ? i : b), null);
        const bestGain = best != null && nets[0] != null ? nets[best]! - nets[0] : 0;

        return (
          <div key={o.crop.key} className="card p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-base font-semibold text-forest">{o.crop.name}</div>
                {o.crop.note && <div className="text-xs text-charcoal/50">{o.crop.note}</div>}
              </div>
              {best != null && nets[0] != null && (
                <div className={`text-sm font-medium ${best === 0 ? "text-charcoal/70" : "text-forest"}`}>
                  {best === 0
                    ? "Best now: selling today nets the most after storage and interest."
                    : `Best: ${o.points[best].label.toLowerCase()} — about ${fmt(bestGain)}/bu more than today${bushels ? ` (${fmt(bestGain * bushels).replace("$", "$")} on ${bushels.toLocaleString()} bu)` : ""}.`}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1">Your basis ($/bu)
                <input className="input w-20!" type="number" step="0.01" value={s.basis} onChange={(e) => set(o.crop.key, { basis: e.target.value })} />
              </label>
              <label className="flex items-center gap-1">Storage (¢/bu per month)
                <input className="input w-20!" type="number" step="0.5" value={s.storage} onChange={(e) => set(o.crop.key, { storage: e.target.value })} />
              </label>
              <label className="flex items-center gap-1">Bushels to sell
                <input className="input w-28!" type="number" step="1" value={s.bushels} onChange={(e) => set(o.crop.key, { bushels: e.target.value })} />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-charcoal/50 text-right">
                    <th className="text-left py-1 pr-2 font-normal" />
                    {o.points.map((p, i) => (
                      <th key={p.horizon} className={`py-1 px-2 font-semibold ${i === best ? "text-forest" : "text-charcoal/70"}`}>
                        {p.label}<div className="font-normal text-charcoal/45">{p.contract} futures</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-right">
                  <tr className="border-t border-charcoal/10">
                    <td className="text-left py-1.5 pr-2 text-charcoal/60">Futures</td>
                    {o.points.map((p, i) => (
                      <td key={p.horizon} className="py-1.5 px-2">
                        {p.futures != null ? fmt(p.futures) : (
                          <input className="input w-20! text-right" type="number" step="0.0025" placeholder="$/bu"
                            value={s.overrides[p.horizon] ?? ""} onChange={(e) => set(o.crop.key, { overrides: { ...s.overrides, [p.horizon]: e.target.value } })} />
                        )}
                        {i > 0 && futs[i] != null && futs[0] != null && (
                          <div className={`text-[11px] ${futs[i]! >= futs[0]! ? "text-forest" : "text-status-red"}`}>
                            {futs[i]! >= futs[0]! ? "+" : ""}{((futs[i]! - futs[0]!) * 100).toFixed(1)}¢
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-charcoal/10">
                    <td className="text-left py-1.5 pr-2 text-charcoal/60">Est. cash (with basis)</td>
                    {futs.map((f, i) => <td key={i} className="py-1.5 px-2">{f != null ? fmt(f + basis) : "—"}</td>)}
                  </tr>
                  <tr className="border-t border-charcoal/10">
                    <td className="text-left py-1.5 pr-2 font-medium">Net after storage &amp; interest</td>
                    {nets.map((n, i) => (
                      <td key={i} className={`py-1.5 px-2 font-semibold ${i === best ? "bg-sage/30 text-forest rounded" : ""}`}>
                        {n != null ? fmt(n) : "—"}
                        {bushels > 0 && n != null && <div className="text-[11px] font-normal text-charcoal/55">{(n * bushels).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</div>}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-charcoal/10 text-xs text-charcoal/55">
                    <td className="text-left py-1.5 pr-2">Past years (same window)</td>
                    {o.points.map((p) => (
                      <td key={p.horizon} className="py-1.5 px-2">
                        {p.days === 0 ? "" : p.seasonal
                          ? <><span className={p.seasonal.avgPct >= 0 ? "text-forest" : "text-status-red"}>{p.seasonal.avgPct >= 0 ? "+" : ""}{p.seasonal.avgPct.toFixed(1)}% avg</span><div>up {p.seasonal.upYears} of {p.seasonal.years} yrs</div></>
                          : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
