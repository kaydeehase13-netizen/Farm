"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPendingReceiptAction } from "@/lib/actions";

type QueueItem = {
  file: File;
  preview: string;
  status: "waiting" | "scanning" | "done" | "failed";
  note?: string;
};

export function BatchReceiptScanner() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const router = useRouter();

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Downscale photos before turning them into data URLs — phone camera
  // photos are several MB each and this is often 10+ of them at once.
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

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    const withPreviews = await Promise.all(
      arr.map(async (file) => ({
        file,
        preview: file.type.startsWith("image/") ? await downscaleImage(file).catch(() => readAsDataUrl(file)) : await readAsDataUrl(file),
        status: "waiting" as const,
      }))
    );
    setItems((prev) => [...prev, ...withPreviews]);
  }

  async function processAll() {
    setRunning(true);
    setSavedCount(0);
    // Snapshot the current queue; process sequentially so we don't hammer the OCR API at once.
    for (let i = 0; i < items.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "scanning" } : it)));
      const item = items[i];
      try {
        const [meta, base64] = item.preview.split(",");
        const mimeType = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
        const res = await fetch("/api/receipts/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (data.error) {
          await createPendingReceiptAction({ fileName: item.file.name, captureSource: "web_upload", failed: true, fileDataUrl: item.preview });
          setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "failed", note: "Couldn't read automatically — you'll enter it by hand." } : it)));
        } else {
          await createPendingReceiptAction({
            fileName: item.file.name,
            captureSource: "web_upload",
            vendor: data.vendor ?? null,
            date: data.date ?? null,
            amount: data.amount ?? null,
            salesTax: data.salesTax ?? null,
            failed: !!data.stub,
            fileDataUrl: item.preview,
          });
          setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: data.stub ? "failed" : "done", note: data.stub ? (data.note ?? "AI scanning isn't configured") : "Scanned" } : it)));
        }
      } catch {
        await createPendingReceiptAction({ fileName: item.file.name, captureSource: "web_upload", failed: true, fileDataUrl: item.preview });
        setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "failed", note: "Scan failed — you'll enter it by hand." } : it)));
      }
      setSavedCount((c) => c + 1);
    }
    setRunning(false);
  }

  const allDone = items.length > 0 && savedCount === items.length && !running;

  return (
    <div>
      <div
        className="card p-8 flex items-center justify-center cursor-pointer border-dashed mb-4"
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="text-center text-charcoal/50">
          <div className="text-3xl mb-2">🧾📚</div>
          <div className="font-medium">Drag & drop multiple receipts here, or click to choose files</div>
          <div className="text-xs mt-1">JPEG, PNG or PDF — as many at once as you like</div>
        </div>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }}
      />

      {items.length > 0 && (
        <div className="card p-4 space-y-2 mb-4">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm border-b border-charcoal/10 last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.preview} alt="" className="w-10 h-10 object-cover rounded bg-charcoal/5 shrink-0" />
                <span className="truncate">{it.file.name}</span>
              </div>
              <span className={
                it.status === "done" ? "status-pill status-green" :
                it.status === "failed" ? "status-pill status-amber" :
                it.status === "scanning" ? "status-pill status-amber" : "text-xs text-charcoal/40"
              }>
                {it.status === "waiting" ? "Queued" : it.status === "scanning" ? "Scanning…" : it.status === "done" ? "Scanned" : it.note ?? "Needs manual entry"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!allDone ? (
        <button
          type="button" onClick={processAll} disabled={items.length === 0 || running}
          className="bg-forest text-white px-5 py-2.5 rounded-lg font-medium w-full hover:bg-forest-light disabled:opacity-40"
        >
          {running ? `Scanning ${savedCount + 1} of ${items.length}…` : `Scan ${items.length || ""} Receipt${items.length === 1 ? "" : "s"}`}
        </button>
      ) : (
        <div className="card p-4 text-center">
          <div className="font-medium text-forest mb-1">All {items.length} receipts uploaded</div>
          <p className="text-sm text-charcoal/55 mb-3">Nothing has been added to your books yet — review and confirm each one to turn it into an expense.</p>
          <button onClick={() => router.push("/money/receipts")} className="bg-wheat text-forest font-semibold px-5 py-2.5 rounded-lg w-full">
            Review Receipts →
          </button>
        </div>
      )}
      <p className="text-xs text-charcoal/45 mt-3">Each receipt still needs a quick review before it becomes an expense — nothing is saved to your books automatically.</p>
    </div>
  );
}
