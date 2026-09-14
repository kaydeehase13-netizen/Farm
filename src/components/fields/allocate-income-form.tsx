"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { allocateGrainSaleAction, allocateCropInsuranceAction, findUnallocatedGrainSaleAction } from "@/lib/actions";

type Result = Awaited<ReturnType<typeof allocateGrainSaleAction>>;
type IncomeType = "grain_sale" | "crop_insurance";

/**
 * The income-side twin of AllocateCostForm — same shape (one total, split
 * across fields, exclude-a-field checkboxes, Reallocate to refresh) but
 * weighted by each field's harvested bushels instead of its product usage,
 * and creating income transactions instead of expense ones. See
 * allocateGrainSaleAction for the actual split math and the reconciliation
 * (replace-not-stack) logic — this component mirrors AllocateCostForm's UI
 * pattern closely on purpose, so the two features behave the same way.
 */
export function AllocateIncomeForm({
  years, defaultYear, cropNames, farmCategories,
}: {
  years: number[];
  defaultYear: number;
  cropNames: string[];
  farmCategories: { id: string; name: string }[];
}) {
  const [year, setYear] = useState(defaultYear);
  const [incomeType, setIncomeType] = useState<IncomeType>("grain_sale");
  const [cropName, setCropName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [farmCategoryId, setFarmCategoryId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [transactionDate, setTransactionDate] = useState(`${defaultYear}-12-31`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [found, setFound] = useState<Awaited<ReturnType<typeof findUnallocatedGrainSaleAction>> | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [amountVerified, setAmountVerified] = useState(true);
  const [excludedFieldIds, setExcludedFieldIds] = useState<Set<string>>(new Set());
  const [isReallocating, setIsReallocating] = useState(false);
  const [resultIncomeType, setResultIncomeType] = useState<IncomeType>("grain_sale");

  const yearOptions = years.includes(year) ? years : [...years, year].sort((a, b) => b - a);

  function lookup(nextCropName: string, nextYear: number) {
    const name = nextCropName.trim();
    if (!name || incomeType !== "grain_sale") { setFound(null); return; }
    startLookup(async () => {
      const match = await findUnallocatedGrainSaleAction({ year: nextYear, cropName: name });
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
      const action = incomeType === "grain_sale" ? allocateGrainSaleAction : allocateCropInsuranceAction;
      const res = await action({
        year, cropName, totalAmount: Number(totalAmount), farmCategoryId,
        vendorName: vendorName || undefined, transactionDate: transactionDate || undefined,
      });
      setResult(res);
      setResultIncomeType(incomeType);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong allocating this.");
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

  async function reallocate() {
    if (!result?.allocated) return;
    setIsReallocating(true);
    setError(null);
    try {
      const action = resultIncomeType === "grain_sale" ? allocateGrainSaleAction : allocateCropInsuranceAction;
      const res = await action({
        year: result.year, cropName: result.cropName, totalAmount: result.totalAmount,
        farmCategoryId: result.farmCategoryId, vendorName: result.vendorName, transactionDate: result.transactionDate,
        excludeFieldIds: Array.from(excludedFieldIds),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reallocating this.");
    } finally {
      setIsReallocating(false);
    }
  }

  if (result?.allocated) {
    const includedUsage = result.allocations.filter((a) => !a.excluded);
    const totalUsage = includedUsage.reduce((s, a) => s + a.usage, 0);
    const isInsurance = resultIncomeType === "crop_insurance";
    const usageWord = isInsurance ? "planted" : "harvested";
    const usagePctWord = isInsurance ? "acres" : "bushels";
    return (
      <div className="card p-6 space-y-4">
        <div className="text-3xl">✅</div>
        <div className="font-medium text-forest">
          Allocated {money(result.totalAmount)} of {result.cropName} {isInsurance ? "crop insurance payment" : "sales"} across {includedUsage.length} field{includedUsage.length === 1 ? "" : "s"} for {result.year}
        </div>
        {result.replacedCount > 0 && (
          <p className="text-xs text-charcoal/50">
            Replaced {result.replacedCount} existing {isInsurance ? "crop insurance " : ""}income entr{result.replacedCount === 1 ? "y" : "ies"} already on file for {result.cropName} with this per-field split, so it isn&apos;t counted twice.
          </p>
        )}
        <p className="text-xs text-charcoal/45">
          {isInsurance
            ? <>Uncheck a field if it wasn&apos;t part of this payment — it drops to $0 and the {money(result.totalAmount)} gets reallocated across whatever&apos;s still checked, in proportion to acres planted.</>
            : <>Uncheck a field if its grain wasn&apos;t part of this sale (stored separately, sold to someone else, etc.) — it drops to $0 and the {money(result.totalAmount)} you were paid gets reallocated across whatever&apos;s still checked, in proportion to bushels harvested.</>}
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
                      {a.usage.toLocaleString(undefined, { maximumFractionDigits: 1 })} {a.unit ?? "bu"} {usageWord}
                      {checked && totalUsage > 0 && ` · ${Math.round((a.usage / totalUsage) * 100)}% of ${usagePctWord}`}
                      {!checked && " · excluded — not part of this"}
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
            onClick={() => { setResult(null); setCropName(""); setTotalAmount(""); setExcludedFieldIds(new Set()); }}
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
        <div className="text-sm font-medium text-charcoal/70 mb-1">Income Type</div>
        <select
          className="input"
          value={incomeType}
          onChange={(e) => {
            const t = e.target.value as IncomeType;
            setIncomeType(t);
            setFound(null);
            setAmountVerified(true);
            if (t === "grain_sale") lookup(cropName, year);
          }}
        >
          <option value="grain_sale">Grain Sale (split by bushels harvested)</option>
          <option value="crop_insurance">Crop Insurance Payment (split by acres planted)</option>
        </select>
      </label>

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Tax Year</div>
        <select className="input" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); lookup(cropName, y); }}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Crop</div>
        <input
          list="crop-names" className="input" value={cropName}
          onChange={(e) => setCropName(e.target.value)}
          onBlur={(e) => lookup(e.target.value, year)}
          placeholder="e.g. Corn, Soybeans, Wheat"
          required
        />
        <datalist id="crop-names">
          {cropNames.map((p) => <option key={p} value={p} />)}
        </datalist>
        <p className="text-xs text-charcoal/45 mt-1">
          Matched against the crop name on each field&apos;s planting activity — doesn&apos;t need to be exact (&quot;Corn&quot; matches &quot;Corn (mixed varieties)&quot;).
        </p>
      </label>

      {isLookingUp && <p className="text-xs text-charcoal/45">Checking for an existing entry…</p>}
      {!isLookingUp && found && found.alreadyAllocated && (
        <p className="text-xs text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          ⚠️ &quot;{cropName}&quot; in {year} is already allocated across {found.count} field{found.count === 1 ? "" : "s"}, adding up to {money(found.totalAmount)} — pre-filled below, but{" "}
          <strong>check that number against your settlement sheet before allocating.</strong> It&apos;s a sum of whatever&apos;s already on file for this crop, so if an earlier allocation was ever wrong, this pulls the wrong total forward too.
          You don&apos;t need to remove anything first — just fix the amount below if it&apos;s off, then allocate; it&apos;ll replace the existing split either way.
        </p>
      )}
      {!isLookingUp && found && !found.alreadyAllocated && (
        <p className="text-xs text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          ⚠️ Found {found.count} existing income entr{found.count === 1 ? "y" : "ies"} already entered for &quot;{cropName}&quot; in {year}, totaling {money(found.totalAmount)} — pre-filled below, but{" "}
          <strong>double-check it against your settlement sheet.</strong> Allocating will replace {found.count === 1 ? "it" : "them"} with the per-field split instead of adding a new income entry on top.
        </p>
      )}

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">
          {incomeType === "grain_sale" ? "Total Amount Sold For" : "Total Insurance Payment"}
          {!amountVerified && <span className="text-status-amber font-normal"> — auto-filled, please verify</span>}
        </div>
        <input
          type="number" step="0.01" min="0"
          className={`input ${!amountVerified ? "border-status-amber bg-status-amber/5" : ""}`}
          value={totalAmount}
          onChange={(e) => { setTotalAmount(e.target.value); setAmountVerified(true); }}
          required placeholder="55000.00"
        />
        {!amountVerified && (
          <p className="text-xs text-status-amber mt-1">This came from adding up existing records, not from you — confirm it matches your settlement sheet before continuing.</p>
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
        <div className="text-sm font-medium text-charcoal/70 mb-1">{incomeType === "grain_sale" ? "Buyer / Elevator (optional)" : "Insurance Company (optional)"}</div>
        <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={incomeType === "grain_sale" ? "e.g. Hutchinson Grain Elevator" : "e.g. Rain and Hail Insurance"} />
      </label>

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">{incomeType === "grain_sale" ? "Sale Date" : "Payment Date"}</div>
        <input type="date" className="input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        <p className="text-xs text-charcoal/45 mt-1">Defaults to year-end for the tax year selected above — change it if you&apos;d rather date it to the settlement sheet.</p>
      </label>

      <button disabled={saving} className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-50">
        {saving ? "Allocating…" : incomeType === "grain_sale" ? "Allocate Sale Across Fields" : "Allocate Payment Across Fields"}
      </button>
      <p className="text-xs text-charcoal/45">
        {incomeType === "grain_sale"
          ? <>This creates one income entry per field, split proportionally to how many bushels each field harvested (yield × acres, from its logged/imported activity) — nothing is guessed beyond what&apos;s already in your records.</>
          : <>This creates one income entry per field, split proportionally to how many acres each field planted of this crop (from its logged/imported planting activity) — acres rather than yield, since an indemnity payment doesn&apos;t track actual bushels the way a sale does.</>}
      </p>
    </form>
  );
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
