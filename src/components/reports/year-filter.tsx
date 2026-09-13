"use client";

import { useRouter } from "next/navigation";

/**
 * A simple year `<select>` that navigates to `?year=N` on change, for
 * report pages that need to switch years without any other filter state.
 * Distinct from ExportYearPicker (which holds its choice in local state to
 * feed download links) — this one drives what the page itself renders, so
 * it has to be a real navigation.
 */
export function YearFilter({ years, selectedYear }: { years: number[]; selectedYear: number }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm mb-4">
      <span className="font-medium text-charcoal/70">Year:</span>
      <select
        value={selectedYear}
        onChange={(e) => router.push(`?year=${e.target.value}`)}
        className="card px-3 py-1.5"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </label>
  );
}
