"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Landmark, Sprout, Briefcase, MoreHorizontal, Plus, FileSpreadsheet,
  Users, Search, LogOut, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import GlobalAddMenu from "./global-add-menu";
import { signOutAction, switchFarmAction } from "@/lib/auth-actions";

const PRIMARY_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/money", label: "Money", icon: Landmark },
  { href: "/fields", label: "Fields", icon: Sprout },
  { href: "/work", label: "Work", icon: Briefcase },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

const SECONDARY_NAV = [
  { href: "/tax", label: "Tax Center", icon: FileSpreadsheet },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/cpa", label: "CPA Portal", icon: Users },
];

interface SidebarProps {
  farmName?: string;
  taxYear?: number;
  authenticated?: boolean;
  farms?: { id: string; name: string }[];
  activeFarmId?: string;
}

export function Sidebar({ farmName = "Mohler Farms", taxYear = 2026, authenticated = false, farms = [], activeFarmId }: SidebarProps) {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <>
      {/* Desktop / web sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-forest text-cream min-h-screen sticky top-0">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-lg font-semibold tracking-tight">FarmLedger</div>
          <div className="text-xs text-sage-light/80 mt-0.5">Farm all year. Be ready at tax time.</div>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-lg bg-wheat text-forest font-semibold py-2.5 hover:bg-wheat-light transition-colors"
        >
          <Plus size={18} /> Add
        </button>

        <nav className="flex-1 px-3 mt-6 space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-forest-light text-white" : "text-sage-light/90 hover:bg-forest-light/60"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-white/10 space-y-0.5">
            {SECONDARY_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-forest-light text-white" : "text-sage-light/80 hover:bg-forest-light/60"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          {authenticated && farms.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-sage-light/80 hover:text-white bg-forest-light/40 rounded-md px-2 py-1.5"
              >
                <span className="truncate">{farmName}</span>
                <ChevronDown size={12} />
              </button>
              {switcherOpen && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded-lg shadow-lg overflow-hidden text-charcoal z-10">
                  {farms.map((f) => (
                    <form action={switchFarmAction} key={f.id}>
                      <input type="hidden" name="farmId" value={f.id} />
                      <button
                        type="submit"
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-cream ${f.id === activeFarmId ? "font-semibold text-forest" : ""}`}
                      >
                        {f.name}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link href="/more/settings" className="text-xs text-sage-light/70 hover:text-white block">
            {farmName} · {taxYear} · Settings
          </Link>
          {authenticated && (
            <form action={signOutAction}>
              <button type="submit" className="flex items-center gap-1.5 text-xs text-sage-light/70 hover:text-white">
                <LogOut size={12} /> Sign out
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-forest text-cream border-t border-white/10 flex items-stretch">
        {PRIMARY_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-wheat" : "text-sage-light/80"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile floating add button */}
      <button
        onClick={() => setAddOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-wheat text-forest shadow-lg flex items-center justify-center"
        aria-label="Add"
      >
        <Plus size={26} />
      </button>

      {addOpen && <GlobalAddMenu onClose={() => setAddOpen(false)} />}
    </>
  );
}

export function TopBar({ farmName = "Mohler Farms", taxYear = 2026 }: { farmName?: string; taxYear?: number }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-cream/95 backdrop-blur border-b border-[--border-color] px-4 md:px-8 py-3">
      <div className="flex items-center gap-2 text-sm text-charcoal/60 max-w-md w-full">
        <Search size={16} />
        <input
          placeholder="Search vendors, fields, customers, chemicals…"
          className="bg-transparent outline-none w-full placeholder:text-charcoal/40"
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="status-pill status-green">{farmName}</span>
        <span className="text-charcoal/60">{taxYear}</span>
      </div>
    </header>
  );
}
