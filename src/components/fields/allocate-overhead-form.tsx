"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { allocateFieldOverheadAction } from "@/lib/actions";

type Result = Awaited<ReturnType<typeof allocateFieldOverheadAction>>;

const CATEGORY_OPTIONS: { value: "equipment_ownership" | "equipment_repairs"; label: string }[] = [
  { value: "equipment_ownership", label: "Equipment — Total Cost" },
  { value: "equipment_repairs", label: "Equipment — Repairs & Maintenance" },
];

/**
 * The equipment-overhead twin of AllocateIncomeForm: enter ONE total and
 * pick which fields it applies to, instead of typing a per-field amount one
 * field at a time. Equipment isn't usage-tracked per field the way bushels
 * are, so the split is proportional to each selected field's acres — the
 * best available stand-in for how much of that equipment cost a field
 * "used." This never touches real expenses or taxes (see
 * FieldOverheadPanel) — it only feeds each field's displayed margin.
 */
export function AllocateOverheadForm({
  years,
  defaultYear,
  fields,
}: {
  years: number[];
  defaultYear: number;
  fields: { id: string; name: string; acres: number }[];
}) {
  const [year, setYear] = useState(defaultYear);
  const [category, setCategory] = useState<"equipment_ownership" | "equipment_repairs">("equipment_ownership");
  const [totalAmount, setTotalAmount] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(fields.map((f) => f.id)));
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const yearOptions = years.includes(year) ? years : [...years, year].sort((a, b) => b - a);

  function toggle(fieldId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startSaving(async () => {
      try {
        const res = await allocateFieldOverheadAction({
          taxYear: year,
          category,
          totalAmount: Number(totalAmount),
          fieldIds: Array.from(selected),
          note: note || undefined,
        });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong allocating this.");
      }
    });
  }

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;

  return (
    <div className="space-y-4">
      {result?.allocated && (
        <div className="card p-6 space-y-3">
          <div className="text-3xl">✅</div>
          <div className="font-medium text-forest">
            Allocated {money(result.totalAmount)} of {CATEGORY_OPTIONS.find((c) => c.value === result.category)?.label} across {result.allocations.length} field{result.allocations.length === 1 ? "" : "s"} for {result.taxYear}
          </div>
          {result.replacedCount > 0 && (
            <p className="text-xs text-charcoal/50">
              Replaced {result.replacedCount} existing overhead entr{result.replacedCount === 1 ? "y" : "ies"} already on file for this category/year, so it isn&apos;t counted twice.
            </p>
          )}
          <div className="space-y-1.5">
            {result.allocations.map((a) => (
              <div key={a.fieldId} className="flex items-center justify-between text-sm border-b border-charcoal/10 last:border-0 pb-1.5 last:pb-0">
                <div>
                  <div className="font-medium">{a.fieldName}</div>
                  <div className="text-xs text-charcoal/50">{a.acres} ac</div>
                </div>
                <div className="font-medium">{money(a.amount)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Link prefetch={false} href="/fields" className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg text-center">Back to Fields</Link>
            <button onClick={() => setResult(null)} className="card px-5 py-2.5 text-sm font-medium hover:border-forest">
              Allocate Another
            </button>
          </div>
        </div>
      )}

      {!result?.allocated && (
        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && <p className="text-sm text-status-red">{error}</p>}

          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Tax Year</div>
            <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Category</div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Total Amount ($)</div>
            <input type="number" step="0.01" min="0" className="input" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required placeholder="12500.00" />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Note (optional)</div>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. combine + planter, shared across row-crop ground" />
          </label>

          <div>
            <div className="text-sm font-medium text-charcoal/70 mb-1">Applies To</div>
            <p className="text-xs text-charcoal/45 mb-2">
              Uncheck any field this doesn&apos;t apply to. {money(Number(totalAmount) || 0)} splits across whatever&apos;s checked, proportional to acres.
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto border border-[--border-color] rounded-lg p-2">
              {fields.map((f) => (
                <label key={f.id} className="flex items-center justify-between text-sm py-1 cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
                    {f.name}
                  </span>
                  <span className="text-charcoal/45">{f.acres} ac</span>
                </label>
              ))}
            </div>
          </div>

          <button disabled={saving} className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-50">
            {saving ? "Allocating…" : `Allocate ${categoryLabel} Across Selected Fields`}
          </button>
          <p className="text-xs text-charcoal/45">
            This is a manual, non-tax number — it never touches your real expenses, Schedule F, or any tax export. It only reduces the displayed margin on each field above. Re-running this for the same year/category replaces the prior split.
          </p>
        </form>
      )}
    </div>
  );
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
