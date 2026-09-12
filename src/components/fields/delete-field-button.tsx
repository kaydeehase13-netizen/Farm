"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFieldAction } from "@/lib/actions";

export function DeleteFieldButton({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm(`Permanently delete "${fieldName}"? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteFieldAction(fieldId);
        router.push("/fields");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this field.");
      }
    });
  }

  return (
    <div className="text-right">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-status-red text-sm font-medium hover:underline disabled:opacity-40"
      >
        {isPending ? "Deleting…" : "Delete Field"}
      </button>
      {error && <p className="text-xs text-status-red mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
