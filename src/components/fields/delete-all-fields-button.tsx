"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAllFieldsAction } from "@/lib/actions";

export function DeleteAllFieldsButton({ fieldCount }: { fieldCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ deleted: string[]; skipped: { name: string; reason: string }[] } | null>(null);
  const router = useRouter();

  function handleDeleteAll() {
    if (
      !window.confirm(
        `Permanently delete all ${fieldCount} current fields? Any field with a transaction, activity, or crop year on it will be skipped and kept. This can't be undone for the ones that do delete.`
      )
    )
      return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteAllFieldsAction();
      setResult(res);
      router.refresh();
    });
  }

  if (fieldCount === 0 && !result) return null;

  return (
    <div className="card p-5 border-status-red/30 bg-status-red/5">
      <div className="text-sm font-semibold text-status-red mb-1">Start Fresh</div>
      <p className="text-xs text-charcoal/60 mb-3">
        Delete every field currently on file so you can re-import a clean list below. Fields that already have a
        transaction, logged activity, or crop year tied to them will be skipped automatically to protect that
        history.
      </p>
      <button
        type="button"
        onClick={handleDeleteAll}
        disabled={isPending || fieldCount === 0}
        className="border border-status-red text-status-red text-sm font-medium px-4 py-2 rounded-lg hover:bg-status-red hover:text-white disabled:opacity-40"
      >
        {isPending ? "Deleting…" : `Delete All ${fieldCount} Current Fields`}
      </button>

      {result && (
        <div className="mt-4 text-sm space-y-2">
          {result.deleted.length > 0 && (
            <p className="text-forest">
              Deleted {result.deleted.length}: {result.deleted.join(", ")}
            </p>
          )}
          {result.skipped.length > 0 && (
            <div className="text-status-amber">
              <p className="font-medium">Kept {result.skipped.length} (still has history):</p>
              <ul className="list-disc list-inside">
                {result.skipped.map((s) => (
                  <li key={s.name}>
                    {s.name} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.deleted.length === 0 && result.skipped.length === 0 && (
            <p className="text-charcoal/50">No fields to delete.</p>
          )}
        </div>
      )}
    </div>
  );
}
