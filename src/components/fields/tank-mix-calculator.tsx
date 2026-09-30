"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product, TankMixRecipe } from "@/types/domain";
import { calculateMix, formatPlain, isRateUnit, RATE_UNITS, type MixProduct, type RateUnit } from "@/lib/tank-mix";
import { saveChemicalAction, saveTankMixAction, deleteTankMixAction } from "@/lib/actions";

type Row = { key: string; productId?: string; name: string; rate: string; unit: RateUnit };

let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;

/**
 * Tank Mix Calculator: pick fields (or type acres), tank size and carrier
 * GPA, add chemicals from the library, and get what goes in every load -
 * full loads plus a right-sized last load - with the EPA number and a
 * Restricted Use flag on each chemical. Mixes can be saved and reloaded.
 */
export function TankMixCalculator({ chemicals, mixes, fields, needsMigration }: {
  chemicals: Product[];
  mixes: TankMixRecipe[];
  fields: { id: string; name: string; acres?: number }[];
  needsMigration: boolean;
}) {
  const router = useRouter();
  const byName = useMemo(() => new Map(chemicals.map((c) => [c.name.trim().toLowerCase(), c])), [chemicals]);

  const [pickedFields, setPickedFields] = useState<Set<string>>(new Set());
  const [extraAcres, setExtraAcres] = useState("");
  const [tank, setTank] = useState("1000");
  const [gpa, setGpa] = useState("15");
  const [mode, setMode] = useState<"full" | "even">("full");
  const [rows, setRows] = useState<Row[]>([{ key: newKey(), name: "", rate: "", unit: "fl oz/ac" }]);
  const [mixId, setMixId] = useState<string>("");
  const [mixName, setMixName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fieldFilter, setFieldFilter] = useState("");

  const fieldAcres = fields.filter((f) => pickedFields.has(f.id)).reduce((s, f) => s + (f.acres ?? 0), 0);
  const acres = fieldAcres + (Number(extraAcres) || 0);

  const products: (MixProduct & { chem?: Product })[] = rows
    .filter((r) => r.name.trim() && Number(r.rate) > 0)
    .map((r) => {
      const chem = r.productId ? chemicals.find((c) => c.id === r.productId) : byName.get(r.name.trim().toLowerCase());
      return { name: r.name.trim(), rate: Number(r.rate), unit: r.unit, epaRegistrationNumber: chem?.epaRegistrationNumber, restrictedUse: chem?.restrictedUse, chem };
    });

  // Cheap enough to recompute on every render.
  const result = calculateMix({ acres, tankGallons: Number(tank), carrierGpa: Number(gpa), products, mode });
  const rups = products.filter((p) => p.restrictedUse);

  function setRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      // Picking a chemical from the library fills its usual rate.
      if (patch.name !== undefined) {
        const chem = byName.get(patch.name.trim().toLowerCase());
        next.productId = chem?.id;
        if (chem && !r.rate && chem.defaultRate) next.rate = String(chem.defaultRate);
        if (chem && isRateUnit(chem.defaultRateUnit)) next.unit = chem.defaultRateUnit;
      }
      return next;
    }));
  }

  function loadMix(id: string) {
    setMixId(id);
    const m = mixes.find((x) => x.id === id);
    if (!m) { setMixName(""); return; }
    setMixName(m.name);
    if (m.tankGallons) setTank(String(m.tankGallons));
    if (m.carrierGpa) setGpa(String(m.carrierGpa));
    setRows(m.items.length ? m.items.map((it) => ({
      key: newKey(), productId: it.productId, name: it.name, rate: String(it.rate), unit: isRateUnit(it.unit) ? it.unit : "fl oz/ac",
    })) : [{ key: newKey(), name: "", rate: "", unit: "fl oz/ac" }]);
  }

  function saveMix(asNew: boolean) {
    setErr(null); setMsg(null);
    startTransition(async () => {
      try {
        const saved = await saveTankMixAction({
          id: asNew ? undefined : mixId || undefined,
          name: mixName,
          tankGallons: Number(tank) || undefined,
          carrierGpa: Number(gpa) || undefined,
          items: products.map((p) => ({ productId: p.chem?.id, name: p.name, rate: p.rate, unit: p.unit })),
        });
        setMixId(saved.id);
        setMsg(`Saved mix "${saved.name}".`);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the mix."); }
    });
  }

  function deleteMix() {
    if (!mixId || !window.confirm(`Delete saved mix "${mixName}"?`)) return;
    startTransition(async () => {
      try { await deleteTankMixAction(mixId); setMixId(""); setMixName(""); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Couldn't delete the mix."); }
    });
  }

  const shownFields = fields.filter((f) => !fieldFilter || f.name.toLowerCase().includes(fieldFilter.toLowerCase()));

  return (
    <div className="space-y-6">
      {needsMigration && (
        <div className="text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          One database step is needed before chemicals&apos; restricted-use flags, default rates and saved mixes can be stored: in
          Supabase, open <b>SQL Editor</b> and run <code>supabase/migrations/0029_tank_mix.sql</code>. The calculator itself works now.
        </div>
      )}

      <div className="card p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="text-xs text-charcoal/60 mb-1">Saved mix</div>
            <select className="input w-56!" value={mixId} onChange={(e) => loadMix(e.target.value)}>
              <option value="">— New mix —</option>
              {mixes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-charcoal/60 mb-1">Mix name</div>
            <input className="input w-64!" value={mixName} onChange={(e) => setMixName(e.target.value)} placeholder="e.g. Paraquat / AMS / Hot Mes" />
          </label>
          <button type="button" disabled={isPending || !mixName.trim()} onClick={() => saveMix(false)} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {mixId ? "Save changes" : "Save mix"}
          </button>
          {mixId && <button type="button" disabled={isPending} onClick={() => saveMix(true)} className="border border-forest text-forest px-3 py-2 rounded-lg text-sm font-medium">Save as new</button>}
          {mixId && <button type="button" disabled={isPending} onClick={deleteMix} className="text-xs text-status-red hover:underline">Delete mix</button>}
        </div>
        {msg && <p className="text-xs text-forest">{msg}</p>}
        {err && <p className="text-xs text-status-red">{err}</p>}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-charcoal/70 mb-1">Fields to spray <span className="text-charcoal/45 font-normal">({fieldAcres.toFixed(2)} ac ticked)</span></div>
            <input className="input text-sm mb-1" placeholder="Search fields…" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)} />
            <div className="max-h-48 overflow-y-auto border border-[--border-color] rounded-lg p-2 space-y-0.5">
              {shownFields.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={pickedFields.has(f.id)} onChange={() => setPickedFields((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                  <span className="flex-1">{f.name}</span>
                  <span className="text-xs text-charcoal/45">{f.acres ? `${f.acres} ac` : "—"}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            <label className="block col-span-2">
              <div className="text-xs text-charcoal/60 mb-1">{pickedFields.size ? "Extra acres (optional)" : "Acres to spray"}</div>
              <input className="input" type="number" step="0.01" min="0" value={extraAcres} onChange={(e) => setExtraAcres(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-xs text-charcoal/60 mb-1">Tank size (gal)</div>
              <input className="input" type="number" step="1" min="0" value={tank} onChange={(e) => setTank(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-xs text-charcoal/60 mb-1">Carrier (GPA)</div>
              <input className="input" type="number" step="0.1" min="0" value={gpa} onChange={(e) => setGpa(e.target.value)} />
            </label>
            <div className="col-span-2 flex gap-4 text-xs">
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={mode === "full"} onChange={() => setMode("full")} /> Full loads + a smaller last load</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={mode === "even"} onChange={() => setMode("even")} /> Equal loads</label>
            </div>
            <div className="col-span-2 text-sm font-medium text-forest">Total: {acres.toFixed(2)} ac</div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-charcoal/70 mb-1">Chemicals</div>
          <datalist id="tank-mix-chemicals">{chemicals.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          <div className="space-y-2">
            {rows.map((r) => {
              const chem = r.productId ? chemicals.find((c) => c.id === r.productId) : byName.get(r.name.trim().toLowerCase());
              return (
                <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_6rem_9rem] sm:grid-cols-[minmax(0,2fr)_7rem_10rem_minmax(0,1.4fr)] items-center gap-2">
                  <input className="input" list="tank-mix-chemicals" placeholder="Chemical" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} />
                  <input className="input" type="number" step="0.001" min="0" placeholder="Rate" value={r.rate} onChange={(e) => setRow(r.key, { rate: e.target.value })} />
                  <select className="input" value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value as RateUnit })}>
                    {RATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="col-span-3 sm:col-span-1 flex flex-wrap items-center gap-2">
                  {chem?.restrictedUse && <span className="text-[11px] font-semibold text-white bg-status-red rounded px-1.5 py-0.5">RUP</span>}
                  {chem?.epaRegistrationNumber && <span className="text-xs text-charcoal/55">EPA {chem.epaRegistrationNumber}</span>}
                  {r.name.trim() && !chem && <span className="text-xs text-status-amber">not in your chemical list yet</span>}
                  <button type="button" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs)} className="text-xs text-charcoal/50 hover:text-status-red">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setRows((rs) => [...rs, { key: newKey(), name: "", rate: "", unit: "fl oz/ac" }])} className="mt-2 text-xs font-medium text-forest hover:underline">+ Add chemical</button>
        </div>
      </div>

      <LoadSheet result={result} products={products} rups={rups} acres={acres} tank={Number(tank)} gpa={Number(gpa)} mixName={mixName} />

      <ChemicalLibrary chemicals={chemicals} />
    </div>
  );
}

function LoadSheet({ result, products, rups, acres, tank, gpa, mixName }: {
  result: ReturnType<typeof calculateMix>;
  products: (MixProduct & { chem?: Product })[];
  rups: MixProduct[];
  acres: number; tank: number; gpa: number; mixName: string;
}) {
  if (result.errors.length) {
    return <div className="card p-5 text-sm text-charcoal/60">{result.errors.join(" ")}</div>;
  }
  const fullLoads = result.loads.filter((l) => !l.partial).length;
  const partial = result.loads.find((l) => l.partial);
  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-forest">Load sheet{mixName ? ` — ${mixName}` : ""}</div>
          <div className="text-xs text-charcoal/60">
            {acres.toFixed(2)} ac · {tank} gal tank · {gpa} GPA · {result.acresPerFullLoad} ac per full load ·{" "}
            {result.loads.length} load{result.loads.length === 1 ? "" : "s"}
            {partial ? ` (${fullLoads} full + 1 partial)` : ""}
          </div>
        </div>
        <button type="button" onClick={() => window.print()} className="text-xs font-medium text-forest hover:underline print:hidden">Print load sheet</button>
      </div>

      {rups.length > 0 && (
        <div className="text-sm bg-status-red/10 border border-status-red/30 rounded-lg p-3">
          <b>Restricted Use Pesticide{rups.length > 1 ? "s" : ""}:</b> {rups.map((p) => `${p.name}${p.epaRegistrationNumber ? ` (EPA ${p.epaRegistrationNumber})` : ""}`).join(", ")}.
          {" "}For retail sale to and use only by certified applicators or persons under their direct supervision — keep the RUP application record.
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-charcoal/55">Add chemicals with a rate to see what goes in each load.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {result.groups.map((g) => (
            <div key={g.from} className={`rounded-lg border p-3 ${g.load.partial ? "border-status-amber/50 bg-status-amber/5" : "border-[--border-color]"}`}>
              <div className="text-sm font-semibold">
                {g.from === g.to ? `Load ${g.from}` : `Loads ${g.from}–${g.to}`}{g.load.partial ? " (partial)" : ""}
                {g.to > g.from && <span className="font-normal text-charcoal/55"> · each</span>}
              </div>
              <div className="text-xs text-charcoal/60 mb-2">{g.load.acres} ac · {g.load.gallons} gal total in tank</div>
              <table className="w-full text-sm">
                <tbody>
                  {g.load.products.map((p, i) => (
                    <tr key={i} className="border-t border-charcoal/10">
                      <td className="py-1 pr-2">{p.name}</td>
                      <td className="py-1 text-right font-medium whitespace-nowrap">{p.display}</td>
                      <td className="py-1 pl-2 text-right text-xs text-charcoal/50 whitespace-nowrap">{formatPlain(p.kind, p.baseAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-charcoal/10">
                    <td className="py-1 pr-2 text-charcoal/70">Water (approx.)</td>
                    <td className="py-1 text-right font-medium" colSpan={2}>{g.load.waterGallons} gal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {products.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-charcoal/80 mb-1">Total for the job</div>
          <table className="w-full text-sm">
            <tbody>
              {result.totals.map((p, i) => {
                const src = products[i];
                return (
                  <tr key={i} className="border-t border-charcoal/10">
                    <td className="py-1 pr-2">
                      {p.name}
                      {src?.restrictedUse && <span className="ml-2 text-[11px] font-semibold text-white bg-status-red rounded px-1.5 py-0.5">RUP</span>}
                      {src?.epaRegistrationNumber && <span className="ml-2 text-xs text-charcoal/50">EPA {src.epaRegistrationNumber}</span>}
                    </td>
                    <td className="py-1 text-right font-medium whitespace-nowrap">{p.display}</td>
                    <td className="py-1 pl-2 text-right text-xs text-charcoal/50 whitespace-nowrap">{formatPlain(p.kind, p.baseAmount)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-charcoal/10">
                <td className="py-1 pr-2 text-charcoal/70">Total spray volume</td>
                <td className="py-1 text-right font-medium" colSpan={2}>{result.totalGallons} gal</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-charcoal/45 mt-2">Always follow the product label for rates, mixing order and restrictions.</p>
        </div>
      )}
    </div>
  );
}

function ChemicalLibrary({ chemicals }: { chemicals: Product[] }) {
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const shown = chemicals.filter((c) => !filter || `${c.name} ${c.epaRegistrationNumber ?? ""} ${c.manufacturer ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="card p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold text-forest">My chemicals</div>
          <p className="text-xs text-charcoal/55">Everything already on your field activity is here. Add the EPA registration number, mark Restricted Use, and set the rate you normally run.</p>
        </div>
        <div className="flex items-center gap-2">
          <input className="input w-48! text-sm" placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button type="button" onClick={() => setEditing("new")} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">+ Add chemical</button>
        </div>
      </div>
      {editing === "new" && <ChemicalEditor onDone={() => setEditing(null)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal/50">
            <th className="py-1">Chemical</th><th className="py-1">EPA Reg. No.</th><th className="py-1">Restricted use</th><th className="py-1">Default rate</th><th />
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => editing === c.id ? (
            <tr key={c.id}><td colSpan={5}><ChemicalEditor chemical={c} onDone={() => setEditing(null)} /></td></tr>
          ) : (
            <tr key={c.id} className="border-t border-charcoal/10">
              <td className="py-1.5 pr-2">{c.name}{c.manufacturer && <span className="text-xs text-charcoal/45"> · {c.manufacturer}</span>}</td>
              <td className="py-1.5 pr-2">{c.epaRegistrationNumber ?? <span className="text-xs text-charcoal/40">—</span>}</td>
              <td className="py-1.5 pr-2">{c.restrictedUse ? <span className="text-[11px] font-semibold text-white bg-status-red rounded px-1.5 py-0.5">RUP</span> : <span className="text-xs text-charcoal/40">No</span>}</td>
              <td className="py-1.5 pr-2">{c.defaultRate ? `${c.defaultRate} ${c.defaultRateUnit ?? ""}` : <span className="text-xs text-charcoal/40">—</span>}</td>
              <td className="py-1.5 text-right"><button type="button" onClick={() => setEditing(c.id)} className="text-xs text-forest hover:underline">Edit</button></td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={5} className="py-3 text-xs text-charcoal/50">No chemicals{filter ? " match that search" : " yet"}.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ChemicalEditor({ chemical, onDone }: { chemical?: Product; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(chemical?.name ?? "");
  const [manufacturer, setManufacturer] = useState(chemical?.manufacturer ?? "");
  const [epa, setEpa] = useState(chemical?.epaRegistrationNumber ?? "");
  const [ai, setAi] = useState(chemical?.activeIngredient ?? "");
  const [rup, setRup] = useState(!!chemical?.restrictedUse);
  const [rate, setRate] = useState(chemical?.defaultRate != null ? String(chemical.defaultRate) : "");
  const [unit, setUnit] = useState<string>(chemical?.defaultRateUnit ?? "fl oz/ac");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setErr(null);
    startTransition(async () => {
      try {
        await saveChemicalAction({
          id: chemical?.id, name, manufacturer, epaRegistrationNumber: epa, activeIngredient: ai,
          restrictedUse: rup, defaultRate: rate === "" ? null : Number(rate), defaultRateUnit: rate === "" ? null : unit,
        });
        router.refresh();
        onDone();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    });
  }

  return (
    <div className="bg-cream-deep/40 rounded-lg p-3 my-2 space-y-2">
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-xs text-charcoal/60">Name
          <input className="input block" value={name} disabled={!!chemical} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs text-charcoal/60">EPA Reg. No.
          <input className="input block" value={epa} onChange={(e) => setEpa(e.target.value)} placeholder="e.g. 100-1431" />
        </label>
        <label className="text-xs text-charcoal/60">Manufacturer
          <input className="input block" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </label>
        <label className="text-xs text-charcoal/60 sm:col-span-2">Active ingredient
          <input className="input block" value={ai} onChange={(e) => setAi(e.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <label className="text-xs text-charcoal/60">Default rate
            <input className="input block w-24" type="number" step="0.001" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <select className="input w-32" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {RATE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={rup} onChange={(e) => setRup(e.target.checked)} /> Restricted Use Pesticide (RUP)
      </label>
      {chemical && <p className="text-xs text-charcoal/45">To rename a chemical everywhere, use Rename on a field&apos;s Product Usage panel.</p>}
      {err && <p className="text-xs text-status-red">{err}</p>}
      <div className="flex gap-3">
        <button type="button" disabled={isPending} onClick={save} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">{isPending ? "Saving…" : "Save"}</button>
        <button type="button" disabled={isPending} onClick={onDone} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
      </div>
    </div>
  );
}
