"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Transaction, FarmCategory, Field } from "@/types/domain";
import { money } from "@/components/ui/stat-card";
import { bulkAssignFieldAction, bulkUpdateCategoryAction } from "@/lib/actions";

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
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th>Date</th><th>Vendor / Description</th><th>Category</th><th>Type</th>
              <th className="text-right">Amount</th><th>Status</th><th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} /></td>
                <td className="whitespace-nowrap">{t.transactionDate}</td>
                <td>
                  <div className="font-medium">{t.vendorName ?? t.customerId ?? "—"}</div>
                  <div className="text-charcoal/50 text-xs">{t.description}</div>
                </td>
                <td>{categoryName(t.farmCategoryId)}</td>
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
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={8} className="text-center text-charcoal/50 py-10">No transactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
