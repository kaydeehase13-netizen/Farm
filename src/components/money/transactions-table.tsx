"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Transaction, FarmCategory, Field } from "@/types/domain";
import { money } from "@/components/ui/stat-card";
import {
  bulkAssignFieldAction, bulkUpdateCategoryAction, recategorizeTransactionAction,
  setTransactionOmittedAction, deleteTransactionAction,
} from "@/lib/actions";

export function TransactionsTable({
  transactions, categories, fields,
}: { transactions: Transaction[]; categories: FarmCategory[]; fields: Field[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const allSelected = selected.size > 0 && selected.size === transactions.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(transactions.map((t) => t.id)));
  }

  function bulkCategory(farmCategoryId: string) {
    const fd = new FormData();
    selected.forEach((id) => fd.append("transactionIds", id));
    fd.set("farmCategoryId", farmCategoryId);
    startTransition(() => bulkUpdateCategoryAction(fd));
    setSelected(new Set());
  }
  function bulkField(fieldId: string) {
    const fd = new FormData();
    selected.forEach((id) => fd.append("transactionIds", id));
    fd.set("fieldId", fieldId);
    startTransition(() => bulkAssignFieldAction(fd));
    setSelected(new Set());
  }
  function bulkDelete() {
    if (!window.confirm(`Permanently delete ${selected.size} transaction${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    const ids = Array.from(selected);
    startTransition(async () => { for (const id of ids) await deleteTransactionAction(id); });
    setSelected(new Set());
  }

  function recategorize(id: string, farmCategoryId: string) {
    startTransition(() => recategorizeTransactionAction(id, farmCategoryId));
  }
  function toggleOmitted(t: Transaction) {
    const nowOmitted = !t.isPersonalExcluded;
    if (nowOmitted && !window.confirm("Mark this as personal / not a farm expense? It'll be excluded from income, expense, and tax totals but stay on record.")) return;
    startTransition(() => setTransactionOmittedAction(t.id, nowOmitted));
  }
  function deleteOne(t: Transaction) {
    if (!window.confirm(`Permanently delete this ${t.transactionType}${t.vendorName ? ` (${t.vendorName})` : ""}? This can't be undone.`)) return;
    startTransition(() => deleteTransactionAction(t.id));
  }

  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="card">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[--border-color] bg-sage-light/40 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <select
            className="border rounded px-2 py-1 bg-white"
            defaultValue=""
            onChange={(e) => e.target.value && bulkCategory(e.target.value)}
            disabled={isPending}
          >
            <option value="" disabled>Bulk change category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="border rounded px-2 py-1 bg-white"
            defaultValue=""
            onChange={(e) => e.target.value && bulkField(e.target.value)}
            disabled={isPending}
          >
            <option value="" disabled>Bulk assign field…</option>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={bulkDelete} disabled={isPending} className="text-status-red text-sm font-medium hover:underline ml-auto">
            Delete selected
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th>Date</th><th>Vendor / Description</th><th>Category</th><th>Type</th>
              <th className="text-right">Amount</th><th>Status</th><th>Receipt</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={t.isPersonalExcluded ? "opacity-50" : ""}>
                <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} /></td>
                <td className="whitespace-nowrap">{t.transactionDate}</td>
                <td>
                  <div className="font-medium">{t.vendorName ?? t.customerId ?? "—"}</div>
                  <div className="text-charcoal/50 text-xs">{t.description}</div>
                </td>
                <td>
                  <select
                    className="border rounded px-1.5 py-1 bg-white text-sm max-w-[160px]"
                    value={t.farmCategoryId ?? ""}
                    disabled={isPending}
                    onChange={(e) => e.target.value && recategorize(t.id, e.target.value)}
                  >
                    <option value="" disabled>Uncategorized</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="capitalize">{t.transactionType}</td>
                <td className={`text-right font-medium ${t.transactionType === "income" ? "text-status-green" : ""}`}>
                  {t.transactionType === "income" ? "+" : "-"}{money(t.amount)}
                </td>
                <td>
                  <span className={`status-pill ${
                    t.status === "needs_review" ? "status-amber" : t.status === "excluded_personal" ? "status-red" : "status-green"
                  }`}>{t.status.replace("_", " ")}</span>
                </td>
                <td>{t.receiptId ? <span className="status-pill status-green">✓</span> : <Link href="/money/receipts/new" className="text-status-amber text-xs underline">missing</Link>}</td>
                <td className="whitespace-nowrap text-xs">
                  <button onClick={() => toggleOmitted(t)} disabled={isPending} className="text-charcoal/60 hover:underline mr-2">
                    {t.isPersonalExcluded ? "Un-omit" : "Omit"}
                  </button>
                  <button onClick={() => deleteOne(t)} disabled={isPending} className="text-status-red hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={9} className="text-center text-charcoal/50 py-10">No transactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
