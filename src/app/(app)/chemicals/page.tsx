import Link from "next/link";
import { listChemicals, listTankMixes, listFields, listActivities } from "@/lib/data/repo";
import { normalizeRateUnit } from "@/lib/tank-mix";
import type { PastLoad } from "@/components/chemicals/tank-mix-calculator";
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

  // Sprays (and liquid fertilizer passes) already logged, grouped into one
  // pickable "load" per day + product mix, so a past pass can be pulled into
  // the calculator. Only built for the calculator view.
  let pastLoads: PastLoad[] = [];
  if (!showList) {
    const thisYear = new Date().getFullYear();
    const [sprayNow, sprayPrev, fertNow, fertPrev] = await Promise.all([
      listActivities({ activityType: "spray", year: thisYear }),
      listActivities({ activityType: "spray", year: thisYear - 1 }),
      listActivities({ activityType: "fertilize", year: thisYear }),
      listActivities({ activityType: "fertilize", year: thisYear - 1 }),
    ]);
    const groups = new Map<string, PastLoad>();
    for (const a of [...sprayNow, ...sprayPrev, ...fertNow, ...fertPrev]) {
      const lines = a.activityType === "spray" ? a.sprayProducts ?? [] : a.fertilizerProducts ?? [];
      if (lines.length === 0) continue;
      const names = lines.map((l) => l.productName.trim()).sort((x, y) => x.localeCompare(y));
      const key = `${a.activityDate}|${a.activityType}|${names.join("+").toLowerCase()}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key, date: a.activityDate, type: a.activityType === "spray" ? "Spray" : "Fertilizer",
          label: names.join(" / "), fieldIds: [], fieldNames: [], acres: 0,
          products: lines.map((l) => ({
            name: l.productName.trim(), rate: l.rate, unit: normalizeRateUnit(l.rateUnit), rawUnit: l.rateUnit,
          })),
        };
        groups.set(key, g);
      }
      g.acres += a.acres ?? 0;
      if (a.fieldId && !g.fieldIds.includes(a.fieldId)) {
        g.fieldIds.push(a.fieldId);
        g.fieldNames.push(a.fieldName ?? "Field");
      } else if (!a.fieldId && a.customerFieldName && !g.fieldNames.includes(`${a.customerFieldName} (custom)`)) {
        g.fieldNames.push(`${a.customerFieldName} (custom)`);
      }
    }
    pastLoads = [...groups.values()]
      .map((g) => ({ ...g, acres: Math.round(g.acres * 100) / 100 }))
      .sort((x, y) => y.date.localeCompare(x.date) || x.label.localeCompare(y.label))
      .slice(0, 300);
  }
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
          pastLoads={pastLoads}
          fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres }))}
          needsMigration={false}
        />
      )}
    </div>
  );
}
