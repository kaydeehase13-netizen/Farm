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
 * Only ownership is editable here; other field details stay on the New
 * Field-style form elsewhere.
 */
export function FieldOwnershipEditor({ fieldId, ownership }: { fieldId: string; ownership: FieldOwnership }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<FieldOwnership>(ownership);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("ownership", value);
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
        {currentLabel} — edit
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select className="input text-xs py-1" value={value} onChange={(e) => setValue(e.target.value as FieldOwnership)}>
        {OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" onClick={save} disabled={isPending} className="text-xs font-medium bg-forest text-white px-2 py-1 rounded-lg hover:bg-forest-light disabled:opacity-40">
        {isPending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => { setOpen(false); setValue(ownership); }} className="text-xs text-charcoal/45 hover:underline">Cancel</button>
      {error && <span className="text-xs text-status-red">{error}</span>}
    </span>
  );
}
