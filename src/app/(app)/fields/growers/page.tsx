import Link from "next/link";
import { listFields, listGrowers } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { GrowerSettings } from "@/components/fields/grower-settings";

export default async function GrowersPage() {
  const [fields, { growers, rates, needsMigration }] = await Promise.all([listFields(), listGrowers()]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Growers"
        description="Who each field is farmed for, how each grower is billed, and your per-acre work rates."
        action={<Link prefetch={false} href="/reports/billing" className="card px-4 py-2 text-sm font-medium hover:border-forest">Grower Billing →</Link>}
      />
      {needsMigration && (
        <div className="mb-4 text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          One database step is needed first: in Supabase, open <b>SQL Editor</b> and run <code>supabase/migrations/0037_growers.sql</code>.
        </div>
      )}
      <GrowerSettings fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres, grower: f.grower }))} growers={growers} rates={rates} />
    </div>
  );
}
