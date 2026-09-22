"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { allocateGeneralCostAction } from "@/lib/actions";

/** Seeds planted (seeding rate x acres) per year / field / seed product. */
export type SeedPlanting = { year: number; fieldId: string; seed: string; seeds: number };

type Result = Awaited<ReturnType<typeof allocateGeneralCostAction>>;

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * A general cost (e.g. "Corn seed" billed as one line while the planting
 * records break it down by hybrid) split over the fields you tick, by how
 * much of the ticked seed each of them planted.
 */
export function GeneralCostForm({
  years, defaultYear, farmCategories, fields, plantings,
}: {
  years: number[];
  defaultYear: number;
  farmCategories: { id: string; name: string }[];
  fields: { id: string; name: string }[];
  plantings: SeedPlanting[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [year, setYear] = useState(defaultYear);
  const [name, setName] = useState("Corn seed (general)");
  const [total, setTotal] = useState("");
  const [farmCategoryId, setFarmCategoryId] = useState(farmCategories.find((c) => c.name.trim().toLowerCase() === "seed")?.id ?? "");
  const [vendorName, setVendorName] = useState("");
  const [transactionDate, setTransactionDate] = useState(`${defaultYear}-12-31`);
  const [pickedFields, setPickedFields] = useState<Set<string>>(new Set());
  const [uncheckedSeeds, setUncheckedSeeds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const yearPlantings = useMemo(() => plantings.filter((p) => p.year === year), [plantings, year]);
  const fieldName = useMemo(() => new Map(fields.map((f) => [f.id, f.name])), [fields]);

  // Seeds planted on the ticked fields this year — the ones to count or leave out.
  const seedOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of yearPlantings) if (pickedFields.has(p.fieldId)) names.add(p.seed);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [yearPlantings, pickedFields]);
  const countedSeeds = seedOptions.filter((s) => !uncheckedSeeds.has(s));

  // Fields that planted anything this year first, then the rest.
  const orderedFields = useMemo(() => {
    const planted = new Set(yearPlantings.map((p) => p.fieldId));
    return [...fields].sort((a, b) => Number(planted.has(b.id)) - Number(planted.has(a.id)) || a.name.localeCompare(b.name));
  }, [fields, yearPlantings]);
  const plantedFieldIds = useMemo(() => new Set(yearPlantings.map((p) => p.fieldId)), [yearPlantings]);

  const preview = useMemo(() => {
    const counted = new Set(countedSeeds.map((s) => s.toLowerCase()));
    const byField = new Map<string, number>();
    for (const p of yearPlantings) {
      if (!pickedFields.has(p.fieldId) || !counted.has(p.seed.toLowerCase())) continue;
      byField.set(p.fieldId, (byField.get(p.fieldId) ?? 0) + p.seeds);
    }
    const sum = [...byField.values()].reduce((a, b) => a + b, 0);
    const amount = Number(total) || 0;
    return [...pickedFields].map((id) => {
      const seeds = byField.get(id) ?? 0;
      return { id, name: fieldName.get(id) ?? "Field", seeds, share: sum > 0 ? seeds / sum : 0, amount: sum > 0 ? (amount * seeds) / sum : 0 };
    }).sort((a, b) => b.seeds - a.seeds);
  }, [yearPlantings, pickedFields, countedSeeds, total, fieldName]);

  function toggleField(id: string) {
    setPickedFields((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSeed(seed: string) {
    setUncheckedSeeds((prev) => { const n = new Set(prev); if (n.has(seed)) n.delete(seed); else n.add(seed); return n; });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const amount = Number(total);
    if (!(amount > 0)) { setError("Enter the total amount paid."); return; }
    if (!farmCategoryId) { setError("Choose a category."); return; }
    if (pickedFields.size === 0) { setError("Tick at least one field."); return; }
    if (countedSeeds.length === 0) { setError("Tick at least one seed to count."); return; }
    startTransition(async () => {
      try {
        const out = await allocateGeneralCostAction({
          year, name, totalAmount: amount, farmCategoryId, vendorName, transactionDate,
          fieldIds: [...pickedFields], seedProducts: countedSeeds,
        });
        setResult(out);
        if (out.allocated) router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't allocate that.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div>
        <div className="text-sm font-semibold text-forest">General cost across selected fields</div>
        <p className="text-xs text-charcoal/55 mt-1">
          For a cost billed as one line (e.g. &quot;Corn seed&quot;) while your planting records break the seed down by hybrid. Tick the
          fields it covers and the seed that counts; it&apos;s split by how much of that seed each field planted. Running it again with the
          same name replaces the earlier split.
        </p>
      </div>
      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          <p className="text-xs text-charcoal/45 mt-1">Use a name that isn&apos;t one of your hybrids, so the two don&apos;t mix.</p>
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Tax Year</div>
          <select className="input" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setTransactionDate(`${y}-12-31`); setPickedFields(new Set()); setUncheckedSeeds(new Set()); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Total Amount Paid</div>
          <input type="number" step="0.01" min="0" className="input" value={total} onChange={(e) => setTotal(e.target.value)} required placeholder="12500.00" />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Category</div>
          <select className="input" value={farmCategoryId} onChange={(e) => setFarmCategoryId(e.target.value)} required>
            <option value="" disabled>Choose a category…</option>
            {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Vendor (optional)</div>
          <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Expense Date</div>
          <input type="date" className="input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        </label>
      </div>

      <div>
        <div className="text-sm font-medium text-charcoal/70 mb-1">Fields it covers</div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 max-h-64 overflow-y-auto border border-[--border-color] rounded-lg p-2">
          {orderedFields.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={pickedFields.has(f.id)} onChange={() => toggleField(f.id)} />
              <span>{f.name}</span>
              {!plantedFieldIds.has(f.id) && <span className="text-xs text-charcoal/40">no planting logged {year}</span>}
            </label>
          ))}
        </div>
      </div>

      {seedOptions.length > 0 && (
        <div>
          <div className="text-sm font-medium text-charcoal/70 mb-1">Seed to count</div>
          <p className="text-xs text-charcoal/45 mb-1">Everything planted on the ticked fields. Untick anything this cost doesn&apos;t cover (e.g. soybean varieties for a corn charge).</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {seedOptions.map((seed) => (
              <label key={seed} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!uncheckedSeeds.has(seed)} onChange={() => toggleSeed(seed)} />
                {seed}
              </label>
            ))}
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="text-sm">
          <div className="font-medium text-charcoal/70 mb-1">Preview</div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0.5 text-xs">
            {preview.map((p) => (
              <div key={p.id} className="contents">
                <span>{p.name}</span>
                <span className="text-right text-charcoal/55">{p.seeds > 0 ? `${Math.round(p.seeds).toLocaleString()} seeds · ${(p.share * 100).toFixed(1)}%` : "none of the ticked seed planted — gets $0"}</span>
                <span className="text-right">{p.seeds > 0 && Number(total) > 0 ? money(p.amount) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && !result.allocated && (
        <p className="text-sm text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">{result.message}</p>
      )}
      {result && result.allocated && (
        <div className="text-sm bg-sage/20 border border-sage/40 rounded-lg p-3 text-charcoal/70">
          <div className="font-medium mb-1">Allocated {money(result.totalAmount)} of {result.productName} across {result.allocations.filter((a) => !a.excluded).length} field(s).</div>
          {result.allocations.filter((a) => !a.excluded).map((a) => (
            <div key={a.fieldId} className="flex justify-between text-xs"><span>{a.fieldName}</span><span>{money(a.amount)}</span></div>
          ))}
          {result.missingFieldIds.length > 0 && (
            <div className="text-xs text-status-amber mt-1">
              Left out (none of the ticked seed planted): {result.missingFieldIds.map((id) => fieldName.get(id) ?? id).join(", ")}
            </div>
          )}
        </div>
      )}

      <button type="submit" disabled={isPending} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
        {isPending ? "Allocating…" : "Allocate across ticked fields"}
      </button>
    </form>
  );
}
