import { PageHeader } from "@/components/ui/stat-card";
import { createLoanAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default function NewLoanPage() {
  async function action(formData: FormData) {
    "use server";
    await createLoanAction(formData);
    redirect("/money/loans");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Add a Loan" description="Track an operating loan, equipment note, or real estate mortgage." />
      <form action={action} className="card p-6 space-y-4">
        <Field label="Lender">
          <input name="lenderName" required placeholder="e.g. Farm Credit Services" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Original Principal">
            <input type="number" step="0.01" name="originalPrincipal" className="input" placeholder="0" />
          </Field>
          <Field label="Current Balance">
            <input type="number" step="0.01" name="currentBalance" className="input" placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Interest Rate (%)">
            <input type="number" step="0.001" name="interestRate" className="input" placeholder="0" />
          </Field>
          <Field label="Term (months)">
            <input type="number" name="termMonths" className="input" placeholder="0" />
          </Field>
        </div>
        <Field label="Origination Date">
          <input type="date" name="originationDate" className="input" />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} className="input" placeholder="What the loan was for, collateral, etc." />
        </Field>

        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light">
          Add Loan
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>{children}</label>;
}
