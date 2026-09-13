"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { allocateProductCostAction, findUnallocatedProductCostAction } from "@/lib/actions";

type Result = Awaited<ReturnType<typeof allocateProductCostAction>>;

export function AllocateCostForm({
  years, defaultYear, productNames, farmCategories,
}: {
  years: number[];
  defaultYear: number;
  productNames: string[];
  farmCategories: { id: string; name: string }[];
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
        if (match.vendorName) setVendorName(match.vendorName);
        if (match.transactionDate) setTransactionDate(match.transactionDate);
        if (match.farmCategoryId) setFarmCategoryId(match.farmCategoryId);
      }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await allocateProductCostAction({
        year, productName, totalAmount: Number(totalAmount), farmCategoryId,
        vendorName: vendorName || undefined, transactionDate: transactionDate || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong allocating this cost.");
    } finally {
      setSaving(false);
    }
  }

  if (result?.allocated) {
    const totalUsage = result.allocations.reduce((s, a) => s + a.usage, 0);
    return (
      <div className="card p-6 space-y-4">
        <div className="text-3xl">✅</div>
        <div className="font-medium text-forest">
          Allocated {money(result.totalAmount)} of {result.productName} across {result.allocations.length} field{result.allocations.length === 1 ? "" : "s"} for {result.year}
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
        <div className="space-y-1.5">
          {result.allocations.map((a) => (
            <div key={a.fieldId} className="flex items-center justify-between text-sm border-b border-charcoal/10 last:border-0 pb-1.5 last:pb-0">
              <div>
                <div className="font-medium">{a.fieldName}</div>
                <div className="text-xs text-charcoal/50">{a.usage.toLocaleString()} {a.unit ?? ""} · {totalUsage > 0 ? Math.round((a.usage / totalUsage) * 100) : 0}% of usage</div>
              </div>
              <div className="font-medium">{money(a.amount)}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Link prefetch={false} href="/fields" className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg flex-1 text-center">Back to Fields</Link>
          <button
            onClick={() => { setResult(null); setProductName(""); setTotalAmount(""); }}
            className="card px-5 py-2.5 text-sm font-medium hover:border-forest flex-1"
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
      {!isLookingUp && found && (
        <p className="text-xs text-forest bg-forest/5 border border-forest/20 rounded-lg p-3">
          Found {found.count} existing expense{found.count === 1 ? "" : "s"} already entered for &quot;{productName}&quot; in {year}, totaling {money(found.totalAmount)} — pre-filled below.
          Allocating will replace {found.count === 1 ? "it" : "them"} with the per-field split instead of adding a new expense on top.
        </p>
      )}

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Total Amount Paid</div>
        <input type="number" step="0.01" min="0" className="input" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required placeholder="12500.00" />
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
