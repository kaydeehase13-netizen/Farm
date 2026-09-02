import { PageHeader } from "@/components/ui/stat-card";
import { ActivityImport } from "@/components/fields/activity-import";
import { listFields } from "@/lib/data/repo";

export default async function ImportActivitiesPage() {
  const fields = await listFields();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import Activities" description="Bring in planting, spraying, and yield records from your equipment app (AgFiniti, FieldView, AFS Connect, or similar) instead of typing them in one at a time." />
      {fields.length === 0 ? (
        <div className="card p-8 text-center text-charcoal/55">
          Add at least one field first so we know what to match your imported records to.
        </div>
      ) : (
        <ActivityImport fields={fields} />
      )}
    </div>
  );
}
