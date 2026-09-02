"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, rowsToObjects } from "@/lib/csv";
import { importActivitiesAction, createFieldsForImportAction } from "@/lib/actions";
import type { Field } from "@/types/domain";

const CREATE_NEW = "__create_new__";

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "plant", label: "Plant" }, { value: "spray", label: "Spray" },
  { value: "fertilize", label: "Fertilize" }, { value: "harvest", label: "Harvest" },
  { value: "till", label: "Till" }, { value: "disk", label: "Disk" },
  { value: "cultivate", label: "Cultivate" }, { value: "bale", label: "Bale" },
  { value: "mow", label: "Mow" }, { value: "irrigate", label: "Irrigate" },
  { value: "graze", label: "Graze" }, { value: "scout", label: "Scout" },
  { value: "soil_sample", label: "Soil Sample" }, { value: "lime", label: "Lime" },
  { value: "manure", label: "Manure" }, { value: "conservation", label: "Conservation" },
  { value: "other", label: "Other" },
];

const TYPE_SYNONYMS: Record<string, string> = {
  plant: "plant", planting: "plant", seed: "plant", seeding: "plant",
  spray: "spray", application: "spray", herbicide: "spray", pesticide: "spray", insecticide: "spray", fungicide: "spray", chemical: "spray",
  fertilize: "fertilize", fertilizer: "fertilize", fertilization: "fertilize", nutrient: "fertilize",
  harvest: "harvest", harvesting: "harvest", combine: "harvest", yield: "harvest",
  till: "till", tillage: "till", disk: "disk", discing: "disk", cultivate: "cultivate", cultivation: "cultivate",
  bale: "bale", baling: "bale", mow: "mow", mowing: "mow", irrigate: "irrigate", irrigation: "irrigate",
  graze: "graze", grazing: "graze", scout: "scout", scouting: "scout",
  "soil sample": "soil_sample", "soil test": "soil_sample", lime: "lime", liming: "lime",
  manure: "manure", conservation: "conservation",
};

const FIELD_TARGETS: { key: keyof ColumnMap; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: "activityDate", label: "Date", required: true, synonyms: ["date", "activity date", "application date", "operation date"] },
  { key: "field", label: "Field / Farm Name", required: true, synonyms: ["field", "field name", "farm", "farm name", "boundary"] },
  { key: "activityType", label: "Activity Type", required: true, synonyms: ["type", "activity type", "activity", "operation", "operation type"] },
  { key: "product", label: "Product / Crop / Chemical", synonyms: ["product", "product name", "crop", "hybrid", "variety", "chemical"] },
  { key: "rate", label: "Rate / Seeding Rate", synonyms: ["rate", "seeding rate", "population", "app rate"] },
  { key: "rateUnit", label: "Rate Unit", synonyms: ["rate unit", "rate uom", "units"] },
  { key: "quantity", label: "Quantity Used", synonyms: ["quantity", "quantity used", "total applied", "amount"] },
  { key: "quantityUnit", label: "Quantity Unit", synonyms: ["quantity unit", "qty unit", "uom"] },
  { key: "yieldAmount", label: "Yield", synonyms: ["yield", "dry yield", "yield amount", "avg yield"] },
  { key: "yieldUnit", label: "Yield Unit", synonyms: ["yield unit", "yield uom"] },
  { key: "moisturePct", label: "Moisture %", synonyms: ["moisture", "moisture %", "moisture pct", "avg moisture"] },
  { key: "acres", label: "Acres", synonyms: ["acres", "area", "acreage", "area covered"] },
  { key: "applicator", label: "Applicator / Operator", synonyms: ["applicator", "operator", "operator name", "applied by"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "comments", "remarks"] },
];

type ColumnMap = {
  activityDate?: string; field?: string; activityType?: string; product?: string;
  rate?: string; rateUnit?: string; quantity?: string; quantityUnit?: string;
  yieldAmount?: string; yieldUnit?: string; moisturePct?: string; acres?: string;
  applicator?: string; notes?: string;
};

