import { getAppData, getFarm } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createExpenseOrIncome } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function NewTransactionPage({
  searchParams,
}: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const farm = await getFarm();
  const data = await getAppData(farm.currentTaxYear);
  const type = params.type === "income" ? "income" : "expense";

  async function action(formData: FormData) {
    "use server";
    await createExpenseOrIncome(formData);
    redirect("/money/transactions");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title={type === "income" ? "Record Income" : "Record Expense"} description="Tell us what happened — we'll organize the rest." />
      <form action={action} className="card p-6 space-y-4">
        <input type="hidden" name="transactionType" value={type} />

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
            {data.farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Assign to Field (optional)">
          <select name="fieldId" className="input">
            <option value="">— General farm overhead —</option>
            {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
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
    </div>
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
