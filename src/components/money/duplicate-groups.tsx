"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/types/domain";
import { money } from "@/components/ui/stat-card";
import { deleteTransactionAction, markNotDuplicateAction } from "@/lib/actions";
import { taxCategoryLabel } from "@/lib/tax-categories";

type Names = { categories: Record<string, string>; fields: Record<string, string> };

/**
 * Duplicate rows look IDENTICAL by design (same type, vendor/description,
 * date, and amount -- that's the whole point of flagging them). Grouping
 * explicitly and picking one to keep removes the guesswork. "Compare"
 * lays every copy side by side with anything that differs highlighted, and
 * links to open each one, so you can tell real duplicates from look-alikes;
 * "Not a duplicate" marks the whole group as checked so it stops showing.
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

/** What gets compared, one row per item. */
function compareRows(names: Names): { label: string; value: (t: Transaction) => string }[] {
  return [
    { label: "Date", value: (t) => t.transactionDate },
    { label: "Description", value: (t) => t.description ?? "—" },
    { label: "Vendor", value: (t) => t.vendorName ?? "—" },
    { label: "Category", value: (t) => (t.farmCategoryId && names.categories[t.farmCategoryId]) || "Uncategorized" },
    { label: "Tax line", value: (t) => taxCategoryLabel(t.taxCategoryCode) },
    { label: "Product", value: (t) => t.productName ?? "—" },
    { label: "Payment", value: (t) => t.paymentMethod ?? "—" },
    { label: "Sales tax", value: (t) => (t.salesTax ? money(t.salesTax) : "—") },
    {
      label: "Fields",
      value: (t) => t.splits.filter((s) => s.fieldId).map((s) => `${names.fields[s.fieldId!] ?? "Field"} ${money(s.allocatedAmount)}`).join(", ") || "—",
    },
    { label: "Receipt", value: (t) => (t.receiptId ? "On file" : "None") },
    { label: "Status", value: (t) => t.status.replace("_", " ") },
    { label: "CPA note", value: (t) => t.cpaNote ?? "—" },
    { label: "Entered", value: (t) => new Date(t.createdAt).toLocaleString() },
  ];
}

