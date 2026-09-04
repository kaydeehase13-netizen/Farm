"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FarmCategory, Field } from "@/types/domain";
import { saveReceiptAndCreateExpenseAction } from "@/lib/actions";

type LineType = "income" | "expense";
type SplitLine = { key: string; type: LineType; farmCategoryId: string; amount: string };

/**
 * Modern phone cameras produce photos that are several MB — plenty to make a
 * base64 data URL blow past a reasonable request size and either error out
 * or, worse, appear to hang. Downscale to a size that's still plenty sharp
 * for OCR/human review before we ever turn it into a data URL.
 */
function downscaleImage(file: File, maxDimension = 1800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no canvas context")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("image failed to load")); };
    img.src = objectUrl;
  });
}

export function ReceiptScanner({ categories, fields }: { categories: FarmCategory[]; fields: Field[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [fields2, setFields2] = useState({ vendor: "", date: new Date().toISOString().slice(0, 10), amount: "", salesTax: "", category: "" });
  const [fieldId, setFieldId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  // When the scan finds line items spanning 2+ categories, offer to split
  // this receipt into separate transactions instead of forcing it all under
  // one category.
  const [multiCategoryHint, setMultiCategoryHint] = useState<{ category: string; amount: number }[] | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const makeKey = useId();
  let keySeq = 0;
  const newLine = (type: LineType = "expense", farmCategoryId = categories[0]?.id ?? ""): SplitLine =>
    ({ key: `${makeKey}-${keySeq++}`, type, farmCategoryId, amount: "" });
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() => [newLine(), newLine()]);

  const splitNet = useMemo(
    () => splitLines.reduce((sum, l) => sum + (l.type === "expense" ? 1 : -1) * (Number(l.amount) || 0), 0),
    [splitLines]
  );
  const amountNum = Number(fields2.amount) || 0;
  const splitMismatch = splitting && Math.abs(splitNet - amountNum) > 0.005;

  function updateLine(key: string, patch: Partial<SplitLine>) {
    setSplitLines((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setSplitLines((lines) => [...lines, newLine()]);
  }
  function removeLine(key: string) {
    setSplitLines((lines) => (lines.length <= 2 ? lines : lines.filter((l) => l.key !== key)));
  }
  function enableSplit(prefill?: { category: string; amount: number }[]) {
    if (prefill && prefill.length >= 2) {
      setSplitLines(prefill.map((p) => {
        const matched = categories.find((c) => c.name.toLowerCase() === p.category.toLowerCase());
        return newLine("expense", matched?.id ?? categories[0]?.id ?? "") && { key: `${makeKey}-${keySeq++}`, type: "expense" as LineType, farmCategoryId: matched?.id ?? categories[0]?.id ?? "", amount: String(p.amount) };
      }));
    }
    setSplitting(true);
    setSplitError(null);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setSaveError(null);
    if (file.type.startsWith("image/")) {
      try {
        setPreview(await downscaleImage(file));
        return;
      } catch {
        // fall through to the raw file if downscaling fails for any reason
      }
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function scan() {
    if (!preview) return;
    setScanning(true);
    setScanNote(null);
    setMultiCategoryHint(null);
    setSplitting(false);
    try {
      const [meta, base64] = preview.split(",");
      const mimeType = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
      const res = await fetch("/api/receipts/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (data.error) {
        setScanNote(`Couldn't read the receipt automatically: ${data.error}. Enter details manually below.`);
      } else {
        setFields2({
          vendor: data.vendor ?? "",
          date: data.date ?? new Date().toISOString().slice(0, 10),
          amount: data.amount != null ? String(data.amount) : "",
          salesTax: data.salesTax != null ? String(data.salesTax) : "",
          category: "",
        });
        const matched = categories.find((c) => c.name.toLowerCase() === (data.suggestedCategory ?? "").toLowerCase());
        if (matched) setFields2((f) => ({ ...f, category: matched.id }));
        if (data.stub) setScanNote(data.note ?? "AI scanning isn't configured — enter details manually below.");
        else if (data.multipleCategories) {
          setMultiCategoryHint(data.categoryBreakdown ?? []);
          setScanNote("Extracted from the photo — please double-check before saving.");
        } else {
          setScanNote("Extracted from the photo — please double-check before saving.");
        }
      }
    } catch {
      setScanNote("Scan failed. Enter details manually below.");
    } finally {
      setScanning(false);
    }
  }

  function validateSplit(): boolean {
    if (Math.abs(splitNet - amountNum) > 0.005) {
      setSplitError(`These lines total ${splitNet.toFixed(2)}, but the receipt amount above is ${amountNum.toFixed(2)}. Fix one so they match.`);
      return false;
    }
    if (splitLines.some((l) => !l.farmCategoryId || !l.amount)) {
      setSplitError("Every line needs a category and an amount.");
      return false;
    }
    setSplitError(null);
    return true;
  }

  async function save(formData: FormData) {
    if (splitting && !validateSplit()) return;
    formData.set("fileName", fileName || "receipt.jpg");
    if (preview) formData.set("fileDataUrl", preview);
    formData.set("captureSource", "web_upload");
    if (splitting) {
      formData.set("splitLines", JSON.stringify(splitLines.map((l) => ({ type: l.type, farmCategoryId: l.farmCategoryId, amount: l.amount }))));
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveReceiptAndCreateExpenseAction(formData);
      router.push("/money/receipts");
    } catch (e) {
      setSaveError(
        e instanceof Error && /body|payload|exceed/i.test(e.message)
          ? "That photo is too large to save. Try retaking it with a smaller/lower-resolution setting, or crop it closer to the receipt."
          : "Something went wrong saving this receipt. Please try again."
      );
      setSaving(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div
          className="card aspect-[3/4] flex items-center justify-center overflow-hidden cursor-pointer border-dashed"
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Receipt preview" className="w-full h-full object-contain bg-charcoal/5" />
          ) : (
            <div className="text-center text-charcoal/50 p-6">
              <div className="text-3xl mb-2">📷</div>
              <div className="font-medium">Take a photo or drag & drop a receipt</div>
              <div className="text-xs mt-1">JPEG, PNG or PDF</div>
            </div>
          )}
        </div>
        <input
          ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <button
          type="button" onClick={scan} disabled={!preview || scanning}
          className="mt-3 w-full bg-forest text-white px-4 py-2.5 rounded-lg font-medium hover:bg-forest-light disabled:opacity-40"
        >
          {scanning ? "Scanning…" : "Scan with AI"}
        </button>
        {scanNote && <p className="text-xs text-status-amber mt-2">{scanNote}</p>}
        {multiCategoryHint && multiCategoryHint.length >= 2 && !splitting && (
          <div className="mt-3 text-sm bg-wheat/30 border border-wheat rounded-lg p-3">
            <p className="text-charcoal/70">
              This looks like it covers {multiCategoryHint.length} categories: {multiCategoryHint.map((c) => `${c.category} (${c.amount.toFixed(2)})`).join(", ")}.
            </p>
            <button type="button" onClick={() => enableSplit(multiCategoryHint)} className="text-forest font-medium hover:underline mt-1">
              Split it into separate transactions →
            </button>
          </div>
        )}
      </div>

      <form action={save} className="card p-6 space-y-4 h-fit">
        <div className="text-sm font-semibold text-forest">Confirm receipt details</div>
        <p className="text-xs text-charcoal/50">Nothing is saved to your books until you confirm these details.</p>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Vendor</div>
          <input name="vendorName" className="input" value={fields2.vendor} onChange={(e) => setFields2({ ...fields2, vendor: e.target.value })} required />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Date</div>
          <input type="date" name="date" className="input" value={fields2.date} onChange={(e) => setFields2({ ...fields2, date: e.target.value })} required />
        </label>
        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">{splitting ? "Receipt Total" : "Amount"}</div>
          <input type="number" step="0.01" name="amount" className="input" value={fields2.amount} onChange={(e) => setFields2({ ...fields2, amount: e.target.value })} required />
        </label>
        {!splitting && (
          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Sales Tax</div>
            <input type="number" step="0.01" name="salesTax" className="input" value={fields2.salesTax} onChange={(e) => setFields2({ ...fields2, salesTax: e.target.value })} />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm bg-wheat/20 border border-wheat rounded-lg px-3 py-2">
          <input type="checkbox" checked={splitting} onChange={(e) => (e.target.checked ? enableSplit() : setSplitting(false))} />
          This receipt covers more than one category — split it
        </label>

        {!splitting && (
          <label className="block">
            <div className="text-sm font-medium text-charcoal/70 mb-1">Category</div>
            <select name="farmCategoryId" className="input" value={fields2.category} onChange={(e) => setFields2({ ...fields2, category: e.target.value })} required>
              <option value="" disabled>Choose a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        {splitting && (
          <div className="space-y-2 border border-[--border-color] rounded-lg p-3">
            <div className="text-sm font-medium text-charcoal/70">Line-item breakdown</div>
            {splitLines.map((line) => (
              <div key={line.key} className="flex flex-wrap gap-2 items-center">
                <div className="flex rounded-lg border border-[--border-color] overflow-hidden text-xs font-medium">
                  <button type="button" onClick={() => updateLine(line.key, { type: "expense" })} className={`px-2.5 py-2 ${line.type === "expense" ? "bg-forest text-white" : "bg-transparent text-charcoal/60"}`}>Expense</button>
                  <button type="button" onClick={() => updateLine(line.key, { type: "income" })} className={`px-2.5 py-2 ${line.type === "income" ? "bg-forest text-white" : "bg-transparent text-charcoal/60"}`}>Income</button>
                </div>
                <select className="input flex-1 min-w-[140px]" value={line.farmCategoryId} onChange={(e) => updateLine(line.key, { farmCategoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="0.00" className="input w-28" value={line.amount} onChange={(e) => updateLine(line.key, { amount: e.target.value })} />
                <button type="button" onClick={() => removeLine(line.key)} disabled={splitLines.length <= 2} className="text-charcoal/40 hover:text-status-red disabled:opacity-30 px-2" title="Remove line">✕</button>
              </div>
            ))}
            <button type="button" onClick={addLine} className="text-sm font-medium text-forest hover:underline">+ Add another line</button>
            <div className={`text-xs ${splitMismatch ? "text-status-red" : "text-charcoal/50"}`}>
              Lines total {splitNet.toFixed(2)} of {amountNum.toFixed(2)}
            </div>
            {splitError && <p className="text-sm text-status-red">{splitError}</p>}
          </div>
        )}

        <label className="block">
          <div className="text-sm font-medium text-charcoal/70 mb-1">Assign to Field (optional)</div>
          <select name="fieldId" className="input" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            <option value="">— General farm overhead —</option>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        {saveError && <p className="text-sm text-status-red">{saveError}</p>}
        <button disabled={saving} className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg w-full disabled:opacity-50">
          {saving ? "Saving…" : splitting ? "Save Split Receipt" : "Save Receipt & Create Expense"}
        </button>
      </form>
    </div>
  );
}
