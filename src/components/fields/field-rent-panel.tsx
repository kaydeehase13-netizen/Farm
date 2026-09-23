"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFieldExpenseAction, deleteTransactionAction, recordMultiFieldExpenseAction } from "@/lib/actions";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export type FieldRentEntry = {
  transactionId: string;
  date: string;
  vendorName?: string;
  description: string;
  categoryName?: string;
  /** This field's share. */
  amount: number;
  /** Whole payment, when it's split across several fields. */
  paymentTotal: number;
  otherFields: string[];
};

/**
 * Rent (and other rent-type expenses) on this field for the year, each one
 * editable, plus a form to split one payment across several fields.
 */
export function FieldRentPanel({
  fieldId, taxYear, entries, fields, farmCategories, landownerName,
}: {
  fieldId: string;
  taxYear: number;
  entries: FieldRentEntry[];
  fields: { id: string; name: string; acres?: number }[];
  farmCategories: { id: string; name: string }[];
  landownerName?: string;
}) {
  const [showSplit, setShowSplit] = useState(false);
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-forest">Rent on this field ({taxYear})</div>
      {entries.length === 0 && <p className="text-xs text-charcoal/50">No rent recorded for this field in {taxYear}.</p>}
      {entries.map((e) => <RentRow key={e.transactionId} entry={e} fieldId={fieldId} />)}
      {!showSplit ? (
        <button type="button" onClick={() => setShowSplit(true)} className="text-xs font-medium text-forest hover:underline">
          + Split one payment across several fields
        </button>
      ) : (
        <MultiFieldExpenseForm
          fieldId={fieldId} fields={fields} farmCategories={farmCategories}
          landownerName={landownerName} onClose={() => setShowSplit(false)}
        />
      )}
    </div>
  );
}

