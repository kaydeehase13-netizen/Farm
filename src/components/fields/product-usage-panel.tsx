"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FieldProductUsage } from "@/lib/supabase/repo";
import { updateFieldProductLineAction, updateProductTotalCostAction, renameProductAction, type ReallocationResult } from "@/lib/actions";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** One product line on this field's logged activity that can be edited in place. */
export type EditableProductLine =
  | {
      kind: "spray" | "fertilizer";
      activityId: string;
      activityDate: string;
      lineId?: string;
      lineIndex: number;
      productName: string;
      rate: number;
      rateUnit: string;
      quantityUsed: number;
      quantityUnit: string;
    }
  | {
      kind: "seed";
      activityId: string;
      activityDate: string;
      seedProductName: string;
      seedingRate?: number;
      acres?: number;
    };

const KIND_CATEGORY: Record<EditableProductLine["kind"], FieldProductUsage["category"]> = {
  spray: "Chemical", fertilizer: "Fertilizer", seed: "Seed",
};

function lineProductName(l: EditableProductLine) {
  return l.kind === "seed" ? l.seedProductName : l.productName;
}

/**
 * Groups a field's product usage by category (Seed / Fertilizer / Chemical)
 * and shows, for each product, the total quantity used this year and what
 * that cost (once an Allocate Product Cost entry exists for it).
 *
 * On a field page (when `edit` is passed) each product opens an editor:
 * change this field's usage (product, rate, quantity / seed, rate, acres)
 * or the product's total cost for the year. Either change re-splits that
 * product's cost across every field that used it.
 */
