import Link from "next/link";
import { listAssets, listMileageTrips } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";

export default function VehiclesPage() {
  const vehicles = listAssets().filter((a) => a.assetType === "vehicle");
  const trips = listMileageTrips();
  const totalMiles = trips.reduce((s, t) => s + t.miles, 0);

  return (
    <div>
      <PageHeader
        title="Vehicles & Mileage"
        description={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} · ${totalMiles} miles logged`}
        action={<Link href="/more/vehicles/mileage/new" className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light">+ Log Mileage</Link>}
      />
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Vehicle</th><th>Purpose</th><th className="text-right">Miles</th><th>Source</th></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap">{t.tripDate}</td>
                <td>{t.vehicleName}</td>
                <td>{t.purpose}</td>
                <td className="text-right">{t.miles}</td>
                <td className="capitalize text-xs">{t.source}</td>
              </tr>
            ))}
            {trips.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-charcoal/50">No trips logged.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