function RentRow({ entry, fieldId }: { entry: FieldRentEntry; fieldId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.date);
  const [vendor, setVendor] = useState(entry.vendorName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shared = entry.otherFields.length > 0;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateFieldExpenseAction({ transactionId: entry.transactionId, fieldId, amount: Number(amount), transactionDate: date, vendorName: vendor });
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }
  function remove() {
    if (!window.confirm(`Delete this ${money(entry.amount)} payment?`)) return;
    startTransition(async () => {
      try { await deleteTransactionAction(entry.transactionId); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete that."); }
    });
  }

  return (
    <div className="text-sm border-b border-charcoal/10 last:border-0 pb-1.5">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div>{entry.description}</div>
            <div className="text-xs text-charcoal/50">
              {entry.date}{entry.vendorName ? ` · ${entry.vendorName}` : ""}{entry.categoryName ? ` · ${entry.categoryName}` : ""}
              {shared && ` · part of a ${money(entry.paymentTotal)} payment also covering ${entry.otherFields.join(", ")}`}
            </div>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="font-medium">{money(entry.amount)}</div>
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-forest hover:underline">Edit</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 bg-cream-deep/40 rounded-lg p-2">
          <div className="text-xs text-charcoal/60">{entry.description}</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-charcoal/60">{shared ? "This field's share ($)" : "Amount ($)"}
              <input className="input block w-32" type="number" step="0.01" min="0" value={amount} disabled={isPending} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="text-xs text-charcoal/60">Date
              <input className="input block w-40" type="date" value={date} disabled={isPending} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-xs text-charcoal/60">Paid to
              <input className="input block w-44" value={vendor} disabled={isPending} onChange={(e) => setVendor(e.target.value)} />
            </label>
          </div>
          {shared && <p className="text-xs text-charcoal/50">Only this field&apos;s share changes; the payment total becomes the new sum of all its fields.</p>}
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={isPending} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">{isPending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} disabled={isPending} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
            <button type="button" onClick={remove} disabled={isPending} className="text-xs text-status-red hover:underline ml-auto">
              Delete {shared ? "whole payment" : "payment"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-status-red mt-1">{error}</p>}
    </div>
  );
}

function MultiFieldExpenseForm({ fieldId, fields, farmCategories, landownerName, onClose }: {
  fieldId: string;
  fields: { id: string; name: string; acres?: number }[];
  farmCategories: { id: string; name: string }[];
  landownerName?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set([fieldId]));
  const [method, setMethod] = useState<"acres" | "even" | "manual">("acres");
  const [total, setTotal] = useState("");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [categoryId, setCategoryId] = useState(farmCategories.find((c) => c.name.trim().toLowerCase() === "rent")?.id ?? farmCategories.find((c) => c.name.toLowerCase().includes("rent"))?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState(landownerName ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sorted = useMemo(() => [...fields].sort((a, b) => Number(b.id === fieldId) - Number(a.id === fieldId) || a.name.localeCompare(b.name)), [fields, fieldId]);

  const preview = useMemo(() => {
    const chosen = sorted.filter((f) => picked.has(f.id));
    if (method === "manual") return chosen.map((f) => ({ ...f, amount: Number(manual[f.id]) || 0 }));
    const t = Number(total) || 0;
    const w = chosen.map((f) => (method === "acres" ? f.acres ?? 0 : 1));
    const sw = w.reduce((a, b) => a + b, 0);
    return chosen.map((f, i) => ({ ...f, amount: sw > 0 ? (t * w[i]) / sw : 0 }));
  }, [sorted, picked, method, total, manual]);
  const previewTotal = preview.reduce((s, p) => s + p.amount, 0);

  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const r = await recordMultiFieldExpenseAction({
          fieldIds: [...picked], totalAmount: Number(total), method,
          manualAmounts: Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, Number(v) || 0])),
          farmCategoryId: categoryId, transactionDate: date, vendorName: vendor, note,
        });
        setDone(`Saved one ${money(r.total)} payment across ${r.shares.length} field${r.shares.length === 1 ? "" : "s"}.`);
        setTotal(""); setManual({}); setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="border border-[--border-color] rounded-lg p-3 space-y-3 bg-cream-deep/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-forest">Split one payment across several fields</div>
        <button type="button" onClick={onClose} className="text-xs text-charcoal/60 hover:underline">Close</button>
      </div>
      <p className="text-xs text-charcoal/50">Saved as one real expense (one check) with a share on each field, so each field&apos;s margin gets its part.</p>

      <div className="flex flex-wrap gap-3 text-xs">
        {(["acres", "even", "manual"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
            {m === "acres" ? "Split by acres" : m === "even" ? "Split evenly" : "Type each field's amount"}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {method !== "manual" && (
          <label className="block"><div className="text-[11px] text-charcoal/50 mb-0.5">Total paid ($)</div>
            <input type="number" step="0.01" min="0" className="input text-sm" value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
        )}
        <label className="block"><div className="text-[11px] text-charcoal/50 mb-0.5">Date</div>
          <input type="date" className="input text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block"><div className="text-[11px] text-charcoal/50 mb-0.5">Category</div>
          <select className="input text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose…</option>
            {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block"><div className="text-[11px] text-charcoal/50 mb-0.5">Paid to</div>
          <input className="input text-sm" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </label>
        <label className="block col-span-2"><div className="text-[11px] text-charcoal/50 mb-0.5">Description (optional)</div>
          <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Defaults to Rent — field names" />
        </label>
      </div>

      <div className="max-h-64 overflow-y-auto border border-[--border-color] rounded-lg p-2 space-y-1">
        {sorted.map((f) => {
          const p = preview.find((x) => x.id === f.id);
          return (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)} />
              <span className="flex-1">{f.name} <span className="text-xs text-charcoal/40">{f.acres ? `${f.acres} ac` : "no acres on file"}</span></span>
              {picked.has(f.id) && method === "manual" && (
                <input type="number" step="0.01" min="0" className="input text-sm w-28" placeholder="$" value={manual[f.id] ?? ""} onChange={(e) => setManual((m) => ({ ...m, [f.id]: e.target.value }))} />
              )}
              {picked.has(f.id) && method !== "manual" && <span className="text-xs w-24 text-right">{p && p.amount > 0 ? money(p.amount) : ""}</span>}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-charcoal/60">{picked.size} field{picked.size === 1 ? "" : "s"} · total {money(previewTotal)}</div>

      {error && <p className="text-xs text-status-red">{error}</p>}
      {done && <p className="text-xs text-forest">{done}</p>}
      <button type="submit" disabled={isPending} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {isPending ? "Saving…" : "Save payment"}
      </button>
    </form>
  );
}
