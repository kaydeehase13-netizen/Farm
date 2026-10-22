"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home, Landmark, Sprout, Briefcase, MoreHorizontal, Plus, FileSpreadsheet,
  Users, Search, LogOut, ChevronDown, FlaskConical, Beef, LineChart, Menu, X, BarChart3,
} from "lucide-react";
import { useState } from "react";
import GlobalAddMenu from "./global-add-menu";
import { signOutAction, switchFarmAction } from "@/lib/auth-actions";
import { setViewTaxYearAction } from "@/lib/actions";

const PRIMARY_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/money", label: "Money", icon: Landmark },
  { href: "/fields", label: "Fields", icon: Sprout },
  { href: "/chemicals", label: "Chemicals", icon: FlaskConical },
  { href: "/cattle", label: "Cattle", icon: Beef },
  { href: "/markets", label: "Grain Prices", icon: LineChart },
  { href: "/work", label: "Work", icon: Briefcase },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

/** Phone bottom bar: the few you use most, plus Menu for everything else. */
const MOBILE_BAR = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/money", label: "Money", icon: Landmark },
  { href: "/fields", label: "Fields", icon: Sprout },
  { href: "/reports", label: "Reports", icon: BarChart3 },
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop / web sidebar */}
      <aside data-app-chrome className="hidden md:flex md:flex-col w-64 shrink-0 bg-forest text-cream min-h-screen sticky top-0">
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
                prefetch={false}
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
                  prefetch={false}
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
                  <Link
                    href="/more/add-farm"
                    prefetch={false}
                    className="block w-full text-left px-3 py-2 text-xs text-forest font-medium hover:bg-cream border-t border-[--border-color]"
                  >
                    + Add Another Farm
                  </Link>
                </div>
              )}
            </div>
          )}
          <Link href="/more/settings" prefetch={false} className="text-xs text-sage-light/70 hover:text-white block">
            {farmName} · {taxYear} · Settings
          </Link>
          {authenticated && farms.length <= 1 && (
            <Link href="/more/add-farm" prefetch={false} className="text-xs text-sage-light/70 hover:text-white block">
              + Add Another Farm
            </Link>
          )}
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
      <nav data-app-chrome className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-forest text-cream border-t border-white/10 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {MOBILE_BAR.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setMenuOpen(false)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${
                active && !menuOpen ? "text-wheat" : "text-sage-light/80"
              }`}
            >
              <Icon size={19} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${menuOpen ? "text-wheat" : "text-sage-light/80"}`}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
          Menu
        </button>
      </nav>

      {/* Mobile full menu: every page, so nothing is hidden on a phone */}
      {menuOpen && (
        <div data-app-chrome className="md:hidden fixed inset-x-0 top-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-40 bg-forest text-cream overflow-y-auto">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">FarmLedger</div>
              <div className="text-xs text-sage-light/80">{farmName} · {taxYear}</div>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2 text-sage-light/80"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4">
            {[...PRIMARY_NAV.filter((i) => i.href !== "/more"), ...SECONDARY_NAV, { href: "/more", label: "More", icon: MoreHorizontal }].map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl py-4 text-xs font-medium ${active ? "bg-white/15 text-wheat" : "bg-white/5 text-cream"}`}
                >
                  <Icon size={22} />
                  {item.label}
                </Link>
              );
            })}
          </div>
          {farms.length > 1 && (
            <div className="px-5 mt-5">
              <div className="text-xs text-sage-light/70 mb-1">Switch farm</div>
              {farms.map((f) => (
                <form key={f.id} action={switchFarmAction}>
                  <input type="hidden" name="farmId" value={f.id} />
                  <button type="submit" className={`block w-full text-left py-2 text-sm ${f.id === activeFarmId ? "text-wheat" : "text-cream"}`}>{f.name}</button>
                </form>
              ))}
            </div>
          )}
          {authenticated && (
            <form action={signOutAction} className="px-5 mt-5 pb-6">
              <button type="submit" className="flex items-center gap-1.5 text-sm text-sage-light/80"><LogOut size={14} /> Sign out</button>
            </form>
          )}
        </div>
      )}

      {/* Mobile floating add button */}
      <button
        onClick={() => setAddOpen(true)}
        data-app-chrome
        className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4 z-40 w-12 h-12 rounded-full bg-wheat text-forest shadow-lg flex items-center justify-center"
        aria-label="Add"
      >
        <Plus size={24} />
      </button>

      {addOpen && <GlobalAddMenu onClose={() => setAddOpen(false)} />}
    </>
  );
}

export function TopBar({ farmName = "Mohler Farms", taxYear = 2026, years = [] }: { farmName?: string; taxYear?: number; years?: number[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const returnTo = qs ? `${pathname}?${qs}` : pathname;
  const options = years.includes(taxYear) ? years : [...years, taxYear].sort((a, b) => b - a);

  return (
    <header data-app-chrome className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-cream/95 backdrop-blur border-b border-[--border-color] px-4 md:px-8 py-3">
      <div className="flex items-center gap-2 text-sm text-charcoal/60 max-w-md w-full">
        <Search size={16} />
        <input
          placeholder="Search vendors, fields, customers, chemicals…"
          className="bg-transparent outline-none w-full placeholder:text-charcoal/40"
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="status-pill status-green">{farmName}</span>
        <form action={setViewTaxYearAction}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <select
            name="year"
            defaultValue={taxYear}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="bg-transparent text-charcoal/70 text-sm font-medium border border-[--border-color] rounded-md px-2 py-1 cursor-pointer"
            title="Viewing tax year"
          >
            {options.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </form>
      </div>
    </header>
  );
}
