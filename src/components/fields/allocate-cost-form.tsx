"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { allocateProductCostAction, findUnallocatedProductCostAction } from "@/lib/actions";

type Result = Awaited<ReturnType<typeof allocateProductCostAction>>;

type ManualEntry = { fieldId: string; quantity: string; unit: string };

export function AllocateCostForm({
  years, defaultYear, productNames, farmCategories, fields,
}: {
  years: number[];
  defaultYear: number;
  productNames: string[];
  farmCategories: { id: string; name: string }[];
  fields: { id: string; name: string }[];
}) {
  const [year, setYear] = useState(defaultYear);
  const [productName, setProductName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [farmCategoryId, setFarmCategoryId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [transactionDate, setTransactionDate] = useState(`${defaultYear}-12-31`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [found, setFound] = useState<Awaited<ReturnType<typeof findUnallocatedProductCostAction>> | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  // Fields AgFiniti never covered — manually typed quantities that get
  // folded into the same usage pool as real logged activity, so a field
  // missing from AgFiniti (or a farm input like feed that was never
  // tracked as a field activity to begin with) can still share in the
  // proportional split.
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [showManual, setShowManual] = useState(false);

  function addManualEntry() {
    setManualEntries((prev) => [...prev, { fieldId: fields[0]?.id ?? "", quantity: "", unit: "" }]);
  }
  function updateManualEntry(index: number, patch: Partial<ManualEntry>) {
    setManualEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeManualEntry(index: number) {
    setManualEntries((prev) => prev.filter((_, i) => i !== index));
  }
  function manualUsagePayload() {
    return manualEntries
      .filter((e) => e.fieldId && Number(e.quantity) > 0)
      .map((e) => ({ fieldId: e.fieldId, quantity: Number(e.quantity), unit: e.unit || undefined }));
  }
  // True while Total Amount Paid still holds the auto-filled figure,
  // untouched by hand — cleared as soon as the field is edited. A prior bug
  // once wrote inflated per-field amounts to the database, and the
  // auto-fill sums whatever's actually on file, so it can silently repeat
  // a bad number back without anyone noticing unless it's flagged clearly.
  const [amountVerified, setAmountVerified] = useState(true);
  const [excludedFieldIds, setExcludedFieldIds] = useState<Set<string>>(new Set());
  const [isReallocating, setIsReallocating] = useState(false);

  const yearOptions = years.includes(year) ? years : [...years, year].sort((a, b) => b - a);

  // As soon as a product name (and year) are entered, check whether it's
  // already been logged as a lump expense via New Transaction or the
  // Expenses Excel import — if so, pre-fill everything from that instead of
  // asking for it to be retyped, and allocateProductCostAction will replace
  // that entry with the real per-field split rather than double-counting it.
  function lookup(nextProductName: string, nextYear: number) {
    const name = nextProductName.trim();
    if (!name) { setFound(null); return; }
    startLookup(async () => {
      const match = await findUnallocatedProductCostAction({ year: nextYear, productName: name });
      setFound(match);
      if (match) {
        setTotalAmount(String(match.totalAmount));
        setAmountVerified(false);
        if (match.vendorName) setVendorName(match.vendorName);
        if (match.transactionDate) setTransactionDate(match.transactionDate);
        if (match.farmCategoryId) setFarmCategoryId(match.farmCategoryId);
      } else {
        setAmountVerified(true);
      }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    setExcludedFieldIds(new Set());
    try {
      const res = await allocateProductCostAction({
        year, productName, totalAmount: Number(totalAmount), farmCategoryId,
        vendorName: vendorName || undefined, transactionDate: transactionDate || undefined,
        manualUsage: manualUsagePayload(),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong allocating this cost.");
    } finally {
      setSaving(false);
    }
  }

  function toggleFieldExcluded(fieldId: string) {
    setExcludedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
      return next;
    });
  }

  // Re-runs the allocation with whatever fields are now unchecked (e.g. "I
  // didn't pay for the seed on this field") excluded from the split — same
  // total amount, category, vendor, and date as before, just recomputed
  // over the remaining fields. allocateProductCostAction tears down the
  // prior per-field split first, so this is a true refresh, not a second
  // set of expenses stacked on top.
  async function reallocate() {
    if (!result?.allocated) return;
    setIsReallocating(true);
    setError(null);
    try {
      const res = await allocateProductCostAction({
        year: result.year, productName: result.productName, totalAmount: result.totalAmount,
        farmCategoryId: result.farmCategoryId, vendorName: result.vendorName, transactionDate: result.transactionDate,
        excludeFieldIds: Array.from(excludedFieldIds),
        manualUsage: manualUsagePayload(),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reallocating this cost.");
    } finally {
      setIsReallocating(false);
    }
  }

  if (result?.allocated) {
    const includedUsage = result.allocations.filter((a) => !a.excluded);
    const totalUsage = includedUsage.reduce((s, a) => s + a.usage, 0);
    return (
      <div className="card p-6 space-y-4">
        <div className="text-3xl">✅</div>
        <div className="font-medium text-forest">
          Allocated {money(result.totalAmount)} of {result.productName} across {includedUsage.length} field{includedUsage.length === 1 ? "" : "s"} for {result.year}
        </div>
        {result.replacedCount > 0 && (
          <p className="text-xs text-charcoal/50">
            Replaced {result.replacedCount} existing expense{result.replacedCount === 1 ? "" : "s"} already on file for {result.productName} with this per-field split, so it isn&apos;t counted twice.
          </p>
        )}
        {result.unmatchedUnits && (
          <p className="text-xs text-status-amber">
            Heads up — the matching activity entries didn&apos;t all use the same unit (e.g. some in gallons, some in ounces), so the usage numbers below are added together as-is. Double check the split makes sense.
          </p>
        )}
        <p className="text-xs text-charcoal/45">
          Uncheck a field if you didn&apos;t actually pay for its seed/chemical/fertilizer (free, carryover, gifted) — it drops to $0 and the {money(result.totalAmount)} you did pay gets reallocated across whatever&apos;s still checked, in the same usage proportions.
        </p>
        <div className="space-y-1.5">
          {result.allocations.map((a) => {
            const checked = !excludedFieldIds.has(a.fieldId);
            return (
              <label key={a.fieldId} className="flex items-center justify-between text-sm border-b border-charcoal/10 last:border-0 pb-1.5 last:pb-0 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={() => toggleFieldExcluded(a.fieldId)} />
                  <div>
                    <div className={`font-medium ${!checked ? "line-through text-charcoal/40" : ""}`}>{a.fieldName}</div>
                    <div className="text-xs text-charcoal/50">
                      {a.usage.toLocaleString()} {a.unit ?? ""}
                      {checked && totalUsage > 0 && ` · ${Math.round((a.usage / totalUsage) * 100)}% of usage`}
                      {!checked && " · excluded — didn't pay for this one"}
                    </div>
                  </div>
                </div>
                <div className={`font-medium ${!checked ? "text-charcoal/40" : ""}`}>{money(a.amount)}</div>
              </label>
            );
          })}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={reallocate}
            disabled={isReallocating}
            className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium flex-1 hover:bg-forest-light disabled:opacity-50"
          >
            {isReallocating ? "Reallocating…" : "Refresh / Reallocate"}
          </button>
          <Link prefetch={false} href="/fields" className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg text-center">Back to Fields</Link>
          <button
            onClick={() => { setResult(null); setProductName(""); setTotalAmount(""); setExcludedFieldIds(new Set()); setManualEntries([]); setShowManual(false); }}
            className="card px-5 py-2.5 text-sm font-medium hover:border-forest"
          >
            Allocate Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {result && !result.allocated && (
        <p className="text-sm text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">{result.message}</p>
      )}
      {error && <p className="text-sm text-status-red">{error}</p>}

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Tax Year</div>
        <select className="input" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); lookup(productName, y); }}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Product Name</div>
        <input
          list="product-names" className="input" value={productName}
          onChange={(e) => setProductName(e.target.value)}
          onBlur={(e) => lookup(e.target.value, year)}
          placeholder="Must match the product name on your logged/imported field activities"
          required
        />
        <datalist id="product-names">
          {productNames.map((p) => <option key={p} value={p} />)}
        </datalist>
        <p className="text-xs text-charcoal/45 mt-1">Match it to what shows up in a field&apos;s Activity History — e.g. the exact brand/product name from your equipment import.</p>
      </label>

      {isLookingUp && <p className="text-xs text-charcoal/45">Checking for an existing entry…</p>}
      {!isLookingUp && found && found.alreadyAllocated && (
        <p className="text-xs text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          ⚠️ &quot;{productName}&quot; in {year} is already allocated across {found.count} field{found.count === 1 ? "" : "s"}, adding up to {money(found.totalAmount)} — pre-filled below, but{" "}
          <strong>check that number against your receipt before allocating.</strong> It&apos;s a sum of whatever&apos;s already on file for this product, so if an earlier allocation was ever wrong, this pulls the wrong total forward too.
          You don&apos;t need to remove anything first — just fix the amount below if it&apos;s off, then allocate; it&apos;ll replace the existing split either way.
        </p>
      )}
      {!isLookingUp && found && !found.alreadyAllocated && (
        <p className="text-xs text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          ⚠️ Found {found.count} existing expense{found.count === 1 ? "" : "s"} already entered for &quot;{productName}&quot; in {year}, totaling {money(found.totalAmount)} — pre-filled below, but{" "}
          <strong>double-check it against your receipt.</strong> Allocating will replace {found.count === 1 ? "it" : "them"} with the per-field split instead of adding a new expense on top.
        </p>
      )}

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">
          Total Amount Paid{!amountVerified && <span className="text-status-amber font-normal"> — auto-filled, please verify</span>}
        </div>
        <input
          type="number" step="0.01" min="0"
          className={`input ${!amountVerified ? "border-status-amber bg-status-amber/5" : ""}`}
          value={totalAmount}
          onChange={(e) => { setTotalAmount(e.target.value); setAmountVerified(true); }}
          required placeholder="12500.00"
        />
        {!amountVerified && (
          <p className="text-xs text-status-amber mt-1">This came from adding up existing records, not from you — confirm it matches your receipt before continuing.</p>
        )}
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
        <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Co-op Elevator" />
      </label>

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Expense Date</div>
        <input type="date" className="input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        <p className="text-xs text-charcoal/45 mt-1">Defaults to year-end for the tax year selected above — change it if you'd rather date it to the invoice.</p>
      </label>

      <div className="pt-2 border-t border-[--border-color]">
        {!showManual && (
          <button type="button" onClick={() => { setShowManual(true); if (manualEntries.length === 0) addManualEntry(); }} className="text-xs font-medium text-forest hover:underline">
            + Add a field AgFiniti didn&apos;t cover
          </button>
        )}
        {showManual && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-charcoal/70">Fields Not Tracked by AgFiniti</div>
            <p className="text-xs text-charcoal/45">
              Type in the quantity used on each field yourself (seed, feed, anything else with no logged activity) — it&apos;s folded into the same pool as real logged usage above and shares in the split the same way. Use the same unit as your receipt (bags, lbs, tons, etc.).
            </p>
            {manualEntries.map((entry, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <select className="input text-sm" value={entry.fieldId} onChange={(e) => updateManualEntry(i, { fieldId: e.target.value })}>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <input type="number" step="0.01" min="0" className="input text-sm w-24" placeholder="Qty" value={entry.quantity} onChange={(e) => updateManualEntry(i, { quantity: e.target.value })} />
                <input className="input text-sm w-20" placeholder="unit" value={entry.unit} onChange={(e) => updateManualEntry(i, { unit: e.target.value })} />
                <button type="button" onClick={() => removeManualEntry(i)} className="text-xs text-status-red hover:underline">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addManualEntry} className="text-xs font-medium text-forest hover:underline">+ Add another field</button>
          </div>
        )}
      </div>

      <button disabled={saving} className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-50">
        {saving ? "Allocating…" : "Allocate Cost Across Fields"}
      </button>
      <p className="text-xs text-charcoal/45">
        This creates one expense per field, split proportionally to how much of this product each field&apos;s logged activity used — nothing is guessed beyond what&apos;s already in your records.
      </p>
    </form>
  );
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
