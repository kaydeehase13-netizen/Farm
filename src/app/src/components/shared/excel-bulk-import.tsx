"use client";

import { useState, useTransition } from "react";
import type { BulkImportSummary } from "@/lib/actions";

export function ExcelBulkImport({
  title, description, templateUrl, action, extraFields,
}: {
  title: string;
  description?: string;
  templateUrl: string;
  action: (formData: FormData) => Promise<BulkImportSummary>;
  /** Extra hidden/visible fields to render inside the upload form (e.g. a Year picker). */
  extraFields?: React.ReactNode;
}) {
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        setSummary(result);
      } catch (e: any) {
        setError(e?.message ?? "Import failed.");
      }
    });
  }

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">{title}</div>
      {description && <p className="text-xs text-charcoal/55 mb-3">{description}</p>}
      <a href={templateUrl} className="text-sm text-forest underline inline-block mb-3">Download Excel template</a>
      <form action={onSubmit} className="space-y-3">
        {extraFields}
        <input type="file" name="file" accept=".xlsx,.xls" required className="input" disabled={isPending} />
        <button type="submit" disabled={isPending} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {isPending ? "Importing…" : "Upload & Import"}
        </button>
      </form>
      {error && <div className="mt-3 text-sm text-status-red">{error}</div>}
      {summary && (
        <div className="mt-4 border-t border-[--border-color] pt-3">
          <div className="text-sm font-medium mb-2">
            {summary.imported} of {summary.total} row{summary.total === 1 ? "" : "s"} imported
            {summary.failed > 0 && <span className="text-status-red"> · {summary.failed} failed</span>}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {summary.results.map((r, i) => (
              <div key={i} className={`text-xs ${r.ok ? "text-charcoal/60" : "text-status-red"}`}>
                Row {r.row}: {r.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