function DuplicateGroup({ groupKey, transactions, names, note }: { groupKey: string; transactions: Transaction[]; names: Names; note?: string }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(() => pickDefaultKeeper(transactions));
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toDelete = transactions.filter((t) => t.id !== keepId);
  const first = transactions[0];
  const rows = compareRows(names).map((r) => {
    const values = transactions.map(r.value);
    return { ...r, values, differs: new Set(values).size > 1 };
  });
  // "Entered" always differs, so it doesn't count as a real difference.
  const differences = rows.filter((r) => r.differs && r.label !== "Entered").map((r) => r.label);

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

  function notDuplicate() {
    setErr(null);
    startTransition(async () => {
      try {
        await markNotDuplicateAction(transactions.map((t) => t.id), true);
        setDone(true);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  if (done) return null;

  return (
    <div className="border border-[--border-color] rounded-lg p-3 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-sm">
          <span className="font-medium">{first.vendorName ?? first.description ?? "—"}</span>
          <span className="text-charcoal/50"> · {first.transactionDate} · {money(first.amount)} · {transactions.length} copies</span>
          {note && <div className="text-xs mt-0.5 text-charcoal/60">{note}</div>}
          <div className={`text-xs mt-0.5 ${differences.length ? "text-status-amber" : "text-charcoal/50"}`}>
            {differences.length
              ? `Not identical: ${differences.join(", ").toLowerCase()} ${differences.length === 1 ? "differs" : "differ"}. Compare before deleting.`
              : "Every detail matches."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setComparing((c) => !c)} className="text-forest text-sm font-medium hover:underline">
            {comparing ? "Hide compare" : "Compare"}
          </button>
          <button type="button" onClick={notDuplicate} disabled={isPending} className="text-sm font-medium text-charcoal/70 hover:underline disabled:opacity-40">
            Not a duplicate
          </button>
          <button
            type="button"
            onClick={deleteRest}
            disabled={isPending || toDelete.length === 0}
            className="text-status-red text-sm font-medium hover:underline disabled:opacity-40"
          >
            Keep 1, delete other {toDelete.length}
          </button>
        </div>
      </div>
      {err && <div className="text-xs text-status-red mb-2">{err}</div>}

      {comparing ? (
        <div className="overflow-x-auto mb-2">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-normal text-charcoal/50 py-1 pr-2" />
                {transactions.map((t, i) => (
                  <th key={t.id} className="text-left py-1 px-2 align-top">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name={`keep-${groupKey}`} checked={t.id === keepId} onChange={() => setKeepId(t.id)} disabled={isPending} />
                      <span className={t.id === keepId ? "text-forest" : "text-status-red"}>Copy {i + 1}: {t.id === keepId ? "Keep" : "Delete"}</span>
                    </label>
                    <div className="font-normal mt-0.5 space-x-2">
                      <a href={`/money/transactions/${t.id}`} target="_blank" rel="noreferrer" className="text-forest hover:underline">Open</a>
                      {t.receiptId && <a href={`/money/receipts/${t.receiptId}`} target="_blank" rel="noreferrer" className="text-forest hover:underline">Receipt</a>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={`border-t border-charcoal/10 ${r.differs && r.label !== "Entered" ? "bg-status-amber/10" : ""}`}>
                  <td className="py-1 pr-2 text-charcoal/50 whitespace-nowrap">{r.label}</td>
                  {r.values.map((v, i) => <td key={i} className="py-1 px-2">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-charcoal/45 mt-1">Highlighted rows are where the copies differ. &quot;Open&quot; shows the full transaction in a new tab.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((t) => (
            <label key={t.id} className="flex flex-wrap items-center gap-2 text-xs text-charcoal/70 py-1 px-2 rounded hover:bg-sage-light/30 cursor-pointer">
              <input type="radio" name={`keep-${groupKey}`} checked={t.id === keepId} onChange={() => setKeepId(t.id)} disabled={isPending} />
              <span className={t.id === keepId ? "font-medium text-forest" : ""}>{t.id === keepId ? "Keep" : "Delete"}</span>
              <span>entered {new Date(t.createdAt).toLocaleDateString()}</span>
              <span>·</span>
              <span>{(t.farmCategoryId && names.categories[t.farmCategoryId]) || "Uncategorized"}</span>
              <span>·</span>
              <span>{t.status.replace("_", " ")}</span>
              {t.receiptId && <span className="status-pill status-green">receipt on file</span>}
              <a href={`/money/transactions/${t.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-forest hover:underline ml-auto">Open</a>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewedGroups({ groups }: { groups: { key: string; transactions: Transaction[] }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  if (groups.length === 0) return null;
  return (
    <div className="mt-3 text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-charcoal/60 hover:underline">
        {open ? "Hide" : "Show"} {groups.length} group{groups.length === 1 ? "" : "s"} marked not a duplicate
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {groups.map((g) => {
            const t = g.transactions[0];
            return (
              <div key={g.key} className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-charcoal/10 py-1.5">
                <span>{t.vendorName ?? t.description ?? "—"} · {t.transactionDate} · {money(t.amount)} · {g.transactions.length} copies</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(async () => { await markNotDuplicateAction(g.transactions.map((x) => x.id), false); router.refresh(); })}
                  className="text-forest hover:underline"
                >
                  Undo — check again
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DuplicateGroups({ groups, reviewed = [], names, emptyText }: {
  groups: { key: string; transactions: Transaction[]; note?: string }[];
  reviewed?: { key: string; transactions: Transaction[] }[];
  names: Names;
  emptyText?: string;
}) {
  return (
    <div>
      {groups.length === 0 ? (
        <p className="text-sm text-charcoal/50">{emptyText ?? "Nothing flagged — no two transactions on file share the same type, name, date, and amount."}</p>
      ) : (
        groups.map((g) => <DuplicateGroup key={g.key} groupKey={g.key} transactions={g.transactions} names={names} note={g.note} />)
      )}
      <ReviewedGroups groups={reviewed} />
    </div>
  );
}
