"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewMixAction, saveMixAction, type MixInput } from "@/lib/actions";

type Preview = Awaited<ReturnType<typeof previewMixAction>>;
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const gal = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * A mix put out by hand (not on AgFiniti): 10-34-0 with IVC Zinc 10% at
 * 1 gal per 10. Enter the gallons of 10-34-0 that went out and the fields;
 * each field gets its share by acres, Inventory counts what was used, and
 * cost = gallons used x average price paid (zinc left over stays on hand).
 */
export function MixForm({ years, defaultYear, fields }: {
  years: number[]; defaultYear: number;
  fields: { id: string; name: string; acres?: number; grower?: string }[];
}) {
  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [date, setDate] = useState(`${defaultYear}-04-15`);
  const [mixName, setMixName] = useState("10-34-0 Mix");
  const [main, setMain] = useState("10-34-0");
  const [mainGallons, setMainGallons] = useState("");
  const [partner, setPartner] = useState("IVC Zinc 10%");
  const [partnerGal, setPartnerGal] = useState("1");
  const [perMain, setPerMain] = useState("10");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [galPerUnit, setGalPerUnit] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const growers = [...new Set(fields.map((f) => f.grower).filter(Boolean) as string[])].sort();
  const pickedAcres = fields.filter((f) => picked.has(f.id)).reduce((s, f) => s + (f.acres ?? 0), 0);
  const input = (): MixInput => ({
    year, date, mixName, main, partner,
    mainGallons: Number(mainGallons) || 0,
    partnerPerMain: (Number(partnerGal) || 0) / (Number(perMain) || 1),
    fieldIds: [...picked],
    mainGalPerUnit: Number(galPerUnit.main) || undefined,
    partnerGalPerUnit: Number(galPerUnit.partner) || undefined,
  });
  const touch = () => { setPreview(null); setMsg(null); };

  function check() {
    setErr(null); setMsg(null);
    startTransition(async () => {
      try { setPreview(await previewMixAction(input())); }
      catch (e) { setErr(e instanceof Error ? e.message : "Couldn't work it out."); }
    });
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await saveMixAction(input());
        setMsg([`Saved ${mixName}: ${r.passes} field pass${r.passes === 1 ? "" : "es"}${r.replaced ? ` (replaced ${r.replaced} from before)` : ""}.`, ...r.results]);
        setPreview(null);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    });
  }

  return (
    <div className="card p-5 space-y-3 text-sm">
      <div>
        <div className="font-semibold text-forest">Mix put out by hand</div>
        <p className="text-xs text-charcoal/55">
          For a mix that isn&apos;t on AgFiniti, like 10-34-0 with IVC Zinc 10%. Enter how much 10-34-0 went out and on which fields.
          Each field gets its share by acres, Inventory counts what was used, and the cost is gallons used × your average price paid,
          so zinc you didn&apos;t use stays on hand. Saving again for the same mix and year replaces it.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <label>Year
          <select className="input mt-0.5" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setDate(`${y}${date.slice(4)}`); touch(); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>Date put out<input type="date" className="input mt-0.5" value={date} onChange={(e) => { setDate(e.target.value); touch(); }} /></label>
        <label className="col-span-2">Mix name<input className="input mt-0.5" value={mixName} onChange={(e) => { setMixName(e.target.value); touch(); }} /></label>
        <label>Main product<input className="input mt-0.5" value={main} onChange={(e) => { setMain(e.target.value); touch(); }} /></label>
        <label>Gallons put out<input className="input mt-0.5" type="number" step="1" min="0" inputMode="decimal" value={mainGallons} onChange={(e) => { setMainGallons(e.target.value); touch(); }} placeholder="e.g. 2000" /></label>
        <label className="col-span-2">Mixed in
          <div className="flex items-center gap-1 mt-0.5">
            <input className="input" value={partner} onChange={(e) => { setPartner(e.target.value); touch(); }} />
            <input className="input w-14!" type="number" step="0.1" min="0" value={partnerGal} onChange={(e) => { setPartnerGal(e.target.value); touch(); }} aria-label="gallons mixed in" />
            <span className="whitespace-nowrap">gal per</span>
            <input className="input w-14!" type="number" step="1" min="1" value={perMain} onChange={(e) => { setPerMain(e.target.value); touch(); }} aria-label="gallons of main" />
            <span className="whitespace-nowrap">gal</span>
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-charcoal/70">Fields</div>
        <div className="flex flex-wrap gap-2">
          {growers.map((g) => (
            <button key={g} type="button" onClick={() => { setPicked(new Set(fields.filter((f) => f.grower === g).map((f) => f.id))); touch(); }} className="card px-3 py-1 text-xs font-medium hover:border-forest">
              All {g} fields
            </button>
          ))}
          {picked.size > 0 && <button type="button" onClick={() => { setPicked(new Set()); touch(); }} className="text-xs text-charcoal/60 hover:underline">Clear</button>}
        </div>
        <div className="max-h-56 overflow-y-auto border border-charcoal/10 rounded-lg p-2 space-y-0.5">
          {fields.map((f) => (
            <label key={f.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={picked.has(f.id)} onChange={() => { setPicked((p) => { const n = new Set(p); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; }); touch(); }} />
              <span className="flex-1">{f.name}</span>
              <span className="text-xs text-charcoal/45">{f.grower ?? ""}</span>
              <span className="text-xs text-charcoal/55 w-16 text-right">{f.acres ? `${f.acres} ac` : "no acres"}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-charcoal/55">{picked.size} field{picked.size === 1 ? "" : "s"} · {Math.round(pickedAcres * 100) / 100} ac</div>
      </div>

      {!preview && (
        <button type="button" onClick={check} disabled={isPending} className="card px-4 py-2 text-sm font-medium hover:border-forest disabled:opacity-50">
          {isPending ? "Working it out…" : "Check it"}
        </button>
      )}
      {preview && (
        <div className="space-y-2 border-t border-charcoal/10 pt-2">
          {([["main", preview.main], ["partner", preview.partner]] as const).map(([k, p]) => (
            <div key={k}>
              <b>{p.name}:</b> {gal(p.gallons)} gal
              {p.cost != null
                ? <> × {money(p.perGal!)}/gal ({p.from}) = <b>{money(p.cost)}</b></>
                : p.needsUnit
                  ? (
                    <span className="text-status-amber">
                      {" "}— bought by the {p.needsUnit} in Prices Paid. Gallons in one {p.needsUnit}:{" "}
                      <input className="input w-16! inline-block py-0.5! text-xs" type="number" step="0.5" min="0" value={galPerUnit[k] ?? ""}
                        onChange={(e) => setGalPerUnit((g) => ({ ...g, [k]: e.target.value }))} aria-label={`gallons per ${p.needsUnit}`} />
                      {" "}<button type="button" onClick={check} className="text-forest underline">Update</button>
                    </span>
                  )
                  : <span className="text-status-amber"> — no price in Prices Paid, so no cost will be split (the gallons still count in Inventory)</span>}
            </div>
          ))}
          <details className="text-xs">
            <summary className="cursor-pointer text-forest">Per field</summary>
            <table className="w-full mt-1">
              <tbody>
                {preview.fields.map((f) => (
                  <tr key={f.fieldId} className="border-t border-charcoal/10">
                    <td className="py-0.5">{f.name}</td><td className="text-right">{f.acres} ac</td>
                    <td className="text-right">{gal(f.mainGal)} gal {preview.main.name}</td>
                    <td className="text-right">{gal(f.partnerGal)} gal {preview.partner.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={isPending} className="bg-forest text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50">
              {isPending ? "Saving…" : `Save ${mixName}`}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
          </div>
        </div>
      )}
      {msg && <ul className="text-sm text-forest space-y-0.5">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      {err && <div className="text-sm text-status-red">{err}</div>}
    </div>
  );
}
