import Link from "next/link";
import { listFields, listGrowers, listTransactions, listActivities } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { getViewTaxYear } from "@/lib/tax-year";
import { growerBilling } from "@/lib/grower-billing";
import { UNASSIGNED } from "@/lib/growers";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 });

export default async function GrowerBillingPage() {
  const year = await getViewTaxYear();
  const [fields, { growers, rates, needsMigration }, transactions, activities] = await Promise.all([
    listFields(), listGrowers(), listTransactions({ taxYear: year, type: "expense" }), listActivities({ year }),
  ]);
  const bills = growerBilling({ fields, growers, rates, transactions, activities });

  return (
    <div>
      <PageHeader
        title={`Grower Billing — ${year}`}
        description="Product split to each grower's fields at your cost (+ their markup), and work at your per-acre rates. Change the year at the top of the page."
        action={
          <div className="flex flex-wrap gap-2">
            <Link prefetch={false} href="/fields/growers" className="card px-4 py-2 text-sm font-medium hover:border-forest">Growers & rates</Link>
            <a href={`/api/export/grower-billing?year=${year}`} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium">Download Excel</a>
          </div>
        }
      />
      {needsMigration && (
        <div className="mb-4 text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          One database step is needed first: in Supabase, open <b>SQL Editor</b> and run <code>supabase/migrations/0037_growers.sql</code>.
        </div>
      )}
      <p className="text-xs text-charcoal/55 mb-4">
        Product comes from Allocate Product Cost (each product&apos;s bill split by how much each field used), so a product only shows here
        once it&apos;s allocated for {year}. Work = acres of every logged pass × your rate for that job.
      </p>
      <div className="space-y-5">
        {bills.map((b) => (
          <div key={b.grower} className="card p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-base font-semibold text-forest">{b.grower}</div>
                <div className="text-xs text-charcoal/55">
                  {b.fields.length} field{b.fields.length === 1 ? "" : "s"} · {qty(b.fields.reduce((s, f) => s + f.acres, 0))} ac
                  {b.ownFarm ? " · your farm (cost only, not billed)" : b.grower === UNASSIGNED ? " · set a grower on these fields" : b.markupPct ? ` · ${b.markupPct}% markup on product` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold">{money(b.total)}</div>
                <div className="text-xs text-charcoal/55">{b.ownFarm ? "your cost" : "to bill"}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">Product</div>
                <table className="w-full text-sm">
                  <tbody>
                    {b.products.map((p) => (
                      <tr key={p.productName + p.unit} className="border-t border-charcoal/10">
                        <td className="py-1 pr-2">{p.productName}</td>
                        <td className="py-1 text-right text-xs text-charcoal/55 whitespace-nowrap">{p.quantity ? `${qty(p.quantity)} ${p.unit}` : ""}</td>
                        <td className="py-1 text-right whitespace-nowrap">{money(p.cost)}</td>
                      </tr>
                    ))}
                    {b.products.length === 0 && <tr><td className="py-1 text-xs text-charcoal/50">No product allocated to these fields yet.</td></tr>}
                    <tr className="border-t border-charcoal/20"><td className="py-1 font-medium" colSpan={2}>Product at cost</td><td className="py-1 text-right font-medium">{money(b.productCost)}</td></tr>
                    {b.markup > 0 && <tr><td className="py-1" colSpan={2}>Markup {b.markupPct}%</td><td className="py-1 text-right">{money(b.markup)}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Work</div>
                <table className="w-full text-sm">
                  <tbody>
                    {b.work.map((w) => (
                      <tr key={w.type} className="border-t border-charcoal/10">
                        <td className="py-1 pr-2">{w.label}<span className="text-xs text-charcoal/50"> · {w.passes} pass{w.passes === 1 ? "" : "es"}</span></td>
                        <td className="py-1 text-right text-xs text-charcoal/55 whitespace-nowrap">{qty(w.acres)} ac{w.rate ? ` × ${money(w.rate)}` : ""}</td>
                        <td className="py-1 text-right whitespace-nowrap">{w.rate ? money(w.amount) : "—"}</td>
                      </tr>
                    ))}
                    {b.work.length === 0 && <tr><td className="py-1 text-xs text-charcoal/50">No passes logged.</td></tr>}
                    <tr className="border-t border-charcoal/20"><td className="py-1 font-medium" colSpan={2}>Work</td><td className="py-1 text-right font-medium">{money(b.workTotal)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-forest">By field</summary>
              <table className="w-full text-sm mt-2">
                <thead><tr className="text-xs text-charcoal/50 text-right"><th className="text-left font-normal py-1">Field</th><th className="font-normal">Acres</th><th className="font-normal">Product</th><th className="font-normal">Work</th></tr></thead>
                <tbody className="text-right">
                  {b.fields.map((f) => (
                    <tr key={f.fieldId} className="border-t border-charcoal/10">
                      <td className="text-left py-1">{f.fieldName}<div className="text-[11px] text-charcoal/45">{f.products.map((p) => p.productName).join(", ")}</div></td>
                      <td>{qty(f.acres)}</td><td>{money(f.productCost)}</td><td>{b.ownFarm ? "—" : money(f.workTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        ))}
        {bills.length === 0 && <div className="card p-5 text-sm text-charcoal/55">Nothing for {year} yet.</div>}
      </div>
    </div>
  );
}
