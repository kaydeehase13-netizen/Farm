"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGrowerSettingsAction, assignGrowersFromFileAction } from "@/lib/actions";
import { BILLABLE_WORK, defaultUnit, type BillingRate, type Grower, type RateUnit } from "@/lib/growers";

type FieldRow = { id: string; name: string; acres: number; grower?: string };

/**
 * Who each field is farmed for (AgFiniti's Grower), each grower's billing
 * settings, and the per-acre work rates. One Save writes it all.
 */
export function GrowerSettings({ fields, growers: initialGrowers, rates: initialRates }: {
  fields: FieldRow[]; growers: Grower[]; rates: BillingRate[];
}) {
  const router = useRouter();
  const startGrowers = (): Grower[] => {
    if (initialGrowers.length) return initialGrowers;
    const names = [...new Set(fields.map((f) => f.grower).filter(Boolean) as string[])];
    if (!names.some((n) => /mohler farms/i.test(n))) names.unshift("Mohler Farms");
    return names.map((n) => ({ name: n, ownFarm: /mohler farms/i.test(n), suppliesOwnInputs: false, markupPct: 0 }));
  };
  const [growers, setGrowers] = useState<Grower[]>(startGrowers);
  const [assign, setAssign] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.id, f.grower ?? ""])));
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(BILLABLE_WORK.map((w) => [w.type, String(initialRates.find((r) => r.activityType === w.type)?.ratePerAcre ?? "")])));
  const [units, setUnits] = useState<Record<string, RateUnit>>(() =>
    Object.fromEntries(BILLABLE_WORK.map((w) => [w.type, initialRates.find((r) => r.activityType === w.type)?.unit ?? defaultUnit(w.type)])));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const names = growers.map((g) => g.name.trim()).filter(Boolean);
  const setG = (i: number, patch: Partial<Grower>) => setGrowers((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const shown = fields.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()) || (assign[f.id] ?? "").toLowerCase().includes(search.toLowerCase()));
  const unassigned = fields.filter((f) => !assign[f.id]).length;

  function applyBulk(ids: string[]) {
    setAssign((a) => { const n = { ...a }; for (const id of ids) n[id] = bulkTo; return n; });
    setPicked(new Set());
  }

  function save() {
    setMsg(null); setErr(null);
    startTransition(async () => {
      try {
        await saveGrowerSettingsAction({
          growers: growers.filter((g) => g.name.trim()).map((g) => ({ ...g, markupPct: Number(g.markupPct) || 0 })),
          rates: BILLABLE_WORK.map((w) => ({ activityType: w.type, ratePerAcre: Number(rates[w.type]) || 0, unit: units[w.type] })),
          fieldGrowers: fields.filter((f) => (f.grower ?? "") !== (assign[f.id] ?? "")).map((f) => ({ fieldId: f.id, grower: assign[f.id] || null })),
        });
        setMsg("Saved.");
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    });
  }

  const [upMsg, setUpMsg] = useState<string | null>(null);
  function upload(formData: FormData) {
    setUpMsg(null); setErr(null);
    startTransition(async () => {
      const r = await assignGrowersFromFileAction(formData);
      if (r.error) { setErr(r.error); return; }
      setUpMsg(`Set the grower on ${r.assigned} field${r.assigned === 1 ? "" : "s"}.` +
        (r.unmatched.length ? ` Not found in your fields (set these by hand): ${r.unmatched.join("; ")}.` : ""));
      router.refresh();
      window.setTimeout(() => window.location.reload(), 400);
    });
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-2">
        <div className="text-sm font-semibold text-forest">Fill from a sheet</div>
        <p className="text-xs text-charcoal/55">Upload a sheet with Grower and Field columns (and Acres if you have it) to set every field&apos;s grower at once.</p>
        <form action={upload} className="flex flex-wrap items-center gap-2">
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="input w-72! text-sm" disabled={isPending} />
          <button type="submit" disabled={isPending} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Upload</button>
        </form>
        {upMsg && <p className="text-sm text-forest">{upMsg}</p>}
      </div>

      <div className="card p-5 space-y-3">
        <div className="text-sm font-semibold text-forest">Growers</div>
        <p className="text-xs text-charcoal/55">
          The names AgFiniti uses for who a field is farmed for. <b>Our farm</b> is your own (shown at cost, never billed).
          <b> Buys own product</b> leaves their fields out of your product cost splits. <b>Markup</b> is added to product you bill them for.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-charcoal/50 text-left">
              <th className="py-1 font-normal">Name</th><th className="py-1 font-normal">Our farm</th>
              <th className="py-1 font-normal">Buys own product</th><th className="py-1 font-normal">Markup %</th><th />
            </tr>
          </thead>
          <tbody>
            {growers.map((g, i) => (
              <tr key={i} className="border-t border-charcoal/10">
                <td className="py-1.5 pr-2"><input className="input" value={g.name} onChange={(e) => setG(i, { name: e.target.value })} placeholder="e.g. Gerald" /></td>
                <td className="py-1.5"><input type="checkbox" checked={g.ownFarm} onChange={(e) => setG(i, { ownFarm: e.target.checked })} /></td>
                <td className="py-1.5"><input type="checkbox" checked={g.suppliesOwnInputs} onChange={(e) => setG(i, { suppliesOwnInputs: e.target.checked })} disabled={g.ownFarm} /></td>
                <td className="py-1.5"><input className="input w-20!" type="number" step="0.5" min="0" value={g.markupPct || ""} onChange={(e) => setG(i, { markupPct: Number(e.target.value) })} disabled={g.ownFarm} placeholder="0" /></td>
                <td className="py-1.5 text-right"><button type="button" onClick={() => setGrowers((gs) => gs.filter((_, j) => j !== i))} className="text-xs text-status-red hover:underline">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => setGrowers((gs) => [...gs, { name: "", ownFarm: false, suppliesOwnInputs: false, markupPct: 0 }])} className="text-xs font-medium text-forest hover:underline">+ Add grower</button>
      </div>

      <div className="card p-5 space-y-3">
        <div className="text-sm font-semibold text-forest">Fields <span className="font-normal text-charcoal/50">({unassigned} with no grower)</span></div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input className="input w-48!" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-charcoal/60">Set</span>
          <select className="input w-44!" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)}>
            <option value="">— no grower —</option>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" disabled={picked.size === 0} onClick={() => applyBulk([...picked])} className="card px-3 py-1.5 text-xs font-medium hover:border-forest disabled:opacity-40">on ticked ({picked.size})</button>
          <button type="button" disabled={unassigned === 0} onClick={() => applyBulk(fields.filter((f) => !assign[f.id]).map((f) => f.id))} className="card px-3 py-1.5 text-xs font-medium hover:border-forest disabled:opacity-40">on all with no grower ({unassigned})</button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} className="border-t border-charcoal/10">
                  <td className="py-1 w-6"><input type="checkbox" checked={picked.has(f.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} /></td>
                  <td className="py-1">{f.name}</td>
                  <td className="py-1 text-xs text-charcoal/50 text-right pr-3">{f.acres ? `${f.acres} ac` : ""}</td>
                  <td className="py-1 w-48">
                    <select className={`input text-sm py-1! ${assign[f.id] ? "" : "text-status-amber"}`} value={assign[f.id] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [f.id]: e.target.value }))}>
                      <option value="">— no grower —</option>
                      {names.map((n) => <option key={n} value={n}>{n}</option>)}
                      {assign[f.id] && !names.includes(assign[f.id]) && <option value={assign[f.id]}>{assign[f.id]}</option>}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="text-sm font-semibold text-forest">Work rates</div>
        <p className="text-xs text-charcoal/55">
          What you charge growers you farm for. Per acre = acres of every pass × rate. Per hour = the hours you type for each grower on the
          Grower Billing report × rate (harvest starts per hour). Leave blank for no charge.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BILLABLE_WORK.map((w) => (
            <label key={w.type} className="text-xs">{w.label}
              <div className="flex gap-1 mt-0.5">
                <input className="input" type="number" step="0.25" min="0" value={rates[w.type] ?? ""} onChange={(e) => setRates((r) => ({ ...r, [w.type]: e.target.value }))} placeholder="0.00" aria-label={`${w.label} rate`} />
                <select className="input w-24! text-xs" value={units[w.type]} onChange={(e) => setUnits((u) => ({ ...u, [w.type]: e.target.value as RateUnit }))} aria-label={`${w.label} per`}>
                  <option value="acre">/ acre</option>
                  <option value="hour">/ hour</option>
                </select>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-20 md:bottom-4">
        <button type="button" onClick={save} disabled={isPending} className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium disabled:opacity-50 shadow">
          {isPending ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm text-forest">{msg}</span>}
        {err && <span className="text-sm text-status-red">{err}</span>}
      </div>
    </div>
  );
}
