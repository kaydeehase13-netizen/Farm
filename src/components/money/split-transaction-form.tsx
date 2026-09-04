"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { splitTransactionAction } from "@/lib/actions";
import { money } from "@/components/ui/stat-card";

type LineType = "income" | "expense";
type SplitLine = { key: string; type: LineType; farmCategoryId: string; amount: string };

export function SplitTransactionForm({
  transactionId, originalType, originalAmount, originalFarmCategoryId, farmCategories,
}: {
  transactionId: string;
  originalType: "income" | "expense";
  originalAmount: number;
  originalFarmCategoryId?: string;
  farmCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const makeKey = useId();
  let keySeq = 0;
  const newLine = (type: LineType = originalType, farmCategoryId = farmCategories[0]?.id ?? ""): SplitLine =>
    ({ key: `${makeKey}-${keySeq++}`, type, farmCategoryId, amount: "" });
  const [lines, setLines] = useState<SplitLine[]>(() => [
    newLine(originalType, originalFarmCategoryId ?? farmCategories[0]?.id ?? ""),
    newLine(),
  ]);

  const net = useMemo(
    () => lines.reduce((sum, l) => sum + (l.type === "expense" ? -1 : 1) * (Number(l.amount) || 0), 0),
    [lines]
  );
  const hasMixedTypes = new Set(lines.map((l) => l.type)).size > 1;
  const mismatch = Math.abs(net - originalAmount) > 0.005;

  function updateLine(key: string, patch: Partial<SplitLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, newLine()]);
  }
  function removeLine(key: string) {
    setLines((ls) => (ls.length <= 2 ? ls : ls.filter((l) => l.key !== key)));
  }

  function submit() {
    if (mismatch) {
      setError(`These lines net out to ${net.toFixed(2)}, but the original transaction totals ${originalAmount.toFixed(2)}. Fix one so they match.`);
      return;
    }
    if (lines.some((l) => !l.farmCategoryId || !l.amount)) {
      setError("Every line needs a category and an amount.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("splitLines", JSON.stringify(lines.map((l) => ({ type: l.type, farmCategoryId: l.farmCategoryId, amount: l.amount }))));
    startTransition(async () => {
      await splitTransactionAction(transactionId, fd);
      router.push("/money/transactions");
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <p className="text-sm text-charcoal/60">
        Original transaction total: <span className="font-medium text-charcoal">{money(originalAmount)}</span> ({originalType}).
        Break it into two or more lines below — each becomes its own transaction, keeping its own type and category.
      </p>

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.key} className="flex flex-wrap gap-2 items-center">
            <div className="flex rounded-lg border border-[--border-color] overflow-hidden text-xs font-medium">
              <button
                type="button" onClick={() => updateLine(line.key, { type: "income" })}
                className={`px-2.5 py-2 ${line.type === "income" ? "bg-forest text-white" : "bg-transparent text-charcoal/60"}`}
              >
                Income
              </button>
              <button
                type="button" onClick={() => updateLine(line.key, { type: "expense" })}
                className={`px-2.5 py-2 ${line.type === "expense" ? "bg-forest text-white" : "bg-transparent text-charcoal/60"}`}
              >
                Expense
              </button>
            </div>
            <select
              className="input flex-1 min-w-[140px]"
              value={line.farmCategoryId}
              onChange={(e) => updateLine(line.key, { farmCategoryId: e.target.value })}
            >
              {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="number" step="0.01" placeholder="0.00" className="input w-28"
              value={line.amount} onChange={(e) => updateLine(line.key, { amount: e.target.value })}
            />
            <button
              type="button" onClick={() => removeLine(line.key)} disabled={lines.length <= 2}
              className="text-charcoal/40 hover:text-status-red disabled:opacity-30 px-2"
              title="Remove line"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addLine} className="text-sm font-medium text-forest hover:underline">
          + Add another line
        </button>
      </div>

      <div className={`text-xs ${mismatch ? "text-status-red" : "text-charcoal/50"}`}>
        {hasMixedTypes
          ? `Net of these lines: ${net.toFixed(2)} (target ${originalAmount.toFixed(2)})`
          : `Lines total ${net.toFixed(2)} of ${originalAmount.toFixed(2)}`}
      </div>
      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button" onClick={submit} disabled={isPending}
          className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium hover:bg-forest-light disabled:opacity-50"
        >
          {isPending ? "Splitting…" : "Split This Transaction"}
        </button>
        <button
          type="button" onClick={() => router.push("/money/transactions")} disabled={isPending}
          className="card px-5 py-2.5 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
