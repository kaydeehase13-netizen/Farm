import Link from "next/link";
import { listDocuments } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";

const CATEGORIES = ["receipt", "invoice", "tax", "equipment", "land", "insurance", "usda_fsa", "chemical_label", "sds", "income", "loan", "contract", "livestock", "other"];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const docs = await listDocuments(params.category);
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Central searchable file library."
        action={<Link prefetch={false} href="/more/documents/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Upload Document</Link>}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Link prefetch={false} href="/more/documents" className={`status-pill ${!params.category ? "status-blue" : "bg-cream-deep text-charcoal/60"}`}>All</Link>
        {CATEGORIES.map((c) => (
          <Link prefetch={false} key={c} href={`/more/documents?category=${c}`} className={`status-pill ${params.category === c ? "status-blue" : "bg-cream-deep text-charcoal/60"}`}>
            {c.replace("_", " ")}
          </Link>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="text-xs text-charcoal/50 capitalize">{d.category.replace("_", " ")}</div>
            <div className="font-medium mt-1 truncate">{d.fileName}</div>
            <div className="text-xs text-charcoal/40 mt-1">{d.tags.join(", ")}</div>
          </div>
        ))}
        {docs.length === 0 && <div className="text-charcoal/50">No documents in this category yet.</div>}
      </div>
    </div>
  );
}
