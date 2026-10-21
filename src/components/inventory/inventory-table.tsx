"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryRow } from "@/lib/inventory-balance";
import { mergeProductsAction } from "@/lib/actions";

function n(v: number) {
  return v.toLocaleString(undefined, { maximumFractionDigits: v !== 0 && Math.abs(v) < 10 ? 2 : 0 });
}

/** Small liquid amounts (a few gallons of Status, Sivanto...) read better in oz. */
function displayUnit(r: InventoryRow): { unit: string; f: number } {
  return r.unit === "gal" && Math.max(Math.abs(r.bought), Math.abs(r.used), Math.abs(r.onHand)) < 4 ? { unit: "oz", f: 128 } : { unit: r.unit, f: 1 };
}

/** First real word of a name ("GLUFOSINATE 280 SL" -> "glufosinate"), used to spot spellings of one product. */
function stem(name: string): string {
  const w = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length >= 4 && !/^\d+$/.test(x));
  return w[0] ?? "";
}

/**
 * Inventory table with a way to combine names that are really one product
 * ("Glufosinate", "GLUFOSINATE 280", "Glufosinate-ammonium"...): tick them
 * (or use a suggested group), pick the name to keep, Combine.
 */
export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const names = [...new Set(rows.map((r) => r.productName))];
  // Group by a name's first real word, and pull in any other name that has
  // that word anywhere ("280 SL Glupex (Glufosinate)" joins "Glufosinate").
  const wordsOf = (nm: string) => new Set(nm.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length >= 4 && !/^\d+$/.test(x)));
  const groups = new Map<string, string[]>();
  for (const nm of names) {
    const s = stem(nm);
    if (s && !groups.has(s)) groups.set(s, names.filter((other) => stem(other) === s || wordsOf(other).has(s)));
  }
  const suggestions = [...groups.entries()]
    .filter(([, g]) => g.length > 1)
    // Drop a group that's just a smaller copy of another.
    .filter(([k, g], _i, all) => !all.some(([k2, g2]) => k2 !== k && g2.length > g.length && g.every((x) => g2.includes(x))))
    .sort((a, b) => b[1].length - a[1].length);

  const shown = rows.filter((r) => !search || r.productName.toLowerCase().includes(search.toLowerCase()));
  const pickedNames = [...picked];

  function toggle(name: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(name)) next.delete(name); else next.add(name);
      if (!next.has(keep)) setKeep([...next][0] ?? "");
      return next;
    });
  }

  function pickGroup(g: string[]) {
    setPicked(new Set(g));
    // Default to the name with something bought (the invoice name), else the shortest.
    const withBuys = rows.filter((r) => g.includes(r.productName) && r.bought > 0).map((r) => r.productName);
    setKeep(withBuys[0] ?? [...g].sort((a, b) => a.length - b.length)[0]);
    setMsg(null); setErr(null);
  }

  function combine() {
    if (!keep || picked.size < 2) return;
    if (!window.confirm(`Combine ${picked.size} names into "${keep}"? Field activity, costs, allocations and purchases all move to "${keep}".`)) return;
    setMsg(null); setErr(null);
    startTransition(async () => {
      try {
        const all = rows.filter((r) => picked.has(r.productName)).flatMap((r) => r.names.length ? r.names : [r.productName]);
        const res = await mergeProductsAction({ names: [...new Set([...all, ...pickedNames])], keep });
        setMsg(res.message);
        setPicked(new Set()); setKeep("");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't combine them.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <div className="card p-4 text-sm space-y-2">
          <div className="font-semibold text-forest">Look like the same product?</div>
          <p className="text-xs text-charcoal/55">These names start the same way. Tap a group to select it, check the name to keep, then Combine.</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(([s, g]) => (
              <button key={s} type="button" onClick={() => pickGroup(g)} className="card px-3 py-1.5 text-xs hover:border-forest text-left">
                <b className="capitalize">{s}</b> · {g.length} names
              </button>
            ))}
          </div>
        </div>
      )}

      {picked.size > 0 && (
        <div className="card p-4 text-sm space-y-2 border-forest! sticky top-2 z-10">
          <div className="font-semibold">Combine {picked.size} name{picked.size === 1 ? "" : "s"}: keep which name?</div>
          <div className="flex flex-col gap-1">
            {pickedNames.map((nm) => (
              <label key={nm} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="keep" checked={keep === nm} onChange={() => setKeep(nm)} /> {nm}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={combine} disabled={isPending || picked.size < 2} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {isPending ? "Combining…" : `Combine into "${keep}"`}
            </button>
            <button type="button" onClick={() => { setPicked(new Set()); setKeep(""); }} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
            {picked.size < 2 && <span className="text-xs text-charcoal/50">Tick at least two.</span>}
          </div>
        </div>
      )}
      {msg && <div className="text-sm text-forest">{msg}</div>}
      {err && <div className="text-sm text-status-red">{err}</div>}

      <div className="card overflow-x-auto">
        <div className="p-3 pb-0">
          <input className="input w-56! text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8" /><th>Product</th><th>Category</th><th className="text-right">Bought</th><th className="text-right">Used</th>
              <th className="text-right">On Hand</th><th className="text-right">Avg Cost</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => { const du = displayUnit(r); return (
              <tr key={r.key} className={picked.has(r.productName) ? "bg-sage/15" : ""}>
                <td><input type="checkbox" checked={picked.has(r.productName)} onChange={() => toggle(r.productName)} aria-label={`Select ${r.productName}`} /></td>
                <td className="font-medium">
                  {r.productName}
                  {r.firstYear && <div className="text-[11px] text-charcoal/45 font-normal">{r.firstYear === r.lastYear ? r.firstYear : `${r.firstYear}–${r.lastYear}`}</div>}
                </td>
                <td>{r.category}</td>
                <td className="text-right whitespace-nowrap">
                  {r.bought ? `${n(r.bought * du.f)} ${du.unit}` : "—"}
                  {r.boughtFrom === "recorded" && <div className="text-[11px] text-charcoal/45">from receipts</div>}
                </td>
                <td className="text-right whitespace-nowrap">{r.used ? `${n(r.used * du.f)} ${du.unit}` : "—"}</td>
                <td className={`text-right whitespace-nowrap font-medium ${r.onHand < -0.005 ? "text-status-amber" : ""}`}>
                  {n(r.onHand * du.f)} {du.unit}
                  {r.adjusted !== 0 && <div className="text-[11px] text-charcoal/45 font-normal">incl. {r.adjusted > 0 ? "+" : ""}{n(r.adjusted * du.f)} adjusted</div>}
                </td>
                <td className="text-right whitespace-nowrap">{r.averageCost ? `$${(r.averageCost / du.f).toFixed(r.averageCost / du.f < 10 ? 4 : 2)}/${du.unit}` : "—"}</td>
                <td>
                  {r.onHand < -0.005
                    ? <span className="status-pill status-amber">Used more than bought</span>
                    : r.bought === 0 ? <span className="status-pill status-amber">No purchase on file</span>
                    : <span className="status-pill status-green">OK</span>}
                </td>
              </tr>
            ); })}
            {shown.length === 0 && <tr><td colSpan={8} className="text-sm text-charcoal/50">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
