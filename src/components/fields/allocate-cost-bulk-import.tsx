"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseAllocateCostFileAction,
  allocateCostRowAction,
  finishBulkAllocateCostAction,
  type BulkImportRowResult,
} from "@/lib/actions";

/**
 * Bulk Allocate Product Cost from an Excel file.
 *
 * The file is read on the server, then each product is allocated in its own
 * request, one after another. A single request for the whole file ran past
 * the hosting function's time limit and failed with "An unexpected response
 * was received from the server". One product per request keeps every call
 * short, shows progress, and a failure on one row doesn't lose the rest.
 * Rows run in order, not in parallel, so two products from the same vendor
 * can't both try to create that vendor at once.
 */
export function AllocateCostBulkImport({ title, description, templateUrl }: {
  title: string;
  description?: string;
  templateUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setResults(null);
    setBusy(true);
    try {
      const parsed = await parseAllocateCostFileAction(formData);
      if (parsed.error) { setError(parsed.error); return; }
      if (parsed.rows.length === 0) { setError("No rows found in that file."); return; }

      const out: BulkImportRowResult[] = [];
      setProgress({ done: 0, total: parsed.rows.length });
      for (let i = 0; i < parsed.rows.length; i++) {
        const r = parsed.rows[i];
        setProgress({ done: i, total: parsed.rows.length, current: r.productName });
        try {
          out.push(await allocateCostRowAction(r));
        } catch (e) {
          out.push({ row: r.row, ok: false, message: `${r.productName ?? "Row"}: ${e instanceof Error ? e.message : "Request failed."} Try this one again.` });
        }
        setResults([...out]);
      }
      setProgress({ done: parsed.rows.length, total: parsed.rows.length });
      await finishBulkAllocateCostAction().catch(() => {});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const imported = results?.filter((r) => r.ok).length ?? 0;
  const failed = (results?.length ?? 0) - imported;

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-forest mb-1">{title}</div>
      {description && <p className="text-xs text-charcoal/55 mb-3">{description}</p>}
      <a href={templateUrl} className="text-sm text-forest underline inline-block mb-3">Download Excel template</a>
      <form action={onSubmit} className="space-y-3">
        <input type="file" name="file" accept=".xlsx,.xls" required className="input" disabled={busy} />
        <button type="submit" disabled={busy} className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {busy ? "Importing…" : "Upload & Import"}
        </button>
      </form>
      {busy && progress && progress.done < progress.total && (
        <div className="mt-3 text-sm text-charcoal/70">
          Allocating {progress.done + 1} of {progress.total}{progress.current ? ` — ${progress.current}` : ""}… keep this page open.
          <div className="mt-2 h-1.5 rounded bg-charcoal/10 overflow-hidden">
            <div className="h-full bg-forest transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <div className="mt-3 text-sm text-status-red">{error}</div>}
      {results && results.length > 0 && (
        <div className="mt-4 border-t border-[--border-color] pt-3">
          <div className="text-sm font-medium mb-2">
            {imported} of {progress?.total ?? results.length} row{(progress?.total ?? results.length) === 1 ? "" : "s"} allocated
            {failed > 0 && <span className="text-status-red"> · {failed} need attention</span>}
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {results.map((r, i) => (
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