function guessColumn(headers: string[], synonyms: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const syn of synonyms) {
    const idx = lower.indexOf(syn);
    if (idx !== -1) return headers[idx];
  }
  for (const syn of synonyms) {
    const idx = lower.findIndex((h) => h.includes(syn));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v: string | undefined): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return v;
}

const TEMPLATE_CSV = `Date,Field,Activity Type,Product,Rate,Rate Unit,Quantity,Quantity Unit,Yield,Yield Unit,Moisture %,Acres,Applicator,Notes
2026-04-15,North 80,plant,Pioneer P1197AM,32000,seeds/ac,,,,,,80,,Planted early due to dry conditions
2026-06-02,North 80,spray,Roundup PowerMAX,32,oz/ac,68,gal,,,,80,John,
2026-10-10,North 80,harvest,Corn,,,,,,185,bu/ac,14.2,80,,`;

export function ActivityImport({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [fieldValueMap, setFieldValueMap] = useState<Record<string, string>>({});
  const [typeValueMap, setTypeValueMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number; errors: string[]; createdFieldNames: string[] } | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCsv(String(reader.result));
      const objs = rowsToObjects(h, r);
      setHeaders(h);
      setRows(objs);
      const guessed: ColumnMap = {};
      for (const t of FIELD_TARGETS) {
        const g = guessColumn(h, t.synonyms);
        if (g) (guessed as any)[t.key] = g;
      }
      setColMap(guessed);
      setStep("map");
    };
    reader.readAsText(file);
  }

  const distinctFieldValues = useMemo(() => {
    if (!colMap.field) return [];
    return Array.from(new Set(rows.map((r) => r[colMap.field!]).filter(Boolean)));
  }, [rows, colMap.field]);

  const distinctTypeValues = useMemo(() => {
    if (!colMap.activityType) return [];
    return Array.from(new Set(rows.map((r) => r[colMap.activityType!]).filter(Boolean)));
  }, [rows, colMap.activityType]);

  function proceedToPreview() {
    const fMap: Record<string, string> = {};
    for (const v of distinctFieldValues) {
      const match = fields.find((f) => f.name.toLowerCase() === v.toLowerCase());
      // Default an unmatched name to "create a new field" rather than
      // skipping it — most unmatched names are just a field FarmLedger
      // doesn't know about yet, not a typo worth losing the row over.
      fMap[v] = match?.id ?? CREATE_NEW;
    }
    setFieldValueMap(fMap);
    const tMap: Record<string, string> = {};
    for (const v of distinctTypeValues) {
      tMap[v] = TYPE_SYNONYMS[v.toLowerCase().trim()] ?? "other";
    }
    setTypeValueMap(tMap);
    setStep("preview");
  }

  // Builds the actual activity rows to submit, given a field-name -> real
  // fieldId map (no CREATE_NEW sentinels left in it — those must be
  // resolved to real fields, created or existing, before calling this).
  function buildRows(resolvedFieldMap: Record<string, string>, fieldNameById: Map<string, string>) {
    if (!colMap.activityDate || !colMap.field || !colMap.activityType) return [];
    return rows
      .map((r) => {
        const fieldRaw = r[colMap.field!];
        const fieldId = resolvedFieldMap[fieldRaw];
        const activityType = typeValueMap[r[colMap.activityType!]] ?? "other";
        if (!fieldId || fieldId === CREATE_NEW) return null;
        return {
          activityDate: toIsoDate(r[colMap.activityDate!]),
          fieldId,
          fieldName: fieldNameById.get(fieldId),
          activityType,
          acres: colMap.acres ? num(r[colMap.acres]) : null,
          productName: colMap.product ? (r[colMap.product] || null) : null,
          rate: colMap.rate ? num(r[colMap.rate]) : null,
          rateUnit: colMap.rateUnit ? (r[colMap.rateUnit] || null) : null,
          quantity: colMap.quantity ? num(r[colMap.quantity]) : null,
          quantityUnit: colMap.quantityUnit ? (r[colMap.quantityUnit] || null) : null,
          yieldAmount: colMap.yieldAmount ? num(r[colMap.yieldAmount]) : null,
          yieldUnit: colMap.yieldUnit ? (r[colMap.yieldUnit] || null) : null,
          moisturePct: colMap.moisturePct ? num(r[colMap.moisturePct]) : null,
          applicatorName: colMap.applicator ? (r[colMap.applicator] || null) : null,
          notes: colMap.notes ? (r[colMap.notes] || null) : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }

  const fieldNameById = useMemo(() => new Map(fields.map((f) => [f.id, f.name])), [fields]);

  // Preview-only counts. Rows headed for a "create new field" name are
  // counted as ready (not skipped) even though we can't build their real
  // fieldId until that field actually gets created at import time.
  const previewCounts = useMemo(() => {
    if (!colMap.field) return { ready: 0, willCreate: 0, skip: 0 };
    let ready = 0, skip = 0;
    const namesToCreate = new Set<string>();
    for (const r of rows) {
      const v = fieldValueMap[r[colMap.field!]];
      if (!v) skip++;
      else if (v === CREATE_NEW) { ready++; namesToCreate.add(r[colMap.field!]); }
      else ready++;
    }
    return { ready, willCreate: namesToCreate.size, skip };
  }, [rows, colMap.field, fieldValueMap]);

  const skippedCount = previewCounts.skip;

  async function runImport() {
    setImporting(true);

    // Resolve any "create a new field" selections into real fields first.
    const namesToCreate = Array.from(new Set(
      Object.entries(fieldValueMap).filter(([, v]) => v === CREATE_NEW).map(([name]) => name)
    ));
    const resolvedFieldMap = { ...fieldValueMap };
    const resolvedNameById = new Map(fieldNameById);
    let createdFieldNames: string[] = [];

    if (namesToCreate.length > 0 && colMap.field) {
      const withAcres = namesToCreate.map((name) => {
        const row = colMap.acres ? rows.find((r) => r[colMap.field!] === name && num(r[colMap.acres!]) != null) : undefined;
        return { name, acres: row && colMap.acres ? num(row[colMap.acres]) : null };
      });
      const created = await createFieldsForImportAction(withAcres);
      for (const c of created) {
        resolvedFieldMap[c.name] = c.id;
        resolvedNameById.set(c.id, c.name);
      }
      createdFieldNames = created.map((c) => c.name);
    }

    const finalRows = buildRows(resolvedFieldMap, resolvedNameById);
    const res = await importActivitiesAction(finalRows);
    setResult({ ...res, createdFieldNames });
    setImporting(false);
    setStep("done");
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "farmledger-activity-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (step === "upload") {
    return (
      <div className="card p-8 space-y-4">
        <p className="text-sm text-charcoal/60">
          Most equipment platforms (AgFiniti, FieldView, AFS Connect, and others) can export your planting, spray,
          and yield records as a CSV or spreadsheet. Export that file from your equipment app, then upload it here —
          we&apos;ll walk you through matching the columns.
        </p>
        <button type="button" onClick={downloadTemplate} className="text-sm font-medium text-forest hover:underline">
          Download a template CSV (optional reference) →
        </button>
        <label className="block card border-dashed p-8 text-center cursor-pointer hover:border-forest">
          <div className="text-3xl mb-2">📥</div>
          <div className="font-medium">Click to choose a CSV file</div>
          <div className="text-xs text-charcoal/50 mt-1">Exported from your equipment app</div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      </div>
    );
  }

  if (step === "map") {
    return (
      <div className="card p-6 space-y-4">
        <div className="text-sm font-semibold text-forest">Match columns from {fileName}</div>
        <p className="text-xs text-charcoal/50">{rows.length} rows found. We guessed a few matches already — check them and fill in the rest. Date, Field, and Activity Type are required.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {FIELD_TARGETS.map((t) => (
            <label key={t.key} className="block">
              <div className="text-sm font-medium text-charcoal/70 mb-1">{t.label}{t.required && " *"}</div>
              <select
                className="input"
                value={(colMap as any)[t.key] ?? ""}
                onChange={(e) => setColMap((m) => ({ ...m, [t.key]: e.target.value || undefined }))}
              >
                <option value="">— Not in this file —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button
          type="button" disabled={!colMap.activityDate || !colMap.field || !colMap.activityType}
          onClick={proceedToPreview}
          className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-40"
        >
          Next: Match Fields & Activity Types →
        </button>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="card p-6 space-y-3">
          <div className="text-sm font-semibold text-forest">Match each field name to one of your fields</div>
          <p className="text-xs text-charcoal/50">A name with no match defaults to creating a new field with that name — switch it to Skip if you&apos;d rather leave those rows out.</p>
          {distinctFieldValues.map((v) => (
            <div key={v} className="flex items-center gap-3">
              <span className="text-sm flex-1 truncate">{v}</span>
              <select
                className="input flex-1"
                value={fieldValueMap[v] ?? ""}
                onChange={(e) => setFieldValueMap((m) => ({ ...m, [v]: e.target.value }))}
              >
                <option value="">Skip rows with this field</option>
                <option value={CREATE_NEW}>+ Create new field &quot;{v}&quot;</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="card p-6 space-y-3">
          <div className="text-sm font-semibold text-forest">Match each activity type</div>
          {distinctTypeValues.map((v) => (
            <div key={v} className="flex items-center gap-3">
              <span className="text-sm flex-1 truncate">{v}</span>
              <select
                className="input flex-1"
                value={typeValueMap[v] ?? "other"}
                onChange={(e) => setTypeValueMap((m) => ({ ...m, [v]: e.target.value }))}
              >
                {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <div className="text-sm font-medium mb-1">{previewCounts.ready} of {rows.length} rows ready to import</div>
          {previewCounts.willCreate > 0 && (
            <p className="text-xs text-status-amber mb-1">
              Will create {previewCounts.willCreate} new field{previewCounts.willCreate === 1 ? "" : "s"} — we&apos;ll only have the name{colMap.acres ? " and acreage" : ""} from this file, so we&apos;ll flag those fields as missing details.
            </p>
          )}
          {skippedCount > 0 && <p className="text-xs text-charcoal/50 mb-3">{skippedCount} row{skippedCount === 1 ? "" : "s"} will be skipped (field set to &quot;Skip&quot;).</p>}
          <button
            type="button" disabled={importing || previewCounts.ready === 0}
            onClick={runImport}
            className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-40"
          >
            {importing ? "Importing…" : `Import ${previewCounts.ready} Activities`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 text-center space-y-3">
      <div className="text-3xl">✅</div>
      <div className="font-medium text-forest">Imported {result?.imported ?? 0} activities</div>
      {result && result.createdFieldNames.length > 0 && (
        <div className="text-left text-sm bg-wheat/30 border border-wheat rounded-lg p-3">
          <div className="font-medium mb-1">
            Created {result.createdFieldNames.length} new field{result.createdFieldNames.length === 1 ? "" : "s"}: {result.createdFieldNames.join(", ")}
          </div>
          <p className="text-charcoal/60">
            We only had the name (and acreage, if this file included it) from the import — ownership, county, and FSA numbers are still blank.
            Fill those in on the <a href="/fields" className="text-forest font-medium hover:underline">Fields page</a> when you get a chance.
          </p>
        </div>
      )}
      {result && result.failed > 0 && (
        <div className="text-left text-sm text-status-amber">
          <div className="font-medium mb-1">{result.failed} row{result.failed === 1 ? "" : "s"} failed:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      <button onClick={() => router.push("/fields")} className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg w-full">
        Back to Fields →
      </button>
    </div>
  );
}
