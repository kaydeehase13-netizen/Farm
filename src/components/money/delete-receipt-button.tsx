"use client";

import { useTransition } from "react";
import { deleteReceiptAction } from "@/lib/actions";

export function DeleteReceiptButton({ receiptId, hasTransaction }: { receiptId: string; hasTransaction: boolean }) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    const msg = hasTransaction
      ? "Delete this receipt? The expense it created will stay, it'll just show as missing documentation."
      : "Delete this receipt? This can't be undone.";
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteReceiptAction(receiptId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "That receipt couldn't be deleted.");
      }
    });
  }

  return (
    <button onClick={onDelete} disabled={isPending} className="text-sm font-medium text-status-red hover:underline">
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
