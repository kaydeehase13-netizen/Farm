"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFieldAction } from "@/lib/actions";
import type { FieldOwnership } from "@/types/domain";

const OWNERSHIP_OPTIONS: { value: FieldOwnership; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "rented_cash", label: "Rented — Cash Rent" },
  { value: "rented_crop_share", label: "Rented — Crop Share" },
  { value: "rented_flex", label: "Rented — Flex Lease" },
];

/**
 * Every field defaults to "owned" at creation (both the New Field form and
 * bulk/CSV import) with no way to correct it afterward — this is that fix.
 * Also edits landowner name (pairs naturally with a rented field, and feeds
 * the "Paid To" default on the rent-payment form below) and the field's
 * NAME itself — renaming matters because activity import matches fields by
 * name, so a field name that doesn't match what a new AgFiniti/display
 * import calls it needs to be reconciled one way or the other before that
 * import will land on the right field instead of creating a duplicate.
 */
export function FieldOwnershipEditor({ fieldId, name, ownership, landownerName }: { fieldId: string; name: string; ownership: FieldOwnership; landownerName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fieldName, setFieldName] = useState(name);
  const [value, setValue] = useState<FieldOwnership>(ownership);
  const [landowner, setLandowner] = useState(landownerName ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    if (!fieldName.trim()) { setError("Field name can't be blank."); return; }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", fieldName.trim());
        fd.set("ownership", value);
        fd.set("landownerName", landowner);
        await updateFieldAction(fieldId, fd);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  const currentLabel = OWNERSHIP_OPTIONS.find((o) => o.value === ownership)?.label ?? ownership;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-forest hover:underline">
        {currentLabel}{landownerName ? ` — ${landownerName}` : ""} — edit name / ownership
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <input className="input text-xs py-1" placeholder="Field name" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
      <select className="input text-xs py-1" value={value} onChange={(e) => setValue(e.target.value as FieldOwnership)}>
        {OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input className="input text-xs py-1" placeholder="Landowner name" value={landowner} onChange={(e) => setLandowner(e.target.value)} />
      <button type="button" onClick={save} disabled={isPending} className="text-xs font-medium bg-forest text-white px-2 py-1 rounded-lg hover:bg-forest-light disabled:opacity-40">
        {isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => { setOpen(false); setFieldName(name); setValue(ownership); setLandowner(landownerName ?? ""); }} className="text-xs text-charcoal/45 hover:underline">Cancel</button>
      {error && <span className="text-xs text-status-red">{error}</span>}
    </span>
  );
}
