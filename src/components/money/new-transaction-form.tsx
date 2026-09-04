"use client";

import { useId, useMemo, useState } from "react";

type LineType = "income" | "expense";
type SplitLine = { key: string; type: LineType; farmCategoryId: string; amount: string };

export function NewTransactionForm({
  action, defaultType, farmCategories, fields,
}: {
  action: (formData: FormData) => void;
  defaultType: "income" | "expense";
  farmCategories: { id: string; name: string }[];
  fields: { id: string; name: string }[];
}) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const makeKey = useId();
  let keySeq = 0;
  const newLine = (): SplitLine => ({ key: `${makeKey}-${keySeq++}`, type, farmCategoryId: farmCategories[0]?.id ?? "", amount: "" });
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() => [newLine(), newLine()]);

  // Net total accounts for lines of different types — e.g. a royalty check
  // that pays gross income minus a deducted expense nets out to less than
  // the sum of the two amounts. When every line is the same type this is
  // just their plain sum, same as before.
  const splitNet = useMemo(
    () => splitLines.reduce((sum, l) => sum + (l.type === "expense" ? -1 : 1) * (Number(l.amount) || 0), 0),
    [splitLines]
  );
  const hasMixedTypes = new Set(splitLines.map((l) => l.type)).size > 1;
  const amountNum = Number(amount) || 0;
  const splitMismatch = splitting && Math.abs(splitNet - amountNum) > 0.005;

  function updateLine(key: string, patch: Partial<SplitLine>) {
    setSplitLines((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setSplitLines((lines) => [...lines, newLine()]);
  }
  function removeLine(key: string) {
    setSplitLines((lines) => (lines.length <= 2 ? lines : lines.filter((l) => l.key !== key)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!splitting) return;
    if (Math.abs(splitNet - amountNum) > 0.005) {
      e.preventDefault();
      setSplitError(`These lines net out to ${splitNet.toFixed(2)}, but the total above is ${amountNum.toFixed(2)}. Fix one so they match before saving.`);
      return;
    }
    if (splitLines.some((l) => !l.farmCategoryId || !l.amount)) {
      e.preventDefault();
      setSplitError("Every line needs a category and an amount.");
      return;
    }
    setSplitError(null);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <div className="text-sm font-medium text-charcoal/70 mb-1">Type</div>
        <div className="flex gap-2">
          <label className={`flex-1 text-center border rounded-lg py-2 cursor-pointer font-medium ${type === "income" ? "bg-forest text-white border-forest" : "border-[--border-color]"}`}>
            <input type="radio" name="transactionType" value="income" checked={type === "income"} onChange={() => setType("income")} className="sr-only" />
            Income
          </label>
          <label className={`flex-1 text-center border rounded-lg py-2 cursor-pointer font-medium ${type === "expense" ? "bg-forest text-white border-forest" : "border-[--border-color]"}`}>
            <input type="radio" name="transactionType" value="expense" checked={type === "expense"} onChange={() => setType("expense")} className="sr-only" />
            Expense
          </label>
        </div>
        {splitting && <p className="text-xs text-charcoal/50 mt-1">Only used as the starting type for a new line below — each line in a split can be Income or Expense on its own.</p>}
      </div>

      <Field label="Date">
        <input type="date" name="transactionDate" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
      </Field>
      <Field label={type === "income" ? "Source / Buyer" : "Vendor"}>
        <input name="vendorName" placeholder={type === "income" ? "e.g. Hutchinson Grain Elevator" : "e.g. Reno County Co-op"} className="input" />
      </Field>
      <Field label="Description">
        <input name="description" placeholder="What was it?" className="input" required />
      </Field>
      <Field label={splitting ? "Net Total (what the check/receipt actually totals)" : "Total Amount"}>
        <input type="number" step="0.01" name="amount" required className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {!splitting && type === "expense" && (
        <Field label="Sales Tax">
          <input type="number" step="0.01" name="salesTax" className="input" placeholder="0.00" />
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm bg-wheat/20 border border-wheat rounded-lg px-3 py-2">
        <input
          type="checkbox"
          checked={splitting}
          onChange={(e) => { setSplitting(e.target.checked); setSplitError(null); }}
        />
        This one receipt/check covers more than one category (e.g. oil &amp; mineral royalties together, or gross income minus a deducted expense) — split it
      </label>

      {!splitting && (
        <Field label="Category">
          <select name="farmCategoryId" className="input">
            {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      {!splitting && type === "expense" && (
        <Field label="Product / Variety (optional)">
          <input name="productName" placeholder="e.g. DeKalb 63-91, Roundup PowerMax" className="input" />
        </Field>
      )}
      {!splitting && type === "expense" && (
        <p className="text-xs text-charcoal/50 -mt-2">
          For a Seed, Chemical, or Fertilizer expense: fill this in along with a field above and it&apos;s automatically tagged
          into that field&apos;s activity record too — no need to enter it twice.
        </p>
      )}

      {splitting && (
        <div className="space-y-2 border border-[--border-color] rounded-lg p-3">
          <div className="text-sm font-medium text-charcoal/70">Line-item breakdown</div>
          <p className="text-xs text-charcoal/50">
            Each line can be its own Income or Expense — useful for a check that pays gross royalty income minus a deducted expense, not just a receipt split across categories of the same type.
          </p>
          {splitLines.map((line) => (
            <div key={line.key} className="flex flex-wrap gap-2 items-center">
              <div className="flex rounded-lg border border-[--border-color] overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => updateLine(line.key, { type: "income" })}
                  className={`px-2.5 py-2 ${line.type === "income" ? "bg-forest text-white" : "bg-transparent text-charcoal/60"}`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => updateLine(line.key, { type: "expense" })}
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
                type="button" onClick={() => removeLine(line.key)} disabled={splitLines.length <= 2}
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
          <div className={`text-xs ${splitMismatch ? "text-status-red" : "text-charcoal/50"}`}>
            {hasMixedTypes
              ? `Net of these lines: ${splitNet.toFixed(2)} (target ${amountNum.toFixed(2)})`
              : `Lines total ${splitNet.toFixed(2)} of ${amountNum.toFixed(2)}`}
          </div>
          {splitError && <p className="text-sm text-status-red">{splitError}</p>}
          <input type="hidden" name="splitLines" value={JSON.stringify(splitLines.map((l) => ({ type: l.type, farmCategoryId: l.farmCategoryId, amount: l.amount })))} />
        </div>
      )}

      <Field label="Assign to Field (optional)">
        <select name="fieldId" className="input">
          <option value="">— General farm overhead —</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Payment Method">
        <input name="paymentMethod" placeholder="Farm Credit Card, Check #, Cash…" className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPersonalExcluded" /> This is personal / not a farm transaction
      </label>

      <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium hover:bg-forest-light w-full">
        {splitting ? "Save Split Transaction" : `Save ${type === "income" ? "Income" : "Expense"}`}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>
      {children}
    </label>
  );
}
