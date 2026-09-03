"use client";

import { useState } from "react";

export function NewTransactionForm({
  action, defaultType, farmCategories, fields,
}: {
  action: (formData: FormData) => void;
  defaultType: "income" | "expense";
  farmCategories: { id: string; name: string }[];
  fields: { id: string; name: string }[];
}) {
  const [type, setType] = useState<"income" | "expense">(defaultType);

  return (
    <form action={action} className="card p-6 space-y-4">
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
      <Field label="Amount">
        <input type="number" step="0.01" name="amount" required className="input" placeholder="0.00" />
      </Field>
      {type === "expense" && (
        <Field label="Sales Tax">
          <input type="number" step="0.01" name="salesTax" className="input" placeholder="0.00" />
        </Field>
      )}
      <Field label="Category">
        <select name="farmCategoryId" className="input">
          {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
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
