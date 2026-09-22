"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergeFieldsAction, listAllocatedProductsAction, resplitProductAction, finishResplitAllAction } from "@/lib/actions";

/**
 * Merge this field into another one: its activities, cost splits, crop
 * years, overhead, documents and mileage move to the chosen field, this
 * field is archived, and product costs for the affected years are re-split
 * so the target field gets one clean share per product.
 */
export function MergeFieldButton({ fieldId, fieldName, fields }: {
  fieldId: string;
  fieldName: string;
  fields: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [intoId, setIntoId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = fields.filter((f) => f.id !== fieldId).sort((a, b) => a.name.localeCompare(b.name));
  const intoName = others.find((f) => f.id === intoId)?.name;

  async function merge() {
    if (!intoId || !intoName) { setError("Pick the field to merge into."); return; }
    if (!window.confirm(`Move everything from "${fieldName}" into "${intoName}" and archive "${fieldName}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Moving activity and costs…");
      const r = await mergeFieldsAction(fieldId, intoId);
      let done = 0;
      for (const year of r.years) {
        const products = await listAllocatedProductsAction(year);
        for (const p of products) {
          setStatus(`Re-splitting ${year} costs — ${p.productName} (${++done})…`);
          await resplitProductAction({ year, productName: p.productName }).catch(() => null);
        }
      }
      await finishResplitAllAction().catch(() => {});
      setStatus(`Moved ${r.activities} activit${r.activities === 1 ? "y" : "ies"} and ${r.costSplits} cost split${r.costSplits === 1 ? "" : "s"}; re-split ${done} product cost${done === 1 ? "" : "s"}.`);
      router.push(`/fields/${intoId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't merge these fields.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-forest hover:underline">
        Merge into…
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select className="input w-56" value={intoId} disabled={busy} onChange={(e) => setIntoId(e.target.value)}>
          <option value="">Merge {fieldName} into…</option>
          {others.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button type="button" onClick={merge} disabled={busy || !intoId} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Merging…" : "Merge"}
        </button>
        {!busy && <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-charcoal/60 hover:underline">Cancel</button>}
      </div>
      {status && <p className="text-xs text-charcoal/60 max-w-sm text-right">{status}</p>}
      {error && <p className="text-xs text-status-red max-w-sm text-right">{error}</p>}
    </div>
  );
}
