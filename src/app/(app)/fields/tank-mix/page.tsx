import { listChemicals, listTankMixes, listFields } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { TankMixCalculator } from "@/components/fields/tank-mix-calculator";

export default async function TankMixPage() {
  const [{ chemicals, needsMigration: chemMigration }, { mixes, needsMigration: mixMigration }, fields] = await Promise.all([
    listChemicals(),
    listTankMixes(),
    listFields(),
  ]);
  return (
    <div>
      <PageHeader
        title="Tank Mix Calculator"
        description="Pick the fields, tank size and carrier rate, add your chemicals, and get exactly what goes in every load — including a right-sized last load."
      />
      <TankMixCalculator
        chemicals={chemicals}
        mixes={mixes}
        fields={fields.map((f) => ({ id: f.id, name: f.name, acres: f.acres }))}
        needsMigration={chemMigration || mixMigration}
      />
    </div>
  );
}
