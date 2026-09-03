"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editReceiptAction } from "@/lib/actions";

export function EditReceiptForm({
  receiptId, hasTransaction, vendorName, date, amount, salesTax, farmCategoryId, farmCategories,
}: {
  receiptId: string;
  hasTransaction: boolean;
  vendorName: string;
  date: string;
  amount: number;
  salesTax: number;
  farmCategoryId: string;
  farmCategories: { id: string; name: string }[];
}) {
  const [vendor, setVendor] = useState(vendorName);
  const [dateVal, setDateVal] = useState(date);
  const [amountVal, setAmountVal] = useState(String(amount || ""));
  const [taxVal, setTaxVal] = useState(String(salesTax || ""));
  const [categoryVal, setCategoryVal] = useState(farmCategoryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await editReceiptAction({
        receiptId,
        vendorName: vendor || undefined,
        date: dateVal,
        amount: Number(amountVal) || 0,
        salesTax: Number(taxVal) || 0,
        farmCategoryId: categoryVal || undefined,
      });
      router.push("/money/receipts");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong saving these changes.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {!hasTransaction && (
        <p className="text-xs text-status-amber bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          This receipt isn&apos;t linked to a transaction yet — these changes will update the receipt itself. Confirm it first if you want an expense created from it.
        </p>
      )}
      {error && <p className="text-sm text-status-red">{error}</p>}

      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Vendor</div>
        <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
      </label>
      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Date</div>
        <input type="date" className="input" value={dateVal} onChange={(e) => setDateVal(e.target.value)} required />
      </label>
      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Amount</div>
        <input type="number" step="0.01" className="input" value={amountVal} onChange={(e) => setAmountVal(e.target.value)} required />
      </label>
      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Sales Tax</div>
        <input type="number" step="0.01" className="input" value={taxVal} onChange={(e) => setTaxVal(e.target.value)} />
      </label>
      <label className="block">
        <div className="text-sm font-medium text-charcoal/70 mb-1">Category</div>
        <select className="input" value={categoryVal} onChange={(e) => setCategoryVal(e.target.value)}>
          <option value="">— Unchanged —</option>
          {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <button disabled={saving} className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-50">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