export function ProductUsagePanel({
  usage,
  taxYear,
  title = "Product Usage & Cost",
  edit,
}: {
  usage: FieldProductUsage[];
  taxYear: number;
  title?: string;
  edit?: {
    fieldId: string;
    lines: EditableProductLine[];
    farmCategories: { id: string; name: string }[];
  };
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [results, setResults] = useState<ReallocationResult[] | null>(null);
  if (usage.length === 0) return null;

  const categories: FieldProductUsage["category"][] = ["Seed", "Fertilizer", "Chemical"];

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">{title} ({taxYear})</div>
      <p className="text-xs text-charcoal/50 mb-3">
        Totals from logged/imported field activity. A product shows &quot;not yet allocated&quot; until you use{" "}
        <a href="/fields/allocate-cost" className="text-forest hover:underline">Allocate Product Cost</a> to attach what you actually paid for it.
        {edit && " Click a product to edit this field's usage or the product's total cost — the cost re-splits across fields automatically."}
      </p>
      {results && results.length > 0 && (
        <div className="mb-3 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`rounded p-2 text-xs ${r.reallocated ? "bg-sage/20 text-charcoal/70" : "bg-status-amber/10 text-charcoal/70"}`}>
              <div className="font-medium">{r.productName}: {r.message}</div>
              {r.fields && r.fields.length > 0 && (
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-4">
                  {r.fields.map((f, j) => (
                    <Fragment key={j}>
                      <span>{f.fieldName}</span>
                      <span className="text-right">{f.excluded ? "left out" : money(f.amount)}</span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setResults(null)} className="text-xs text-forest hover:underline">Dismiss</button>
        </div>
      )}
      <div className="space-y-4">
        {categories.map((cat) => {
          const rows = usage.filter((u) => u.category === cat);
          if (rows.length === 0) return null;
          const catTotal = rows.reduce((s, r) => s + (r.allocatedCost ?? 0), 0);
          return (
            <div key={cat}>
              <div className="flex items-baseline justify-between text-sm font-semibold text-charcoal/80 mb-1.5">
                <span>{cat}</span>
                {catTotal > 0 && <span className="text-forest">{money(catTotal)}</span>}
              </div>
              <div className="space-y-2">
                {rows.map((r) => {
                  const key = `${cat}|${r.productName.toLowerCase()}`;
                  const isOpen = openKey === key;
                  const summary = (
                    <>
                      <div>
                        <div className="font-medium">{r.productName}</div>
                        <div className="text-xs text-charcoal/50">
                          {r.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit ?? ""} used
                          {r.fieldCount != null && r.fieldCount > 0 && ` · ${r.fieldCount} field${r.fieldCount === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <div className="text-right">
                        {r.allocatedCost != null ? (
                          <div className="font-medium">{money(r.allocatedCost)}</div>
                        ) : (
                          <div className="text-xs text-status-amber">not yet allocated</div>
                        )}
                        {edit && <div className="text-xs text-forest">{isOpen ? "Close" : "Edit"}</div>}
                      </div>
                    </>
                  );
                  return (
                    <div key={r.productName} className="border-b border-charcoal/10 last:border-0 pb-1.5 last:pb-0">
                      {edit ? (
                        <button
                          type="button"
                          onClick={() => setOpenKey(isOpen ? null : key)}
                          className="w-full flex items-center justify-between text-sm text-left hover:bg-cream-deep/60 rounded px-1 -mx-1"
                        >
                          {summary}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between text-sm">{summary}</div>
                      )}
                      {edit && isOpen && (
                        <ProductEditor
                          key={`${key}|${r.farmAllocatedTotal ?? ""}`}
                          taxYear={taxYear}
                          fieldId={edit.fieldId}
                          usage={r}
                          lines={edit.lines.filter((l) => KIND_CATEGORY[l.kind] === cat && lineProductName(l).trim().toLowerCase() === r.productName.trim().toLowerCase())}
                          farmCategories={edit.farmCategories}
                          onResults={(out, renamedTo) => {
                            setResults(out);
                            if (renamedTo) setOpenKey(`${cat}|${renamedTo.trim().toLowerCase()}`);
                          }}
                          defaultCategoryId={edit.farmCategories.find((c) => c.name.trim().toLowerCase() === (cat === "Seed" ? "seed" : cat === "Fertilizer" ? "fertilizer" : "chemical"))?.id}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductEditor({
  taxYear, fieldId, usage, lines, farmCategories, defaultCategoryId, onResults,
}: {
  taxYear: number;
  fieldId: string;
  usage: FieldProductUsage;
  lines: EditableProductLine[];
  farmCategories: { id: string; name: string }[];
  defaultCategoryId?: string;
  onResults: (results: ReallocationResult[], renamedTo?: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allocated = usage.farmAllocatedTotal != null;
  const [total, setTotal] = useState(usage.farmAllocatedTotal != null ? String(usage.farmAllocatedTotal) : "");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [newName, setNewName] = useState(usage.productName);

  function rename(e: React.FormEvent) {
    e.preventDefault();
    const to = newName.trim();
    if (!to) { setError("Enter a new name."); return; }
    if (to === usage.productName.trim()) { setError("That's already its name."); return; }
    run(() => renameProductAction({ year: taxYear, oldName: usage.productName, newName: to }), to);
  }

  function run(fn: () => Promise<ReallocationResult | ReallocationResult[]>, renamedTo?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const out = await fn();
        onResults(Array.isArray(out) ? out : [out], renamedTo);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  function saveTotal(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(total.replace(/[$,]/g, ""));
    if (!(amount > 0)) { setError("Enter a total greater than $0."); return; }
    if (!allocated && !categoryId) { setError("Pick a category."); return; }
    run(() => updateProductTotalCostAction({
      year: taxYear, productName: usage.productName, totalAmount: amount,
      farmCategoryId: allocated ? undefined : categoryId,
    }));
  }

  return (
    <div className="mt-2 mb-2 rounded-lg bg-cream-deep/50 p-3 space-y-4 text-sm">
      <form onSubmit={saveTotal} className="space-y-2">
        <div className="font-medium text-charcoal/80">Total paid for {usage.productName} in {taxYear} (all fields)</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-40" inputMode="decimal" value={total} disabled={isPending}
            onChange={(e) => setTotal(e.target.value)} placeholder="$0.00"
          />
          {!allocated && (
            <select className="input w-44" value={categoryId} disabled={isPending} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Category…</option>
              {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button type="submit" disabled={isPending} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {isPending ? "Saving…" : allocated ? "Save & re-split" : "Allocate"}
          </button>
        </div>
        <p className="text-xs text-charcoal/50">
          {allocated
            ? "Changing this re-splits the new total across every field by usage. Category, vendor, date and any fields you'd left out stay the same."
            : "Not allocated yet — enter what you paid and it will be split across every field that used it."}
        </p>
      </form>

      <form onSubmit={rename} className="space-y-2">
        <div className="font-medium text-charcoal/80">Rename everywhere</div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-64" value={newName} disabled={isPending} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" disabled={isPending} className="border border-forest text-forest px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Rename
          </button>
        </div>
        <p className="text-xs text-charcoal/50">
          Renames {usage.productName} on every field and in every year, including its cost entries. If you type the name of a
          product you already have, the two are merged into one and its {taxYear} cost is re-split together.
        </p>
      </form>

      {lines.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium text-charcoal/80">Usage on this field only</div>
          {lines.map((l, i) => (
            <LineEditor
              key={`${l.activityId}-${l.kind}-${l.kind === "seed" ? "s" : l.lineId ?? l.lineIndex}-${i}`}
              line={l}
              disabled={isPending}
              onSave={(edit, oldName) => run(() => updateFieldProductLineAction({ fieldId, year: taxYear, oldProductName: oldName, edit }))}
            />
          ))}
          <p className="text-xs text-charcoal/50">
            Saving re-splits this product&apos;s cost across fields. If you change the product name, both the old and new product are re-split.
          </p>
        </div>
      )}

      {error && <div className="text-status-red">{error}</div>}
    </div>
  );
}

function LineEditor({
  line, disabled, onSave,
}: {
  line: EditableProductLine;
  disabled: boolean;
  onSave: (edit: Parameters<typeof updateFieldProductLineAction>[0]["edit"], oldProductName: string) => void;
}) {
  const [name, setName] = useState(lineProductName(line));
  const [rate, setRate] = useState(String(line.kind === "seed" ? line.seedingRate ?? "" : line.rate));
  const [qty, setQty] = useState(String(line.kind === "seed" ? line.acres ?? "" : line.quantityUsed));
  const oldName = lineProductName(line);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (line.kind === "seed") {
      onSave({
        kind: "seed", activityId: line.activityId, seedProductName: name,
        seedingRate: rate === "" ? null : Number(rate), acres: qty === "" ? null : Number(qty),
      }, oldName);
    } else {
      onSave({
        kind: line.kind, activityId: line.activityId, lineId: line.lineId, lineIndex: line.lineIndex,
        productName: name, rate: Number(rate) || 0, quantityUsed: Number(qty) || 0,
      }, oldName);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2 border-t border-charcoal/10 pt-2">
      <div className="text-xs text-charcoal/50 w-full">{line.activityDate} · {line.kind === "spray" ? "Spray" : line.kind === "fertilizer" ? "Fertilizer" : "Planting"}</div>
      <label className="text-xs text-charcoal/60">
        {line.kind === "seed" ? "Seed" : "Product"}
        <input className="input block w-48" value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="text-xs text-charcoal/60">
        {line.kind === "seed" ? "Seeding rate (/ac)" : `Rate${line.rateUnit ? ` (${line.rateUnit})` : ""}`}
        <input className="input block w-28" inputMode="decimal" value={rate} disabled={disabled} onChange={(e) => setRate(e.target.value)} />
      </label>
      <label className="text-xs text-charcoal/60">
        {line.kind === "seed" ? "Acres" : `Quantity used${line.quantityUnit ? ` (${line.quantityUnit})` : ""}`}
        <input className="input block w-28" inputMode="decimal" value={qty} disabled={disabled} onChange={(e) => setQty(e.target.value)} />
      </label>
      <button type="submit" disabled={disabled} className="border border-forest text-forest px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
        Save
      </button>
    </form>
  );
}
