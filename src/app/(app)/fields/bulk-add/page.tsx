import Link from "next/link";
import { listFields, countActivities } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { BulkFieldImport } from "@/components/fields/bulk-field-import";
import { DeleteAllFieldsButton } from "@/components/fields/delete-all-fields-button";
import { DeleteAllActivitiesButton } from "@/components/fields/delete-all-activities-button";

export default async function BulkAddFieldsPage() {
  const fields = await listFields();
  const activityCount = await countActivities();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Bulk Add Fields"
        description="Add many fields at once from a boundary report, instead of one at a time."
      />

      <DeleteAllActivitiesButton activityCount={activityCount} />
      <DeleteAllFieldsButton fieldCount={fields.length} />

      <BulkFieldImport existingFieldNames={fields.map((f) => f.name)} />

      {fields.length > 0 && (
        <div className="card p-6">
          <div className="text-sm font-semibold text-forest mb-1">Your Current Fields ({fields.length})</div>
          <p className="text-xs text-charcoal/50 mb-3">
            Fields aren&apos;t tied to a single year, so old ones stay on record for their history even after you add
            this year&apos;s list above. If one is truly outdated and was never used for a transaction, activity, or crop
            year, open it and delete it from its own page — otherwise it&apos;s kept to protect that history.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            {fields.map((f) => (
              <Link
                prefetch={false} key={f.id} href={`/fields/${f.id}`}
                className="border border-[--border-color] rounded-full px-3 py-1 hover:border-forest"
              >
                {f.name} <span className="text-charcoal/45">· {f.acres} ac</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
