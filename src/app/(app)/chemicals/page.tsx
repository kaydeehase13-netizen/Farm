import Link from "next/link";
import { listChemicals, listTankMixes, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { TankMixCalculator, ChemicalLibrary } from "@/components/chemicals/tank-mix-calculator";

export default async function ChemicalsPage({ searchParams }: { searchParams: Promise<{ tab?: string; add?: string }> }) {
  const { tab, add } = await searchParams;
  const showList = tab === "list";
  const [{ chemicals, needsMigration: chemMigration }, { mixes, needsMigration: mixMigration }, fields] = await Promise.all([
    listChemicals(),
    listTankMixes(),
    listFields(),
  ]);
  const needsMigration = chemMigration || mixMigration;
  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${active ? "bg-forest text-white" : "card hover:border-forest"}`;

  return (
    <div>
      <PageHeader
        title="Chemicals"
        description="Your chemical list with EPA numbers and Restricted Use flags, and a tank mix calculator that works out every load."
        action={
          <div className="flex gap-2">
            <Link prefetch={false} href="/chemicals" className={tabClass(!showList)}>Mix Calculator</Link>
            <Link prefetch={false} href="/chemicals?tab=list" className={tabClass(showList)}>Chemical List ({chemicals.length})</Link>
          </div>
        }
      />
      {needsMigration && (
        <div className="mb-4 text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          One database step is needed before restricted-use flags, default rates and saved mixes can be stored: in Supabase,
          open <b>SQL Editor</b> and run <code>supabase/migrations/0029_tank_mix.sql</code>.
        </div>
      )}
      {showList ? (
        <ChemicalLibrary chemicals={chemicals} startAdding={add === "1"} />
      ) : (
        <TankMixCalculator
          chemicals={chemicals}
          mixes={mixes}
          fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres }))}
          needsMigration={false}
        />
      )}
    </div>
  );
}
