"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAllActivitiesAction } from "@/lib/actions";

export function DeleteAllActivitiesButton({ activityCount }: { activityCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ deletedCount: number } | null>(null);
  const router = useRouter();

  function handleDeleteAll() {
    if (
      !window.confirm(
        `Permanently delete all ${activityCount} logged/imported field activities (spraying, fertilizing, planting, harvest)? This does NOT touch any money already recorded — transactions and expenses stay exactly as they are. This can't be undone.`
      )
    )
      return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteAllActivitiesAction();
      setResult(res);
      router.refresh();
    });
  }

  if (activityCount === 0 && !result) return null;

  return (
    <div className="card p-5 border-status-red/30 bg-status-red/5">
      <div className="text-sm font-semibold text-status-red mb-1">Clear All Field Activity</div>
      <p className="text-xs text-charcoal/60 mb-3">
        Deletes every logged/imported activity record (spraying, fertilizing, planting, harvest) so a fresh,
        clean import doesn&apos;t stack on top of messy or duplicated rows from before. Transactions and expenses
        you&apos;ve already recorded are never touched.
      </p>
      <button
        type="button"
        onClick={handleDeleteAll}
        disabled={isPending || activityCount === 0}
        className="border border-status-red text-status-red text-sm font-medium px-4 py-2 rounded-lg hover:bg-status-red hover:text-white disabled:opacity-40"
      >
        {isPending ? "Deleting…" : `Delete All ${activityCount} Activity Records`}
      </button>

      {result && (
        <p className="mt-3 text-sm text-forest">
          {result.deletedCount === 0 ? "No activity records to delete." : `Deleted ${result.deletedCount} activity record${result.deletedCount === 1 ? "" : "s"}.`}
        </p>
      )}
    </div>
  );
}
