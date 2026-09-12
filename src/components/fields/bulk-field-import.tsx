"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFieldsForImportAction } from "@/lib/actions";

type DraftRow = { key: string; name: string; acres: string; include: boolean };

const PLACEHOLDER = `Field\tArea (ac)
1\t0.145
1\t72.92
Camp\t14.52
East\t121.2
East\t79.17
Total\t2770`;

/**
 * Turns pasted Field/Area rows (straight out of an AgFiniti/FieldView/AFS
 * Connect boundary report — tab or multi-space separated, one field per
 * line) into new Field records. Repeated names are common on these
 * reports (several physical parcels all called "East" or "North") — this
 * numbers them "East-1", "East-2", etc. rather than silently merging or
 * overwriting, so every parcel still gets its own record. Grouping is
 * case-insensitive ("east" and "East" count as the same base name) since
 * that's the usual source of the repeat, not two different fields.
 */
function parseRows(text: string): DraftRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: { name: string; acres: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/\t+|  +/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const [name, acresRaw] = parts;
    if (/^field$/i.test(name) || /^total$/i.test(name)) continue; // header / total row
    const acres = acresRaw.replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(acres)) continue;
    parsed.push({ name, acres });
  }

  // Group by case-insensitive name so "east" and "East" share one counter.
  const seenCount = new Map<string, number>();
  const totalPerGroup = new Map<string, number>();
  for (const p of parsed) {
    const key = p.name.toLowerCase();
    totalPerGroup.set(key, (totalPerGroup.get(key) ?? 0) + 1);
  }
  return parsed.map((p, i) => {
    const key = p.name.toLowerCase();
    const groupSize = totalPerGroup.get(key) ?? 1;
    let finalName = p.name;
    if (groupSize > 1) {
      const n = (seenCount.get(key) ?? 0) + 1;
      seenCount.set(key, n);
      finalName = `${p.name}-${n}`;
    }
    return { key: `${i}-${p.name}`, name: finalName, acres: p.acres, include: true };
  });
}

export function BulkFieldImport({ existingFieldNames }: { existingFieldNames: string[] }) {
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const existingLower = useMemo(() => new Set(existingFieldNames.map((n) => n.toLowerCase())), [existingFieldNames]);

  function preview() {
    setError(null);
    const parsed = parseRows(pasted);
    if (parsed.length === 0) {
      setError("Couldn't find any Field / Area rows in that text — paste it straight from the report, one field per line.");
      return;
    }
    setRows(parsed);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  function commit() {
    if (!rows) return;
    const toCreate = rows.filter((r) => r.include && r.name.trim());
    if (toCreate.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const created = await createFieldsForImportAction(toCreate.map((r) => ({ name: r.name.trim(), acres: Number(r.acres) || 0 })));
        setResult({ count: created.length });
        setRows(null);
        setPasted("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong creating these fields.");
      }
    });
  }

  const includedCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div className="card p-6 space-y-4">
      <div>
        <div className="text-sm font-semibold text-forest">Bulk Add Fields</div>
        <p className="text-xs text-charcoal/50 mt-1">
          Paste the Field / Area table straight from your AgFiniti, FieldView, or AFS Connect boundary report. Repeated
          names (several fields all called &quot;East&quot; or &quot;North&quot;) get numbered automatically — East-1, East-2, and so on —
          so every parcel still gets its own record. Nothing is created until you review the list below and confirm.
        </p>
      </div>

      {!rows && (
        <>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={10}
            className="input font-mono text-sm"
          />
          {error && <p className="text-sm text-status-red">{error}</p>}
          <button
            type="button" onClick={preview} disabled={!pasted.trim()}
            className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light disabled:opacity-40"
          >
            Preview
          </button>
        </>
      )}

      {rows && (
        <>
          <div className="max-h-96 overflow-y-auto border border-[--border-color] rounded-lg">
            <table className="data-table">
              <thead>
                <tr><th></th><th>Field Name</th><th className="text-right">Acres</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const collides = existingLower.has(r.name.trim().toLowerCase());
                  return (
                    <tr key={r.key} className={!r.include ? "opacity-40" : ""}>
                      <td><input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.key, { include: e.target.checked })} /></td>
                      <td>
                        <input
                          className="border rounded px-1.5 py-1 bg-white text-sm w-full"
                          value={r.name}
                          onChange={(e) => updateRow(r.key, { name: e.target.value })}
                        />
                        {collides && <div className="text-xs text-status-amber mt-0.5">A field named this already exists</div>}
                      </td>
                      <td className="text-right">
                        <input
                          type="number" step="0.01"
                          className="border rounded px-1.5 py-1 bg-white text-sm w-24 text-right"
                          value={r.acres}
                          onChange={(e) => updateRow(r.key, { acres: e.target.value })}
                      />
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && <p className="text-sm text-status-red">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button" onClick={commit} disabled={isPending || includedCount === 0}
              className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light disabled:opacity-40"
            >
              {isPending ? "Adding…" : `Add ${includedCount} Field${includedCount === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={() => setRows(null)} disabled={isPending} className="text-sm text-charcoal/60 hover:underline">
              Back to paste
            </button>
          </div>
        </>
      )}

      {result && (
        <p className="text-sm text-status-green">
          Added {result.count} field{result.count === 1 ? "" : "s"}. New fields default to Owned with no crop/county
          info — click into any of them from the Fields page to fill in the rest.
        </p>
      )}
    </div>
  );
}
