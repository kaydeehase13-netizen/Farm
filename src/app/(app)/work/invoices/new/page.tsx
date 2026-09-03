import { PageHeader } from "@/components/ui/stat-card";
import { createManualInvoiceAction } from "@/lib/actions";
import { listCustomers } from "@/lib/data/repo";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
  const customers = await listCustomers();

  async function action(formData: FormData) {
    "use server";
    await createManualInvoiceAction(formData);
    redirect("/work/invoices");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="New Invoice" description="Bill a customer directly. Invoices from completed custom-work jobs are created from the Jobs page instead." />
      {customers.length === 0 ? (
        <div className="card p-8 text-center text-charcoal/55">
          Add a customer first (Work → Customers) before creating an invoice.
        </div>
      ) : (
        <form action={action} className="card p-6 space-y-4">
          <Field label="Customer">
            <select name="customerId" className="input" required>
              <option value="" disabled selected>Select a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Due Date">
            <input type="date" name="dueDate" className="input" />
          </Field>

          <div className="border-t border-[--border-color] pt-4">
            <div className="text-sm font-medium text-charcoal/70 mb-2">Line Items</div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[1fr,80px,100px] gap-2 mb-2">
                <input name="lineDescription" placeholder="Description" className="input" />
                <input name="lineQuantity" type="number" step="0.01" placeholder="Qty" defaultValue={i === 0 ? "1" : ""} className="input" />
                <input name="lineRate" type="number" step="0.01" placeholder="Rate $" className="input" />
              </div>
            ))}
            <p className="text-xs text-charcoal/45">Leave a row&apos;s description blank to skip it. Amount = Qty × Rate.</p>
          </div>

          <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light">
            Create Invoice
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>{children}</label>;
}
