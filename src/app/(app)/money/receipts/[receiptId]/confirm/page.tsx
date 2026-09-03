import { notFound } from "next/navigation";
import { listReceipts, getAppData, getFarm } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { confirmReceiptAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function ConfirmReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const receipt = (await listReceipts()).find((r) => r.id === receiptId);
  if (!receipt) notFound();
  const farm = await getFarm();
  const data = await getAppData(farm.currentTaxYear);

  async function action(formData: FormData) {
    "use server";
    formData.set("receiptId", receiptId);
    await confirmReceiptAction(formData);
    redirect("/money/receipts");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Review & Confirm Receipt" description={receipt.fileName} />
      {receipt.fileDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={receipt.fileDataUrl} alt="Receipt" className="w-full max-h-80 object-contain bg-charcoal/5 rounded-xl mb-4 border border-[--border-color]" />
      )}
      {receipt.ocrLineItems && receipt.ocrLineItems.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="text-sm font-semibold mb-2">AI-detected line items</div>
          <table className="w-full text-sm">
            <tbody>
              {receipt.ocrLineItems.map((li, i) => (
                <tr key={i} className="border-b border-[--border-color] last:border-0">
                  <td className="py-1.5">{li.description}</td>
                  <td className="py-1.5 text-charcoal/50">{li.suggestedCategory}</td>
                  <td className="py-1.5 text-right">${li.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-charcoal/45 mt-2">Split transactions aren&apos;t wired up in this demo build yet — confirm the total below and split manually from the transaction later.</p>
        </div>
      )}
      <form action={action} className="card p-6 space-y-4">
        <Field label="Vendor"><input name="vendorName" defaultValue={receipt.ocrVendorGuess} className="input" /></Field>
        <Field label="Date"><input type="date" name="date" defaultValue={receipt.ocrDateGuess} className="input" /></Field>
        <Field label="Amount"><input type="number" step="0.01" name="amount" defaultValue={receipt.ocrAmountGuess} className="input" /></Field>
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
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light">Confirm & Create Expense</button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-sm font-medium text-charcoal/70 mb-1">{label}</div>{children}</label>;
}
