"use client";

import { useState } from "react";

type QuickExport = { title: string; scope: string; desc: string };

/**
 * Every Quick Export / Full Workbook link used to silently download whatever
 * "farm.currentTaxYear" was set to — not necessarily the year you were
 * looking at on screen. That's why exporting while viewing 2025 could
 * hand back a 2026 file with no explanation. This lets you pick the export
 * year explicitly, right where you're downloading from, independent of
 * whatever year the rest of the app happens to be viewing.
 *
 * Renders its own download links from plain data (years/quickExports) rather
 * than taking a render-prop function as children — this is a Client
 * Component instantiated from a Server Component (the Reports page), and a
 * function can't cross that server → client boundary as a prop (only plain,
 * serializable data can). Passing one in used to make this whole page fail
 * to render in production with a redacted "Server Components render" error.
 */
export function ExportYearPicker({
  years, defaultYear, quickExports,
}: {
  years: number[];
  defaultYear: number;
  quickExports: QuickExport[];
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
      <div className="flex gap-2 mb-4">
        <a href={`/api/export/cpa-workbook?type=full&taxYear=${taxYear}`} className="card px-4 py-2 text-sm font-medium hover:border-forest">Full Excel Workbook</a>
        <a href={`/api/export/field-report?taxYear=${taxYear}`} className="card px-4 py-2 text-sm font-medium hover:border-forest">Field Report</a>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickExports.map((e) => (
          <a
            key={e.scope}
            href={`/api/export/cpa-workbook?type=${e.scope}&taxYear=${taxYear}`}
            className="card p-5 hover:border-forest transition-colors block"
          >
            <div className="font-semibold text-forest">{e.title}</div>
            <p className="text-sm text-charcoal/55 mt-1">{e.desc}</p>
            <div className="mt-3 text-xs font-medium text-forest">DOWNLOAD .XLSX</div>
          </a>
        ))}
      </div>
    </div>
  );
}
