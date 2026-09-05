"use client";

import { useState } from "react";

/**
 * Every Quick Export / Full Workbook link used to silently download whatever
 * "farm.currentTaxYear" was set to — not necessarily the year you were
 * looking at on screen. That's why exporting while viewing 2025 could
 * hand back a 2026 file with no explanation. This lets you pick the export
 * year explicitly, right where you're downloading from, independent of
 * whatever year the rest of the app happens to be viewing.
 */
export function ExportYearPicker({
  years, defaultYear, children,
}: {
  years: number[];
  defaultYear: number;
  children: (taxYear: number) => React.ReactNode;
}) {
  const [taxYear, setTaxYear] = useState(defaultYear);
  return (
    <div>
      <label className="flex items-center gap-2 text-sm mb-4">
        <span className="font-medium text-charcoal/70">Export year:</span>
        <select
          value={taxYear}
          onChange={(e) => setTaxYear(Number(e.target.value))}
          className="card px-3 py-1.5"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      {children(taxYear)}
    </div>
  );
}
