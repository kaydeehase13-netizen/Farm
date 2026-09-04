"use client";

import { useId, useMemo, useState } from "react";

type SplitLine = { key: string; farmCategoryId: string; amount: string };

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
  const newLine = (): SplitLine => ({ key: `${makeKey}-${keySeq++}`, farmCategoryId: farmCategories[0]?.id ?? "", amount: "" });
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() => [newLine(), newLine()]);

  const splitTotal = useMemo(
    () => splitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
    [splitLines]
  );
  const amountNum = Number(amount) || 0;
  const splitMismatch = splitting && Math.abs(splitTotal - amountNum) > 0.005;

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
    if (Math.abs(splitTotal - amountNum) > 0.005) {
      e.preventDefault();
      setSplitError(`Category amounts add up to ${splitTotal.toFixed(2)}, but the total above is ${amountNum.toFixed(2)}. Fix one so they match before saving.`);
      return;
    }
    if (splitLines.some((l) => !l.farmCategoryId || !l.amount)) {
      e.preventDefault();
      setSplitError("Every category line needs a category and an amount.");
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
      <Field label="Total Amount">
        <input type="number" step="0.01" name="amount" required className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {type === "expense" && (
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
        This one receipt/check covers more than one category (e.g. oil &amp; mineral royalties together) — split it
      </label>

      {!splitting && (
        <Field label="Category">
          <select name="farmCategoryId" className="input">
            {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      {splitting && (
        <div className="space-y-2 border border-[--border-color] rounded-lg p-3">
          <div className="text-sm font-medium text-charcoal/70">Category breakdown</div>
          {splitLines.map((line) => (
            <div key={line.key} className="flex gap-2 items-center">
              <select
                className="input flex-1"
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
            + Add another category
          </button>
          <div className={`text-xs ${splitMismatch ? "text-status-red" : "text-charcoal/50"}`}>
            Categories total {splitTotal.toFixed(2)} of {amountNum.toFixed(2)}
          </div>
          {splitError && <p className="text-sm text-status-red">{splitError}</p>}
          <input type="hidden" name="splitLines" value={JSON.stringify(splitLines.map((l) => ({ farmCategoryId: l.farmCategoryId, amount: l.amount })))} />
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
        Save {type === "income" ? "Income" : "Expense"}
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
