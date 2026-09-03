import Link from "next/link";
import { PageHeader } from "@/components/ui/stat-card";
import { Tractor, Beef, Truck, Boxes, FileStack, Settings } from "lucide-react";

const TILES = [
  { href: "/more/equipment", label: "Equipment", desc: "Machinery, repairs, usage", icon: Tractor },
  { href: "/more/livestock", label: "Livestock", desc: "Herds, groups, sales & losses", icon: Beef },
  { href: "/more/vehicles", label: "Vehicles & Mileage", desc: "Trucks, mileage log", icon: Truck },
  { href: "/more/inventory", label: "Inventory", desc: "Chemical, fertilizer, seed, fuel", icon: Boxes },
  { href: "/more/documents", label: "Documents", desc: "Central searchable file library", icon: FileStack },
  { href: "/more/settings", label: "Settings", desc: "Farm, team, categories, integrations", icon: Settings },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" description="Equipment, livestock, vehicles, inventory, documents and settings." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link prefetch={false} key={t.href} href={t.href} className="card p-5 hover:border-forest transition-colors">
            <t.icon className="text-forest mb-2" size={22} />
            <div className="font-semibold text-forest">{t.label}</div>
            <div className="text-sm text-charcoal/55 mt-1">{t.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
