import { listCustomers, listCustomerFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createJobAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function NewJobPage() {
  const [customers, customerFields] = await Promise.all([listCustomers(), listCustomerFields()]);

  async function action(formData: FormData) {
    "use server";
    await createJobAction(formData);
    redirect("/work/jobs");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Custom Job" description="Whose field, what service, who supplied the product?" />
      <form action={action} className="card p-6 space-y-4">
        <Field label="Customer">
          <select name="customerId" className="input" required>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Customer Field">
          <select name="customerFieldId" className="input">
            <option value="">— None —</option>
            {customerFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Service">
          <select name="jobService" className="input">
            {["Spraying", "Fertilizer Application", "Planting", "Harvest", "Baling", "Swathing", "Tillage", "Trucking", "Manure Application", "Conservation Work", "Equipment Rental", "Other"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Who supplied the product?">
          <select name="productSource" className="input">
            <option value="our_business">Our Business</option>
            <option value="customer_supplied">Customer</option>
          </select>
        </Field>
        <Field label="Scheduled Date">
          <input type="date" name="scheduledDate" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </Field>
        <Field label="Acres">
          <input type="number" step="0.1" name="acres" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate">
            <input type="number" step="0.01" name="rate" className="input" />
          </Field>
          <Field label="Rate Unit">
            <select name="rateUnit" className="input">
              <option value="per_acre">Per Acre</option>
              <option value="flat">Flat</option>
              <option value="per_hour">Per Hour</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Revenue">
            <input type="number" step="0.01" name="revenue" className="input" placeholder="Total billed" />
          </Field>
          <Field label="Direct Cost">
            <input type="number" step="0.01" name="directCost" className="input" placeholder="Product/fuel cost" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea name="notes" className="input" rows={3} />
        </Field>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium hover:bg-forest-light w-full">Save Job</button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>{children}</label>;
}
