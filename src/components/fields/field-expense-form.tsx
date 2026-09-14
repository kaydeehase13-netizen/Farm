"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordFieldExpenseAction } from "@/lib/actions";

/**
 * Quick per-field expense entry — most importantly rent, which had no
 * direct way in before (only New Transaction + manually splitting it to a
 * field). This creates a REAL, tax-deductible expense transaction split to
 * this field — unlike the overhead panel above, it flows into Reports, the
 * dashboard, and your tax totals.
 */
export function FieldExpenseForm({
  fieldId,
  landownerName,
  farmCategories,
}: {
  fieldId: string;
  landownerName?: string;
  farmCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rentCategory = farmCategories.find((c) => c.name.toLowerCase().includes("rent"));
  const [amount, setAmount] = useState("");
  const [farmCategoryId, setFarmCategoryId] = useState(rentCategory?.id ?? "");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState(landownerName ?? "");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!farmCategoryId) { setError("Choose a category (e.g. Rent) for this expense."); return; }
    startTransition(async () => {
      try {
        await recordFieldExpenseAction({
          fieldId,
          amount: Number(amount),
          farmCategoryId,
          transactionDate,
          vendorName: vendorName || undefined,
          note: note || undefined,
        });
        setSaved(true);
        setAmount("");
        setNote("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-forest hover:underline">
        + Record Rent / Expense Payment for This Field
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border border-[--border-color] rounded-lg p-3 space-y-2 bg-cream-deep/30">
      <div className="text-xs font-semibold text-forest mb-1">Record Rent / Expense Payment</div>
      <p className="text-xs text-charcoal/50 mb-2">
        This is a real, tax-deductible expense (unlike the overhead entries above) — it&apos;ll show up in Reports, the dashboard, and your tax totals just like any transaction.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Amount ($)</div>
          <input type="number" step="0.01" min="0" className="input text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="block">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Date</div>
          <input type="date" className="input text-sm" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        </label>
        <label className="block col-span-2">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Category</div>
          <select className="input text-sm" value={farmCategoryId} onChange={(e) => setFarmCategoryId(e.target.value)} required>
            <option value="" disabled>Choose…</option>
            {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block col-span-2">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Paid To (optional)</div>
          <input className="input text-sm" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Landowner name" />
        </label>
        <label className="block col-span-2">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Note (optional)</div>
          <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2026 cash rent, half of 2" />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={isPending} className="text-xs font-medium bg-forest text-white px-3 py-1.5 rounded-lg hover:bg-forest-light disabled:opacity-40">
          {isPending ? "Saving…" : "Record Payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal/45 hover:underline">Close</button>
        {saved && <span className="text-xs text-forest">Saved.</span>}
      </div>
      {error && <p className="text-xs text-status-red">{error}</p>}
    </form>
  );
}
