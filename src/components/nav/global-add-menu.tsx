"use client";

import Link from "next/link";
import { X } from "lucide-react";

const GROUPS: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: "MONEY",
    items: [
      { label: "Scan Receipt", href: "/money/receipts/new" },
      { label: "Expense", href: "/money/transactions/new?type=expense" },
      { label: "Income", href: "/money/transactions/new?type=income" },
    ],
  },
  {
    title: "FIELD",
    items: [
      { label: "Plant", href: "/fields/activities/new?type=plant" },
      { label: "Spray", href: "/fields/activities/new?type=spray" },
      { label: "Fertilize", href: "/fields/activities/new?type=fertilize" },
      { label: "Harvest", href: "/fields/activities/new?type=harvest" },
      { label: "Other Field Work", href: "/fields/activities/new?type=other" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { label: "Custom Job", href: "/work/jobs/new" },
      { label: "Create Invoice", href: "/work/invoices/new" },
      { label: "Record Payment", href: "/work/payments/new" },
    ],
  },
  {
    title: "FARM",
    items: [
      { label: "Equipment Repair", href: "/more/equipment/repairs/new" },
      { label: "Livestock", href: "/more/livestock/new" },
      { label: "Mileage", href: "/more/vehicles/mileage/new" },
      { label: "Document", href: "/more/documents/new" },
      { label: "Inventory Adjustment", href: "/more/inventory/adjust" },
    ],
  },
  {
    title: "OTHER",
    items: [{ label: "Other Activity", href: "/fields/activities/new?type=other" }],
  },
];

export default function GlobalAddMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-charcoal/40" onClick={onClose}>
      <div
        className="bg-cream w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-cream flex items-center justify-between px-5 py-4 border-b border-[--border-color]">
          <div>
            <div className="text-xs font-semibold tracking-wide text-forest">WHAT HAPPENED?</div>
            <div className="text-sm text-charcoal/60">Tell us — we&apos;ll organize the rest.</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-cream-deep" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[11px] font-semibold tracking-wider text-charcoal/45 mb-2">{group.title}</div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className="card px-3 py-3 text-sm font-medium hover:border-forest hover:text-forest transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
