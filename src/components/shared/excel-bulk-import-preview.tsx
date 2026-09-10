"use client";

import { Fragment, useState, useTransition } from "react";
import type { BulkImportSummary, BulkImportPreview, BulkImportDraftRow } from "@/lib/actions";

/**
 * Same idea as ExcelBulkImport, but with a review step in between: upload
 * parses the file and shows every row in an editable table (fix a date,
 * retype a vendor, switch a category, uncheck a row) before anything is
 * actually written. Only the income/expense import uses this — allocate-cost
 * (a different shape entirely, no natural per-row preview) stays on the
 * plain upload-and-go ExcelBulkImport.
 */
export function ExcelBulkImportPreview({
  title, description, templateUrl, previewAction, commitAction,
}: {
  title: string;
  description?: string;
  templateUrl: string;
  previewAction: (formData: FormData) => Promise<BulkImportPreview>;
  commitAction: (rows: BulkImportDraftRow[]) => Promise<BulkImportSummary>;
}) {
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onUpload(formData: FormData) {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const result = await previewAction(formData);
        if (result.fileError) {
          setError(result.fileError);
          return;
        }
        setPreview(result);
      } catch (e: any) {
        setError(e?.message ?? "Couldn't read that file.");
      }
    });
  }

  function updateRow(idx: number, patch: Partial<BulkImportDraftRow>) {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.slice();
      rows[idx] = { ...rows[idx], ...patch };
      return { ...prev, rows };
    });
  }

  function confirmImport() {
    if (!preview) return;
    startTransition(async () => {
      const result = await commitAction(preview.rows);
      setSummary(result);
      setPreview(null);
    });
  }

  function cancelPreview() {
    setPreview(null);
  }

  function startOver() {
    setSummary(null);
    setError(null);
  }

  const includedCount = preview?.rows.filter((r) => r.include).length ?? 0;

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">{title}</div>
      {description && <p className="text-xs text-charcoal/55 mb-3">{description}</p>}

      {!preview && !summary && (
        <>
          <a href={templateUrl} className="text-sm text-forest underline inline-block mb-3">Download Excel template</a>
          <form action={onUpload} className="space-y-3">
            <input type="file" name="file" accept=".xlsx,.xls" required className="input" disabled={isPending} />
            <button type="submit" disabled={isPending} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {isPending ? "Reading file…" : "Upload & Review"}
            </button>
          </form>
          {error && <div className="mt-3 text-sm text-status-red">{error}</div>}
        </>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="text-sm text-charcoal/70">
            {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} found — uncheck a row to skip it (rows missing a Date/Amount or that looked like duplicates start unchecked). Fix a category, date, vendor, or amount right here before anything is imported.
          </div>
          <div className="max-h-[28rem] overflow-y-auto border border-[--border-color] rounded-lg">
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th></th><th>Row</th><th>Date</th>
                  {preview.transactionType === "expense" && <th>Vendor</th>}
                  <th>Description</th><th>Category</th><th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, idx) => (
                  <Fragment key={idx}>
                    <tr className={!r.include ? "opacity-50" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => updateRow(idx, { include: e.target.checked })}
                        />
                      </td>
                      <td className="whitespace-nowrap text-xs text-charcoal/50">{r.row}</td>
                      <td>
                        <input
                          type="date"
                          className="border rounded px-1.5 py-1 bg-white text-sm w-[9.5rem]"
                          value={r.transactionDate ?? ""}
                          onChange={(e) => updateRow(idx, { transactionDate: e.target.value || undefined })}
                        />
                      </td>
                      {preview.transactionType === "expense" && (
                        <td>
                          <input
                            type="text"
                            className="border rounded px-1.5 py-1 bg-white text-sm w-32"
                            value={r.vendorName ?? ""}
                            onChange={(e) => updateRow(idx, { vendorName: e.target.value || undefined })}
                          />
                        </td>
                      )}
                      <td>
                        <input
                          type="text"
                          className="border rounded px-1.5 py-1 bg-white text-sm w-40"
                          value={r.description ?? ""}
                          onChange={(e) => updateRow(idx, { description: e.target.value || undefined })}
                        />
                      </td>
                      <td>
                        <select
                          className="border rounded px-1.5 py-1 bg-white text-sm max-w-[160px]"
                          value={r.farmCategoryId ?? ""}
                          onChange={(e) => updateRow(idx, { farmCategoryId: e.target.value || undefined })}
                        >
                          <option value="">Uncategorized</option>
                          {preview.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="border rounded px-1.5 py-1 bg-white text-sm w-24 text-right"
                          value={r.amount ?? ""}
                          onChange={(e) => updateRow(idx, { amount: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </td>
                    </tr>
                    {r.warning && (
                      <tr>
                        <td colSpan={preview.transactionType === "expense" ? 7 : 6} className="text-xs text-status-amber pt-0 pb-2">
                          Row {r.row}: {r.warning}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={confirmImport}
              disabled={isPending || includedCount === 0}
              className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Importing…" : `Import ${includedCount} row${includedCount === 1 ? "" : "s"}`}
            </button>
            <button onClick={cancelPreview} disabled={isPending} className="text-sm text-charcoal/60 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div>
          <div className="text-sm font-medium mb-2">
            {summary.imported} of {summary.total} row{summary.total === 1 ? "" : "s"} imported
            {summary.failed > 0 && <span className="text-status-red"> · {summary.failed} failed</span>}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1 mb-3">
            {summary.results.map((r, i) => (
              <div key={i} className={`text-xs ${r.ok ? "text-charcoal/60" : "text-status-red"}`}>
                Row {r.row}: {r.message}
              </div>
            ))}
          </div>
          <button onClick={startOver} className="text-sm text-forest underline">Import another file</button>
        </div>
      )}
    </div>
  );
}
