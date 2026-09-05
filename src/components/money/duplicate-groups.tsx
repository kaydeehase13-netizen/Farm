"use client";

import { useState, useTransition } from "react";
import type { Transaction } from "@/types/domain";
import { money } from "@/components/ui/stat-card";
import { deleteTransactionAction } from "@/lib/actions";

/**
 * Duplicate rows look IDENTICAL by design (same type, vendor/description,
 * date, and amount -- that's the whole point of flagging them). That made
 * the old flat checkbox table genuinely impossible to use correctly: once
 * you deleted a couple of copies out of a group, any remaining copies still
 * looked exactly like the ones you'd just deleted, so it read as "I deleted
 * these and they're still here" even when the delete had actually worked on
 * a different, visually-identical row. Grouping explicitly and picking one
 * to keep removes the guesswork -- you never have to tell two identical-
 * looking rows apart by eye.
 */
function pickDefaultKeeper(group: Transaction[]): string {
  // Prefer one with a receipt on file (documentation), then one that's
  // already been categorized/reconciled rather than "needs review", then
  // simply the oldest entry (first one entered).
  const scored = group.map((t) => ({
    t,
    score: (t.receiptId ? 2 : 0) + (t.status !== "needs_review" ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.t.createdAt.localeCompare(b.t.createdAt));
  return scored[0].t.id;
}

function DuplicateGroup({ groupKey, transactions }: { groupKey: string; transactions: Transaction[] }) {
  const [keepId, setKeepId] = useState(() => pickDefaultKeeper(transactions));
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const toDelete = transactions.filter((t) => t.id !== keepId);
  const first = transactions[0];

  function deleteRest() {
    if (!window.confirm(`Keep 1 copy and permanently delete the other ${toDelete.length}? This can't be undone.`)) return;
    startTransition(async () => {
      const failures: string[] = [];
      for (const t of toDelete) {
        try {
          await deleteTransactionAction(t.id);
        } catch (e) {
          failures.push(e instanceof Error ? e.message : "unknown error");
        }
      }
      if (failures.length > 0) {
        window.alert(`${failures.length} of ${toDelete.length} couldn't be deleted:\n${failures.join("\n")}`);
      } else {
        setDone(true);
      }
    });
  }

  if (done) return null; // this group is cleared -- drop it rather than show 1 leftover row with nothing to compare it to

  return (
    <div className="border border-[--border-color] rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">
          <span className="font-medium">{first.vendorName ?? first.description ?? "—"}</span>
          <span className="text-charcoal/50"> · {first.transactionDate} · {money(first.amount)} · {transactions.length} copies</span>
        </div>
        <button
          onClick={deleteRest}
          disabled={isPending || toDelete.length === 0}
          className="text-status-red text-sm font-medium hover:underline disabled:opacity-40"
        >
          Keep 1, delete other {toDelete.length}
        </button>
      </div>
      <div className="space-y-1">
        {transactions.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-xs text-charcoal/70 py-1 px-2 rounded hover:bg-sage-light/30 cursor-pointer">
            <input
              type="radio"
              name={`keep-${groupKey}`}
              checked={t.id === keepId}
              onChange={() => setKeepId(t.id)}
              disabled={isPending}
            />
            <span className={t.id === keepId ? "font-medium text-forest" : ""}>{t.id === keepId ? "Keep" : "Delete"}</span>
            <span>entered {new Date(t.createdAt).toLocaleDateString()}</span>
            <span>·</span>
            <span>{t.status.replace("_", " ")}</span>
            {t.receiptId && <span className="status-pill status-green">receipt on file</span>}
            <span className="text-charcoal/40">id …{t.id.slice(-6)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function DuplicateGroups({ groups }: { groups: { key: string; transactions: Transaction[] }[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-charcoal/50">Nothing flagged — no two transactions on file share the same type, name, date, and amount.</p>;
  }
  return (
    <div>
      {groups.map((g) => (
        <DuplicateGroup key={g.key} groupKey={g.key} transactions={g.transactions} />
      ))}
    </div>
  );
}
