"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFieldOverheadAllocationAction, deleteFieldOverheadAllocationAction } from "@/lib/actions";
import { money } from "@/components/ui/stat-card";
import type { FieldOverheadAllocation, FieldOverheadCategory } from "@/types/domain";

const CATEGORY_LABELS: Record<FieldOverheadCategory, string> = {
  insurance: "Insurance",
  equipment_ownership: "Equipment — Total Cost",
  equipment_repairs: "Equipment — Repairs & Maintenance",
};

/**
 * Manual, opt-in overhead entries (insurance, equipment ownership cost,
 * equipment repairs) for THIS field/year only — never applied to every
 * field automatically. These don't touch real expense totals or taxes; they
 * only reduce this field's displayed margin, since Kaydee tracks these
 * costs at the farm level and wants a fair per-field share reflected here.
 */
export function FieldOverheadPanel({
  fieldId,
  taxYear,
  allocations,
}: {
  fieldId: string;
  taxYear: number;
  allocations: FieldOverheadAllocation[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<FieldOverheadCategory>("insurance");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = allocations.reduce((s, a) => s + a.amount, 0);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createFieldOverheadAllocationAction({
          fieldId,
          taxYear,
          category,
          amount: Number(amount),
          note: note || undefined,
        });
        setAmount("");
        setNote("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteFieldOverheadAllocationAction(id, fieldId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove that.");
      }
    });
  }

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">Overhead Allocated to This Field ({taxYear})</div>
      <p className="text-xs text-charcoal/50 mb-3">
        Manual figures you enter yourself — insurance, equipment ownership cost, and equipment repairs. These aren&apos;t
        real expenses or deductions and never change your tax totals; they only reduce this field&apos;s margin above, so
        it reflects a fair share of overhead the farm carries. Nothing here applies to other fields automatically.
      </p>

      {allocations.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {allocations.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{CATEGORY_LABELS[a.category]}</span>
                {a.note && <span className="text-charcoal/50"> — {a.note}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span>{money(a.amount)}</span>
                <button type="button" onClick={() => remove(a.id)} disabled={isPending} className="text-xs text-status-red hover:underline disabled:opacity-40">
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm font-semibold pt-1.5 border-t border-[--border-color]">
            <span>Total overhead</span>
            <span>{money(total)}</span>
          </div>
        </div>
      )}
      {allocations.length === 0 && (
        <p className="text-sm text-charcoal/50 mb-3">Nothing added for this field in {taxYear} yet.</p>
      )}

      <form onSubmit={add} className="grid grid-cols-2 gap-2 pt-3 border-t border-[--border-color]">
        <label className="block col-span-2">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Category</div>
          <select className="input text-sm" value={category} onChange={(e) => setCategory(e.target.value as FieldOverheadCategory)}>
            <option value="insurance">Insurance</option>
            <option value="equipment_ownership">Equipment — Total Cost</option>
            <option value="equipment_repairs">Equipment — Repairs &amp; Maintenance</option>
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Amount ($)</div>
          <input type="number" step="0.01" min="0" className="input text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="block">
          <div className="text-[11px] text-charcoal/50 mb-0.5">Note (optional)</div>
          <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. shared w/ 3 fields" />
        </label>
        <button type="submit" disabled={isPending} className="col-span-2 text-xs font-medium bg-forest text-white px-3 py-1.5 rounded-lg hover:bg-forest-light disabled:opacity-40 mt-1">
          {isPending ? "Saving…" : "Add"}
        </button>
      </form>
      {error && <p className="text-xs text-status-red mt-2">{error}</p>}
    </div>
  );
}
