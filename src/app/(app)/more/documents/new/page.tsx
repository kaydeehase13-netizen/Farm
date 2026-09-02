import { getDB } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/stat-card";
import { createDocumentAction } from "@/lib/actions";
import { redirect } from "next/navigation";

const CATEGORIES = ["receipt", "invoice", "tax", "equipment", "land", "insurance", "usda_fsa", "chemical_label", "sds", "income", "loan", "contract", "livestock", "other"];

export default function NewDocumentPage() {
  const db = getDB();
  async function action(formData: FormData) {
    "use server";
    await createDocumentAction(formData);
    redirect("/more/documents");
  }
  return (
    <div className="max-w-lg">
      <PageHeader title="Upload Document" />
      <form action={action} className="card p-6 space-y-4">
        <label className="block"><div className="text-sm font-medium mb-1">File name</div>
          <input name="fileName" className="input" placeholder="2026-crop-insurance-policy.pdf" required />
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Category</div>
          <select name="category" className="input">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Related Field (optional)</div>
          <select name="relatedFieldId" className="input">
            <option value="">— None —</option>
            {db.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="block"><div className="text-sm font-medium mb-1">Tags (comma separated)</div>
          <input name="tags" className="input" placeholder="label, Roundup" />
        </label>
        <p className="text-xs text-charcoal/45">File storage (Supabase Storage) is wired up in the production data layer — this demo records the file&apos;s metadata.</p>
        <button className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full">Save Document</button>
      </form>
    </div>
  );
}
